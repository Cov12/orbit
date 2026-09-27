#!/bin/bash
# claude-delegate.sh — delegate a coding/debugging task to Claude Code CLI
#
# Coda invokes this when a task needs Claude Code's full toolset (Bash, Edit,
# Read, Write, Grep, etc.) — leveraging the Principal's Anthropic Max subscription
# instead of Coda trying to do the work itself on Codex.
#
# Pattern:
#   1) Coda receives a coding/debug task from the Principal
#   2) Coda runs this script via Bash with the task description
#   3) Claude Code (under the Principal's Max plan) executes against the workspace
#   4) Coda reads the output, audits, reports back to the Principal
#
# IMPORTANT: This is invoked via Bash. It is NOT an "ACP agent" — earlier
# attempts to spawn `claude-code` as an ACP agent failed with `spawn_failed`
# because no such agent is registered. The mechanism is: shell -> binary.

set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

# Args
TASK="${1:-}"
WORKSPACE="${2:-$PWD}"

if [ -z "$TASK" ] || [ "$TASK" = "--help" ] || [ "$TASK" = "-h" ]; then
  cat <<'EOF'
Usage: claude-delegate "<task description>" [workspace-path]

Delegates a task to the Claude Code CLI (uses the Principal's Anthropic Max plan,
so per-invocation cost is bundled in the subscription).

Args:
  task          Task description, quoted (required)
  workspace     Working directory for Claude (default: $PWD)

Environment:
  CLAUDE_DELEGATE_TIMEOUT     Timeout in seconds (default: 600 = 10 min)
  CLAUDE_DELEGATE_DANGEROUS   Set to "1" to skip permission prompts —
                              REQUIRED for tasks that edit or write files.
                              The Principal must enable --dangerously-skip-permissions
                              support on this machine first.

Output:
  Claude's response is streamed to stdout (also captured to audit log).
  Full audit log in ~/.openclaw/scripts/logs/claude-delegate/

Examples:
  claude-delegate "Run the test suite and report failures"
  claude-delegate "Fix JWT mismatch in /api/v1/auths/portal-exchange" \\
                  ~/.openclaw/workspace/atrium
  CLAUDE_DELEGATE_DANGEROUS=1 claude-delegate "Edit foo.ts to do bar" /path/to/repo
EOF
  [ -z "$TASK" ] && exit 1 || exit 0
fi

# Validate workspace
if [ ! -d "$WORKSPACE" ]; then
  ops_die "Workspace path does not exist: $WORKSPACE"
fi

# Locate claude binary
CLAUDE_BIN=$(command -v claude 2>/dev/null || echo "")
if [ -z "$CLAUDE_BIN" ]; then
  CLAUDE_BIN="$HOME/.npm-global/bin/claude"
fi
if [ ! -x "$CLAUDE_BIN" ]; then
  ops_die "Claude Code CLI not found. Tried PATH and $CLAUDE_BIN"
fi

# Audit log setup
LOG_BASE="$OPS_LOG_DIR/claude-delegate"
mkdir -p "$LOG_BASE"
TS=$(date -u +%Y%m%dT%H%M%SZ)
RUN_ID="${TS}-$$"
TASK_FILE="$LOG_BASE/${RUN_ID}.task.txt"
RESULT_FILE="$LOG_BASE/${RUN_ID}.result.txt"

# Save task spec for audit
cat > "$TASK_FILE" <<EOF
RunID: $RUN_ID
Started: $(date -Iseconds)
Workspace: $WORKSPACE
Dangerous: ${CLAUDE_DELEGATE_DANGEROUS:-0}
Timeout: ${CLAUDE_DELEGATE_TIMEOUT:-600}s
Task:
$TASK
EOF

ops_log "claude-delegate" "Run $RUN_ID START: ws=$WORKSPACE task=${TASK:0:120}"

# Build invocation flags
DANGEROUS_FLAG=()
if [ "${CLAUDE_DELEGATE_DANGEROUS:-0}" = "1" ]; then
  DANGEROUS_FLAG=(--dangerously-skip-permissions)
fi

TIMEOUT_SEC="${CLAUDE_DELEGATE_TIMEOUT:-600}"

# Invoke. Capture exit code without tripping set -e.
EXIT=0
cd "$WORKSPACE"
timeout "$TIMEOUT_SEC" "$CLAUDE_BIN" -p "$TASK" "${DANGEROUS_FLAG[@]}" 2>&1 | tee "$RESULT_FILE" || EXIT=$?

# Audit footer
{
  echo ""
  echo "Finished: $(date -Iseconds) (exit=$EXIT)"
  echo "Result size: $(wc -c < "$RESULT_FILE" 2>/dev/null || echo 0) bytes"
} >> "$TASK_FILE"

ops_log "claude-delegate" "Run $RUN_ID END: exit=$EXIT result=$RESULT_FILE"

if [ "$EXIT" -eq 124 ]; then
  echo "" >&2
  echo "[claude-delegate] hit ${TIMEOUT_SEC}s timeout. Full log: $RESULT_FILE" >&2
elif [ "$EXIT" -ne 0 ]; then
  echo "" >&2
  echo "[claude-delegate] exited with code $EXIT. Full log: $RESULT_FILE" >&2
fi

exit "$EXIT"
