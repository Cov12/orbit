"""Voice session management for Atrium.

This module provides an in-memory async session manager for voice conversations.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

logger = logging.getLogger("atrium.voice_session")


@dataclass(slots=True)
class VoiceSession:
    """Represents a single voice interaction session."""

    session_id: str = field(default_factory=lambda: str(uuid4()))
    org_id: str = ""
    user_id: str = ""
    department_slug: str = "chief"
    conversation_history: list[dict[str, str]] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_activity: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    escalation_count: int = 0
    total_turns: int = 0
    is_active: bool = True


class VoiceSessionManager:
    """Async, lock-protected manager for voice sessions."""

    def __init__(self) -> None:
        # TODO: Replace in-memory store with Redis for multi-process scalability.
        self._sessions: dict[str, VoiceSession] = {}
        self._lock = asyncio.Lock()

    async def create_session(
        self,
        org_id: str,
        user_id: str,
        department_slug: str = "chief",
    ) -> VoiceSession:
        """Create and store a new active voice session."""
        now = datetime.now(timezone.utc)
        session = VoiceSession(
            org_id=org_id,
            user_id=user_id,
            department_slug=department_slug,
            created_at=now,
            last_activity=now,
        )
        async with self._lock:
            self._sessions[session.session_id] = session

        logger.debug(
            "Created voice session %s for org=%s user=%s department=%s",
            session.session_id,
            org_id,
            user_id,
            department_slug,
        )
        return session

    async def get_session(self, session_id: str) -> VoiceSession | None:
        """Fetch a session by ID."""
        async with self._lock:
            return self._sessions.get(session_id)

    async def add_turn(self, session_id: str, role: str, content: str) -> None:
        """Append a conversation turn and update session activity.

        Conversation history is capped at the latest 20 turns.
        """
        async with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                logger.debug("add_turn called for missing session %s", session_id)
                return

            session.conversation_history.append({"role": role, "content": content})
            if len(session.conversation_history) > 20:
                session.conversation_history = session.conversation_history[-20:]

            session.total_turns += 1
            session.last_activity = datetime.now(timezone.utc)

    async def record_escalation(self, session_id: str) -> None:
        """Increment escalation count for a session."""
        async with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                logger.debug("record_escalation called for missing session %s", session_id)
                return

            session.escalation_count += 1
            session.last_activity = datetime.now(timezone.utc)

    async def end_session(self, session_id: str) -> dict[str, Any] | None:
        """Mark a session inactive and return summary statistics."""
        async with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                logger.debug("end_session called for missing session %s", session_id)
                return None

            session.is_active = False
            session.last_activity = datetime.now(timezone.utc)

            duration_seconds = max(
                0.0,
                (session.last_activity - session.created_at).total_seconds(),
            )

            stats: dict[str, Any] = {
                "duration_seconds": duration_seconds,
                "total_turns": session.total_turns,
                "escalation_count": session.escalation_count,
            }
            return stats

    async def cleanup_stale(self, max_age_minutes: int = 30) -> int:
        """Remove stale inactive sessions and return how many were removed."""
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=max_age_minutes)

        async with self._lock:
            stale_ids = [
                session_id
                for session_id, session in self._sessions.items()
                if (not session.is_active) and session.last_activity <= cutoff
            ]
            for session_id in stale_ids:
                del self._sessions[session_id]

            removed = len(stale_ids)

        if removed:
            logger.debug("Cleaned up %d stale voice sessions", removed)
        return removed

    async def get_active_sessions(self, org_id: str | None = None) -> list[VoiceSession]:
        """Return active sessions, optionally filtered by organization ID."""
        async with self._lock:
            sessions = [session for session in self._sessions.values() if session.is_active]
            if org_id is not None:
                sessions = [session for session in sessions if session.org_id == org_id]
            return sessions

    async def get_stats(self) -> dict[str, Any]:
        """Return aggregate stats for active sessions."""
        async with self._lock:
            active_sessions = [session for session in self._sessions.values() if session.is_active]

            by_org: dict[str, int] = {}
            total_turns = 0
            for session in active_sessions:
                by_org[session.org_id] = by_org.get(session.org_id, 0) + 1
                total_turns += session.total_turns

            total_active = len(active_sessions)
            avg_turns_per_session = (
                total_turns / total_active if total_active > 0 else 0.0
            )

            return {
                "total_active": total_active,
                "by_org": by_org,
                "avg_turns_per_session": avg_turns_per_session,
            }


voice_sessions = VoiceSessionManager()
