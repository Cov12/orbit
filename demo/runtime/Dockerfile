# Agent runtime for the demo: the runtime image plus Node and the orchestrator's MCP
# server, so agents can call Conductor's tools (WorkPipe data, tickets) over stdio MCP.
# Built by demo/build.sh after orbit/agent-runtime:dev and orbit/conductor-mcp:demo.

FROM orbit/conductor-mcp:demo AS mcp
FROM node:22-bookworm-slim AS node

FROM orbit/agent-runtime:dev
USER root
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=mcp /out/paperclip-mcp-server.mjs /opt/orbit/mcp/paperclip-mcp-server.mjs
RUN node --version && chmod 0444 /opt/orbit/mcp/paperclip-mcp-server.mjs
USER hermes
