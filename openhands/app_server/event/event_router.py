"""Event router for OpenHands App Server."""

import asyncio
import logging
from datetime import datetime
from typing import Annotated, Literal
from urllib.parse import urlencode
from uuid import UUID

import websockets
from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect

from openhands.agent_server.models import EventPage, EventSortOrder
from openhands.app_server.config import depends_event_service, get_global_config
from openhands.app_server.event.event_service import EventService
from openhands.app_server.event_callback.event_callback_models import EventKind
from openhands.app_server.sandbox.sandbox_models import AGENT_SERVER, SandboxStatus
from openhands.app_server.utils.dependencies import get_dependencies
from openhands.app_server.utils.docker_utils import (
    replace_localhost_hostname_for_docker,
)
from openhands.sdk import Event

logger = logging.getLogger(__name__)

# We use the get_dependencies method here to signal to the OpenAPI docs that this endpoint
# is protected. The actual protection is provided by SetAuthCookieMiddleware
router = APIRouter(
    prefix='/conversation/{conversation_id}/events',
    tags=['Events'],
    dependencies=get_dependencies(),
)
event_service_dependency = depends_event_service()


# Read methods


@router.get('/search')
async def search_events(
    conversation_id: str,
    kind__eq: Annotated[
        EventKind | None,
        Query(title='Optional filter by event kind'),
    ] = None,
    timestamp__gte: Annotated[
        datetime | None,
        Query(title='Optional filter by timestamp greater than or equal to'),
    ] = None,
    timestamp__lt: Annotated[
        datetime | None,
        Query(title='Optional filter by timestamp less than'),
    ] = None,
    sort_order: Annotated[
        EventSortOrder,
        Query(title='Sort order for results'),
    ] = EventSortOrder.TIMESTAMP,
    page_id: Annotated[
        str | None,
        Query(title='Optional next_page_id from the previously returned page'),
    ] = None,
    limit: Annotated[
        int,
        Query(title='The max number of results in the page', gt=0, le=100),
    ] = 100,
    event_service: EventService = event_service_dependency,
) -> EventPage:
    """Search / List events."""
    return await event_service.search_events(
        conversation_id=UUID(conversation_id),
        kind__eq=kind__eq,
        timestamp__gte=timestamp__gte,
        timestamp__lt=timestamp__lt,
        sort_order=sort_order,
        page_id=page_id,
        limit=limit,
    )


@router.get('/count')
async def count_events(
    conversation_id: str,
    kind__eq: Annotated[
        EventKind | None,
        Query(title='Optional filter by event kind'),
    ] = None,
    timestamp__gte: Annotated[
        datetime | None,
        Query(title='Optional filter by timestamp greater than or equal to'),
    ] = None,
    timestamp__lt: Annotated[
        datetime | None,
        Query(title='Optional filter by timestamp less than'),
    ] = None,
    event_service: EventService = event_service_dependency,
) -> int:
    """Count events matching the given filters."""
    return await event_service.count_events(
        conversation_id=UUID(conversation_id),
        kind__eq=kind__eq,
        timestamp__gte=timestamp__gte,
        timestamp__lt=timestamp__lt,
    )


@router.get('')
async def batch_get_events(
    conversation_id: str,
    id: Annotated[list[str], Query()],
    event_service: EventService = event_service_dependency,
) -> list[Event | None]:
    """Get a batch of events given their ids, returning null for any missing event."""
    if len(id) > 100:
        raise HTTPException(
            status_code=400,
            detail=f'Cannot request more than 100 events at once, got {len(id)}',
        )
    event_ids = [UUID(id_) for id_ in id]
    events = await event_service.batch_get_events(UUID(conversation_id), event_ids)
    return events


@router.websocket('/stream')
async def stream_events(
    websocket: WebSocket,
    conversation_id: str,
    resend_mode: Annotated[Literal['all', 'since'] | None, Query()] = None,
    after_timestamp: Annotated[datetime | None, Query()] = None,
):
    """Stream conversation events via a WebSocket proxy to the agent server.

    Forwards `resend_mode` / `after_timestamp` upstream and relays JSON frames
    bidirectionally until either side disconnects.
    """
    conversation_uuid = UUID(conversation_id)
    config = get_global_config()
    assert config.app_conversation is not None
    assert config.sandbox is not None

    # Resolve the conversation + sandbox using the WebSocket scope. WebSocket
    # has the same .state/.cookies/.headers surface as Request, so injectors
    # that look up cookie-based auth still work.
    try:
        async with (
            config.app_conversation.context(
                websocket.state,
                websocket,  # type: ignore[arg-type]
            ) as app_conversation_service,
            config.sandbox.context(
                websocket.state,
                websocket,  # type: ignore[arg-type]
            ) as sandbox_service,
        ):
            conversation = await app_conversation_service.get_app_conversation(
                conversation_uuid
            )
            if not conversation:
                await websocket.close(code=4004, reason='Conversation not found')
                return

            sandbox = await sandbox_service.get_sandbox(conversation.sandbox_id)
    except Exception:
        logger.exception('event_stream_resolve_failed')
        await websocket.close(code=4401, reason='Authorization failed')
        return

    if not sandbox or sandbox.status != SandboxStatus.RUNNING:
        await websocket.close(code=4003, reason='Sandbox not running')
        return

    agent_server_url = next(
        (
            exposed_url.url
            for exposed_url in (sandbox.exposed_urls or [])
            if exposed_url.name == AGENT_SERVER
        ),
        None,
    )
    if not agent_server_url:
        await websocket.close(code=4003, reason='Agent server URL unavailable')
        return

    agent_server_url = replace_localhost_hostname_for_docker(agent_server_url)
    ws_base = (
        agent_server_url.replace('https://', 'wss://', 1)
        .replace('http://', 'ws://', 1)
        .rstrip('/')
    )
    upstream_url = f'{ws_base}/sockets/events/{conversation_uuid.hex}'

    qs: dict[str, str] = {}
    if resend_mode:
        qs['resend_mode'] = resend_mode
    if after_timestamp:
        qs['after_timestamp'] = after_timestamp.isoformat()
    if qs:
        upstream_url = f'{upstream_url}?{urlencode(qs)}'

    additional_headers: dict[str, str] = {}
    if sandbox.session_api_key:
        additional_headers['X-Session-API-Key'] = sandbox.session_api_key

    try:
        upstream = await websockets.connect(
            upstream_url, additional_headers=additional_headers
        )
    except Exception:
        logger.exception('event_stream_upstream_connect_failed')
        await websocket.close(code=4502, reason='Upstream unavailable')
        return

    await websocket.accept()

    async def client_to_upstream() -> None:
        try:
            while True:
                msg = await websocket.receive_text()
                await upstream.send(msg)
        except (WebSocketDisconnect, websockets.ConnectionClosed):
            return

    async def upstream_to_client() -> None:
        try:
            async for msg in upstream:
                if isinstance(msg, bytes):
                    await websocket.send_bytes(msg)
                else:
                    await websocket.send_text(msg)
        except websockets.ConnectionClosed:
            return

    tasks = [
        asyncio.create_task(client_to_upstream()),
        asyncio.create_task(upstream_to_client()),
    ]
    try:
        _, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)
    finally:
        await upstream.close()
        try:
            await websocket.close()
        except Exception:
            pass
