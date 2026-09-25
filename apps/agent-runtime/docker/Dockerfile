# syntax=docker/dockerfile:1
#
# Slim image for Orbit's agent runtime: upstream Hermes Agent at UPSTREAM_REF,
# plus our patches and the mem0_local memory provider.
#
# Build it with ../build.sh, which assembles the context this file expects:
#
#   <context>/hermes/   patched upstream source (mem0_local already copied in)
#   <context>/docker/   this directory
#
# Unlike upstream's Dockerfile this installs only what the API server and
# mem0_local need: no Node, Playwright, s6-overlay or messaging adapters.
# Targets:  runtime (default)  |  test (runtime + upstream tests + pytest)

ARG PYTHON_IMAGE=python:3.12-slim-bookworm

# ---------------------------------------------------------------------------
# builder: resolve deps into /opt/venv, install hermes-agent (editable) from
# /opt/hermes. Nothing in this stage ships except /opt/venv and /opt/hermes.
# ---------------------------------------------------------------------------
FROM ${PYTHON_IMAGE} AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN python -m venv /opt/venv
ENV PATH=/opt/venv/bin:$PATH

# 1) Upstream's pinned dependency set, exported from its uv.lock so transitive
#    versions match what upstream tested. Core deps + the `mcp` extra (the MCP
#    client patch 0001 hooks into). Cached unless the lock changes.
WORKDIR /tmp/lock
COPY hermes/pyproject.toml hermes/uv.lock ./
RUN pip install uv==0.11.6 \
 && uv export --frozen --no-hashes --no-emit-project --no-dev \
        --extra mcp --output-file /tmp/requirements.lock.txt \
 && pip uninstall -y uv

# 2) Runtime additions (see requirements-runtime.txt for why each is here).
COPY docker/requirements-runtime.txt /tmp/requirements-runtime.txt
RUN pip install -r /tmp/requirements.lock.txt -r /tmp/requirements-runtime.txt

# 3) Source. Tests are moved aside so only the test target ships them.
COPY hermes/ /opt/hermes/
RUN mv /opt/hermes/tests /opt/hermes-tests \
 && pip install --no-deps -e /opt/hermes \
 && find /opt/venv /opt/hermes -name '__pycache__' -type d -prune -exec rm -rf {} +

# ---------------------------------------------------------------------------
# runtime
# ---------------------------------------------------------------------------
FROM ${PYTHON_IMAGE} AS runtime

# tini as PID 1 reaps orphaned children (MCP stdio servers, shell tools).
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --uid 10000 --user-group --no-create-home --home-dir /opt/data --shell /usr/sbin/nologin hermes \
 && install -d -o hermes -g hermes -m 0700 /opt/data

COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /opt/hermes /opt/hermes
COPY --chmod=0755 docker/entrypoint.sh /opt/orbit/entrypoint.sh
COPY --chmod=0644 docker/render_config.py /opt/orbit/render_config.py

ENV PATH=/opt/venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    HOME=/opt/data \
    HERMES_HOME=/opt/data \
    MEM0_DIR=/opt/data/.mem0 \
    MEM0_TELEMETRY=false \
    HERMES_DISABLE_LAZY_INSTALLS=1 \
    API_SERVER_HOST=0.0.0.0 \
    API_SERVER_PORT=8642

WORKDIR /opt/data
VOLUME ["/opt/data"]
EXPOSE 8642
USER hermes

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["python", "-c", "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/health' % os.environ.get('API_SERVER_PORT','8642'), timeout=4)"]

ENTRYPOINT ["/usr/bin/tini", "--", "/opt/orbit/entrypoint.sh"]
CMD ["gateway", "run"]

# ---------------------------------------------------------------------------
# test: runtime + upstream's tests + the dev-extra test runner pins.
#   docker build --target test ...  &&  docker run --rm <img> tests/gateway/...
# ---------------------------------------------------------------------------
FROM runtime AS test
USER root
RUN pip install --no-cache-dir pytest==9.0.2 pytest-asyncio==1.3.0 pytest-timeout==2.4.0
COPY --from=builder --chown=hermes:hermes /opt/hermes-tests /opt/hermes/tests
# Upstream's test fixtures write caches under the project root; the runtime
# image keeps /opt/hermes read-only, the test image does not.
RUN chown -R hermes:hermes /opt/hermes
USER hermes
WORKDIR /opt/hermes
ENTRYPOINT ["/usr/bin/tini", "--", "python", "-m", "pytest"]
CMD ["-q", "tests/gateway/test_api_server.py", "tests/tools/test_mcp_tool.py"]
