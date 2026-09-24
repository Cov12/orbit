#!/bin/sh
set -e

# Capture runtime UID/GID from environment variables, defaulting to 1000
PUID=${USER_UID:-1000}
PGID=${USER_GID:-1000}

# Adjust the node user's UID/GID if they differ from the runtime request
# and fix volume ownership only when a remap is needed
changed=0

if [ "$(id -u node)" -ne "$PUID" ]; then
    echo "Updating node UID to $PUID"
    usermod -o -u "$PUID" node
    changed=1
fi

if [ "$(id -g node)" -ne "$PGID" ]; then
    echo "Updating node GID to $PGID"
    groupmod -o -g "$PGID" node
    usermod -g "$PGID" node
    changed=1
fi

if [ "$changed" = "1" ]; then
    chown -R node:node /paperclip
fi

# --- Optional Tailscale userspace sidecar (no-op unless TS_AUTHKEY is set) ---
# When TS_AUTHKEY is empty/unset this entire block is skipped and the container
# starts exactly as it did before. When set, we run tailscaled in userspace
# (no TUN device / no NET_ADMIN needed) and expose a local HTTP proxy on
# localhost:1055. We deliberately do NOT touch HTTP_PROXY/HTTPS_PROXY, so only
# code that opts in via HERMES_OUTBOUND_PROXY is routed over the tailnet.
if [ -n "${TS_AUTHKEY:-}" ]; then
    TS_STATE_DIR=${TS_STATE_DIR:-/var/lib/tailscale}
    TS_SOCKET=/tmp/tailscaled.sock
    mkdir -p "$TS_STATE_DIR"

    echo "[tailscale] TS_AUTHKEY set — starting userspace tailscaled"
    # Backgrounded: '&' returns 0 immediately, so 'set -e' is not tripped even
    # if tailscaled later exits. The app does not depend on it being up.
    tailscaled \
        --state="${TS_STATE_DIR}/tailscaled.state" \
        --socket="$TS_SOCKET" \
        --tun=userspace-networking \
        --outbound-http-proxy-listen=localhost:1055 \
        --socks5-server=localhost:1055 &

    # Bring the node up. Wrapped in 'if' so a non-zero exit is handled here
    # rather than killing the container under 'set -e'.
    if tailscale --socket="$TS_SOCKET" up \
        --authkey="$TS_AUTHKEY" \
        --hostname="${TS_HOSTNAME:-conductor-render}" \
        --accept-dns=false; then

        # Bounded wait (~30s) until the backend reports Running.
        ts_ok=0
        n=0
        while [ "$n" -lt 30 ]; do
            if tailscale --socket="$TS_SOCKET" status --json 2>/dev/null \
                | grep -q '"BackendState": *"Running"'; then
                ts_ok=1
                break
            fi
            n=$((n + 1))
            sleep 1
        done

        if [ "$ts_ok" = "1" ]; then
            # Success: opt our Hermes adapter into the tailnet proxy. This is the
            # ONLY egress we route over Tailscale; DB and other traffic are left
            # on the default route.
            export HERMES_OUTBOUND_PROXY=http://localhost:1055
            echo "[tailscale] Running as ${TS_HOSTNAME:-conductor-render}; exported HERMES_OUTBOUND_PROXY=$HERMES_OUTBOUND_PROXY"
        else
            echo "[tailscale] WARNING: backend did not reach Running within 30s — continuing without proxy"
        fi
    else
        echo "[tailscale] WARNING: 'tailscale up' failed — continuing without proxy"
    fi
fi

exec gosu node "$@"
