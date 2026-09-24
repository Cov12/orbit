"""Atrium Voice WebSocket Router.

Implements real-time voice mode over WebSocket:
- receives audio chunks or text
- performs STT for audio via internal Whisper endpoint
- routes messages through the Atrium orchestrator
- performs TTS via internal speech endpoint
"""

from __future__ import annotations

import base64
import binascii
import json
import logging
import os
from typing import Any

import httpx
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt

from apps.atrium.backend.middleware.jwt_auth import JWT_ALGORITHM, JWT_SECRET
from apps.atrium.backend.services.orchestrator import Orchestrator
from open_webui.internal.db import get_session

router = APIRouter(prefix="/api/atrium/voice", tags=["voice"])
logger = logging.getLogger("atrium.voice")

_orchestrator: Orchestrator | None = None


def get_orchestrator() -> Orchestrator:
    """Return a singleton Orchestrator instance."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = Orchestrator()
    return _orchestrator


def _jwt_secret() -> str:
    """Resolve JWT secret — shared with Orbit Portal."""
    return JWT_SECRET or os.environ.get("JWT_SECRET", "")


def _owui_ws_secret() -> str:
    """OWUI session-token secret (mirrors env.py / middleware.deps)."""
    return (
        os.environ.get("WEBUI_SECRET_KEY")
        or os.environ.get("WEBUI_JWT_SECRET_KEY")
        or "t0p-s3cr3t"
    )


def _authorize_voice_ws(token: str, requested_org_id: str, db) -> str | None:
    """Authorize a voice WS to `requested_org_id` (the Atrium-INTERNAL org id), binding
    the connection to the caller's real identity — mirrors middleware/deps.require_org_access
    (atrium#55). There is NO unauthenticated fallback: an unverifiable token or a caller
    who is not entitled to the org is rejected.

      1. Portal JWT (JWT_SECRET): the org_id claim is the Portal CUID — require the
         requested internal org's portal_org_id to equal it.
      2. OWUI session token (WEBUI_SECRET_KEY, payload {"id": user.id}): require the
         requested org to be one of the caller's AtriumMember orgs.

    Returns the resolved caller id on success, else None.
    """
    from ..services.organizations import OrganizationsService

    # 1. Portal-JWT path.
    secret = _jwt_secret()
    if secret:
        try:
            claims = jwt.decode(token, secret, algorithms=[JWT_ALGORITHM or "HS256"])
        except JWTError:
            claims = None
        if isinstance(claims, dict) and claims.get("org_id"):
            org = OrganizationsService.get_org_by_id(db, requested_org_id)
            if org is not None and org.portal_org_id == claims.get("org_id"):
                return claims.get("sub") or claims.get("user_id")
            return None  # Portal token, but not for this org.

    # 2. OWUI-session path.
    try:
        owui = jwt.decode(token, _owui_ws_secret(), algorithms=["HS256"])
    except JWTError:
        owui = None
    if isinstance(owui, dict) and owui.get("id"):
        user_id = owui["id"]
        member_org_ids = {
            m.org_id for m in OrganizationsService.get_user_orgs(db, user_id)
        }
        if requested_org_id in member_org_ids:
            return user_id
        return None  # Valid OWUI user, but not a member of this org.

    return None  # Neither path authorized.


def _safe_b64decode(data: str) -> bytes:
    """Decode base64 payload with strict validation."""
    try:
        return base64.b64decode(data, validate=True)
    except binascii.Error as exc:
        raise ValueError("Invalid base64 payload") from exc


def _trim_history(history: list[dict[str, str]], max_turns: int = 20) -> list[dict[str, str]]:
    """Trim conversation history to max entries."""
    if len(history) <= max_turns:
        return history
    return history[-max_turns:]


async def _transcribe_audio(client: httpx.AsyncClient, audio_bytes: bytes, token: str = "") -> str:
    """Send audio bytes to Whisper transcription endpoint."""
    files = {
        "file": ("voice.webm", audio_bytes, "audio/webm"),
    }
    data = {
        "model": "whisper-1",
    }
    headers: dict[str, str] = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = await client.post(
        "http://localhost:8080/api/v1/audio/transcriptions",
        data=data,
        files=files,
        headers=headers,
        timeout=120.0,
    )
    resp.raise_for_status()
    payload = resp.json()
    text = payload.get("text") or payload.get("content") or ""
    return str(text).strip()


async def _synthesize_speech(client: httpx.AsyncClient, content: str, token: str = "") -> str:
    """Generate TTS audio and return it as base64 string."""
    headers: dict[str, str] = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = await client.post(
        "http://localhost:8080/api/v1/audio/speech",
        json={
            "model": "tts-1",
            "voice": "alloy",
            "input": content,
            "response_format": "mp3",
        },
        headers=headers,
        timeout=120.0,
    )
    resp.raise_for_status()

    ctype = resp.headers.get("content-type", "")
    if "application/json" in ctype:
        payload = resp.json()
        if isinstance(payload.get("data"), str):
            return payload["data"]
        if isinstance(payload.get("audio"), str):
            return payload["audio"]

    return base64.b64encode(resp.content).decode("utf-8")


def _message_chat_id(message: dict[str, Any], fallback_chat_id: str | None = None) -> str | None:
    """Resolve the Open WebUI chat id for a voice turn.

    VoiceMode sends the persisted chat id on the WebSocket URL and repeats it on
    payloads after a chat is created. Prefer the per-message value so reconnects
    and first-turn chat creation can advance the active thread without opening a
    new socket.
    """
    value = message.get("chat_id") or message.get("chatId") or fallback_chat_id
    if isinstance(value, str):
        value = value.strip()
    return value or None


async def _route_message(
    orchestrator: Orchestrator,
    message: str,
    org_id: str,
    user_id: str,
    department_slug: str,
    conversation_history: list[dict[str, str]],
    chat_id: str | None = None,
) -> dict[str, Any]:
    """Route a message through the Atrium orchestrator."""
    db_gen = get_session()
    db = next(db_gen)
    try:
        return await orchestrator.route_message(
            message=message,
            org_id=org_id,
            user_id=user_id,
            department_slug=department_slug if department_slug != "chief" else None,
            chat_id=chat_id,
            db=db,
            conversation_history=conversation_history,
        )
    finally:
        try:
            db.close()
        except Exception:
            pass
        try:
            next(db_gen)
        except StopIteration:
            pass
        except Exception:
            pass


async def _send_error(websocket: WebSocket, message: str) -> None:
    """Send a protocol-compliant error payload over the socket."""
    await websocket.send_json({"type": "error", "message": message})


@router.websocket("/ws")
async def voice_ws(websocket: WebSocket) -> None:
    """WebSocket endpoint for Atrium voice mode.

    Query parameters:
        token: JWT auth token (required)
        org_id: organization id (required)
        department_slug: target department slug (optional, default: chief)
    """
    await websocket.accept()

    token = websocket.query_params.get("token", "")
    org_id = websocket.query_params.get("org_id", "")
    department_slug = websocket.query_params.get("department_slug", "chief") or "chief"
    current_chat_id = _message_chat_id({}, websocket.query_params.get("chat_id"))

    if not token:
        await _send_error(websocket, "Missing token")
        await websocket.close(code=1008)
        return
    if not org_id:
        await _send_error(websocket, "Missing org_id")
        await websocket.close(code=1008)
        return

    # Authorize: bind the requested org to the caller's real identity (atrium#55).
    # No unauthenticated fallback — an unverifiable token or a non-member is rejected.
    db = next(get_session())
    try:
        user_id = _authorize_voice_ws(token, org_id, db)
    finally:
        db.close()
    if not user_id:
        await _send_error(websocket, "Unauthorized for this org")
        await websocket.close(code=1008)
        return

    orchestrator = get_orchestrator()
    audio_chunks: list[bytes] = []
    conversation_history: list[dict[str, str]] = []
    # Preserve original token for internal API calls (STT/TTS auth)
    auth_token = token

    logger.info(
        "Voice WS connected: org_id=%s user_id=%s department=%s",
        org_id,
        user_id,
        department_slug,
    )

    try:
        async with httpx.AsyncClient() as client:
            while True:
                raw = await websocket.receive_text()

                try:
                    message = json.loads(raw)
                except json.JSONDecodeError:
                    await _send_error(websocket, "Invalid JSON payload")
                    continue

                msg_type = message.get("type")
                current_chat_id = _message_chat_id(message, current_chat_id)

                if msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
                    continue

                if msg_type == "audio_chunk":
                    chunk_b64 = message.get("data")
                    if not isinstance(chunk_b64, str) or not chunk_b64:
                        await _send_error(websocket, "audio_chunk missing data")
                        continue
                    try:
                        audio_chunks.append(_safe_b64decode(chunk_b64))
                    except ValueError as exc:
                        await _send_error(websocket, str(exc))
                    continue

                if msg_type == "end_audio":
                    if not audio_chunks:
                        await _send_error(websocket, "No audio chunks received")
                        continue

                    try:
                        transcript = await _transcribe_audio(client, b"".join(audio_chunks), auth_token)
                    except Exception as exc:
                        logger.exception("STT failed")
                        await _send_error(websocket, f"STT failed: {exc}")
                        audio_chunks.clear()
                        continue

                    audio_chunks.clear()

                    if not transcript:
                        await _send_error(websocket, "Transcription returned empty text")
                        continue

                    await websocket.send_json({"type": "transcription", "text": transcript})

                    conversation_history.append({"role": "user", "content": transcript})
                    conversation_history = _trim_history(conversation_history)

                    try:
                        result = await _route_message(
                            orchestrator=orchestrator,
                            message=transcript,
                            org_id=org_id,
                            user_id=str(user_id),
                            department_slug=department_slug,
                            conversation_history=conversation_history,
                            chat_id=current_chat_id,
                        )
                    except Exception as exc:
                        logger.exception("Orchestrator route failed")
                        await _send_error(websocket, f"Route failed: {exc}")
                        continue

                    response_text = str(result.get("content") or "").strip()
                    response_department = str(result.get("department") or department_slug)

                    if not response_text:
                        await _send_error(websocket, "Empty orchestrator response")
                        continue

                    await websocket.send_json(
                        {
                            "type": "response",
                            "content": response_text,
                            "department": response_department,
                        }
                    )

                    conversation_history.append({"role": "assistant", "content": response_text})
                    conversation_history = _trim_history(conversation_history)

                    try:
                        audio_b64 = await _synthesize_speech(client, response_text, auth_token)
                    except Exception as exc:
                        logger.exception("TTS failed")
                        await _send_error(websocket, f"TTS failed: {exc}")
                        continue

                    await websocket.send_json({"type": "audio", "data": audio_b64})
                    continue

                if msg_type == "text":
                    content = message.get("content")
                    if not isinstance(content, str) or not content.strip():
                        await _send_error(websocket, "text message missing content")
                        continue

                    user_text = content.strip()
                    conversation_history.append({"role": "user", "content": user_text})
                    conversation_history = _trim_history(conversation_history)

                    try:
                        result = await _route_message(
                            orchestrator=orchestrator,
                            message=user_text,
                            org_id=org_id,
                            user_id=str(user_id),
                            department_slug=department_slug,
                            conversation_history=conversation_history,
                            chat_id=current_chat_id,
                        )
                    except Exception as exc:
                        logger.exception("Orchestrator route failed")
                        await _send_error(websocket, f"Route failed: {exc}")
                        continue

                    response_text = str(result.get("content") or "").strip()
                    response_department = str(result.get("department") or department_slug)

                    if not response_text:
                        await _send_error(websocket, "Empty orchestrator response")
                        continue

                    await websocket.send_json(
                        {
                            "type": "response",
                            "content": response_text,
                            "department": response_department,
                        }
                    )

                    conversation_history.append({"role": "assistant", "content": response_text})
                    conversation_history = _trim_history(conversation_history)

                    try:
                        audio_b64 = await _synthesize_speech(client, response_text, auth_token)
                    except Exception as exc:
                        logger.exception("TTS failed")
                        await _send_error(websocket, f"TTS failed: {exc}")
                        continue

                    await websocket.send_json({"type": "audio", "data": audio_b64})
                    continue

                await _send_error(websocket, "Unsupported message type")

    except WebSocketDisconnect:
        logger.info(
            "Voice WS disconnected: org_id=%s user_id=%s department=%s",
            org_id,
            user_id,
            department_slug,
        )
    except Exception:
        logger.exception("Unhandled voice WS error")
    finally:
        audio_chunks.clear()
        conversation_history.clear()
