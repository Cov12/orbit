#!/bin/bash
# _common.sh — shared helpers for ops scripts.
# All ops source this for consistent paths, logging, and host detection.

OPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPS_REGISTRY="$OPS_DIR/registry.json"
OPS_CONFIG_DIR="$OPS_DIR/config"
OPS_BIN_DIR="$OPS_DIR/bin"
OPS_LOG_DIR="${OPS_LOG_DIR:-$HOME/.openclaw/scripts/logs}"
mkdir -p "$OPS_LOG_DIR"

# Hostname prefixes of the two VPSes (set these for your environment).
OPS_VPS_HOSTNAME="${OPS_VPS_HOSTNAME:-ops-vps}"
INTEL_VPS_HOSTNAME="${INTEL_VPS_HOSTNAME:-intel-vps}"

# Host detection: read /etc/hostname and map to known host names.
current_host() {
  local h
  h=$(hostname 2>/dev/null || echo unknown)
  case "$h" in
    "$OPS_VPS_HOSTNAME"*)    echo "ops-vps" ;;
    "$INTEL_VPS_HOSTNAME"*)  echo "intel-vps" ;;
    *)                       echo "unknown:$h" ;;
  esac
}

# ops_log "<op>" "<message>"
ops_log() {
  local op="$1"; shift
  echo "[$(date -Iseconds)] [$op] $*" >> "$OPS_LOG_DIR/ops.log"
}

# Print a clear error and exit with failure.
ops_die() {
  echo "ERROR: $*" >&2
  exit 1
}

# Check current host matches required host (from registry).
# Usage: require_host ops-vps
require_host() {
  local required="$1"
  local actual
  actual=$(current_host)
  if [ "$required" != "any" ] && [ "$required" != "$actual" ]; then
    ops_die "This op requires host '$required' but we're on '$actual'. Ask the agent running on $required."
  fi
}
