"""
Atrium Orchestrator — thin bridge forwarder.

Every chat turn flows to the Conductor Orbit Assistant (the single concierge brain).
The legacy local routing stack — model_router / intent_classifier / lane_router /
per-department engines / Ollama tier — was removed in the #43 teardown once the
Conductor bridge became the live path. Atrium is now a pure thin transport; Conductor
is the brain. See services/conductor_bridge.py.
"""

import logging
from typing import Optional

from sqlalchemy.orm import Session

from . import conductor_bridge

logger = logging.getLogger("atrium.orchestrator")


class Orchestrator:
    """Thin orchestration shell: forwards every chat turn to the Conductor bridge."""

    async def route_message(
        self,
        message: str,
        org_id: str,
        user_id: str,
        department_slug: Optional[str] = None,
        chat_id: Optional[str] = None,
        db: Optional[Session] = None,
        conversation_history: Optional[list[dict]] = None,
        sub_account_id: Optional[str] = None,
    ) -> dict:
        """Forward the turn to the Conductor Orbit Assistant.

        `user_id` / `conversation_history` are accepted for signature
        compatibility with the routers; cross-turn context is threaded by the
        bridge via the per-chat Conductor/Hermes session, not replayed here.
        """
        return await conductor_bridge.handle_chat(
            message=message,
            org_id=org_id,
            chat_id=chat_id,
            db=db,
            department_slug=department_slug,
            sub_account_id=sub_account_id,
        )
