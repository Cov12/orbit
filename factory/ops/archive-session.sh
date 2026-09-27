#!/bin/bash
# archive-session.sh — archive a session summary + route to Byte for ADR review
#
# Designed to be a single Bash command Coda (or any agent/human) can invoke
# to handle the full session-changelog workflow atomically. Replaces the
# fragile 4-step manual sequence with one call.
#
# Steps performed:
#   1. Save the verbatim summary to changelog/sessions/<date>-<slug>.md
#   2. Insert a row into changelog/CHANGELOG.md (newest at top of the table)
#   3. Write a `task` message to messages/coda-to-byte/inbox/ asking Byte to
#      review for an ADR
#      (Analysis layer moved Dex → Byte on 2026-06-29; Byte runs on GPT-5.4,
#       Dex's box was too brittle. See protocols/session-changelog.md.)
#   4. Echo a one-line confirmation to stdout (the message to paste to the Principal)
#
# Usage:
#   archive-session.sh \
#     --repo <repo-name> \
#     --title "<descriptive title>" \
#     [--commit <sha>] \
#     [--file <path>]    # if omitted, reads summary from stdin
#
# Examples:
#   echo "summary text..." | archive-session.sh --repo orbit-portal --title "Clerk Multi-Org Invite"
#   archive-session.sh --repo atrium --title "Render Deploy Hotfix" --commit abc1234 --file /tmp/session.md

set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

REPO=""
TITLE=""
COMMIT=""
SUMMARY_FILE=""

# Parse args
while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --title) TITLE="$2"; shift 2 ;;
    --commit) COMMIT="$2"; shift 2 ;;
    --file) SUMMARY_FILE="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,30p' "$0"; exit 0 ;;
    *) ops_die "Unknown arg: $1 (run with --help)" ;;
  esac
done

[ -n "$REPO" ] || ops_die "--repo is required"
[ -n "$TITLE" ] || ops_die "--title is required"

# Read summary from file or stdin
if [ -n "$SUMMARY_FILE" ]; then
  [ -f "$SUMMARY_FILE" ] || ops_die "Summary file not found: $SUMMARY_FILE"
  SUMMARY=$(cat "$SUMMARY_FILE")
else
  if [ -t 0 ]; then
    ops_die "No summary provided. Pass --file <path> or pipe content via stdin."
  fi
  SUMMARY=$(cat)
fi

[ -n "$SUMMARY" ] || ops_die "Summary is empty"

# Derive slug (lowercase, alphanumeric + hyphens, max 60 chars)
SLUG=$(echo "$TITLE" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -e 's/[^a-z0-9]/-/g' -e 's/--*/-/g' -e 's/^-//' -e 's/-$//' \
  | cut -c1-60)
[ -n "$SLUG" ] || ops_die "Could not derive a slug from title: $TITLE"

# Today's UTC date
DATE=$(date -u +%Y-%m-%d)

# Paths
REPO_ROOT="$HOME/dev-ops"
CHANGELOG_DIR="$REPO_ROOT/changelog"
SESSIONS_DIR="$CHANGELOG_DIR/sessions"
CHANGELOG_FILE="$CHANGELOG_DIR/CHANGELOG.md"
INBOX_DIR="$REPO_ROOT/messages/coda-to-byte/inbox"
SESSION_FILE_REL="sessions/${DATE}-${SLUG}.md"
SESSION_FILE_ABS="$SESSIONS_DIR/${DATE}-${SLUG}.md"

# Sanity checks
[ -d "$SESSIONS_DIR" ] || ops_die "Sessions dir missing: $SESSIONS_DIR"
[ -d "$INBOX_DIR" ] || ops_die "Byte inbox dir missing: $INBOX_DIR"
[ -f "$CHANGELOG_FILE" ] || ops_die "CHANGELOG.md missing: $CHANGELOG_FILE"

# Refuse to overwrite an existing session file (force the user to pick a new slug)
if [ -e "$SESSION_FILE_ABS" ]; then
  ops_die "Session file already exists: $SESSION_FILE_ABS — pick a more specific title or add a suffix"
fi

# --- Step 1: Save verbatim summary ---
printf '%s\n' "$SUMMARY" > "$SESSION_FILE_ABS"
ops_log "archive-session" "saved $SESSION_FILE_REL ($(wc -c < "$SESSION_FILE_ABS") bytes)"

# --- Step 2: Insert CHANGELOG row at top of the table (after the separator) ---
# Generate the row. Description = first ~120 chars of first non-blank line of summary.
DESC=$(printf '%s\n' "$SUMMARY" | grep -v '^[[:space:]]*$' | head -1 | cut -c1-120)
COMMIT_SUFFIX=""
[ -n "$COMMIT" ] && COMMIT_SUFFIX=" (commit \`${COMMIT}\`)"

CHANGELOG_ROW="| ${DATE} | ${REPO} | ${TITLE}${COMMIT_SUFFIX} | [${SESSION_FILE_REL}](${SESSION_FILE_REL}) | _(pending Byte review)_ |"

# Insert after the separator line (the line with all dashes between the table header and rows).
# The CHANGELOG.md has the format: table header, separator, rows. We find the separator and insert after it.
# Use awk for portable insertion.
TMP=$(mktemp)
awk -v row="$CHANGELOG_ROW" '
  BEGIN { inserted=0 }
  {
    print
    # Match a separator row: starts with |---
    if (!inserted && /^\|---/) {
      print row
      inserted=1
    }
  }
' "$CHANGELOG_FILE" > "$TMP"
mv "$TMP" "$CHANGELOG_FILE"

ops_log "archive-session" "inserted CHANGELOG row for ${DATE} ${REPO}"

# --- Step 3: Write task message to Byte's inbox ---
# Generate a ULID-ish ID: timestamp-compact + 8 random hex
MSG_ID="msg_$(date -u +%Y%m%dT%H%M%SZ)_$(openssl rand -hex 4 2>/dev/null || head -c 8 /dev/urandom | xxd -p)"
MSG_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
MSG_FILE="${INBOX_DIR}/$(date -u +%Y%m%dT%H%M%SZ)-${SLUG}-archive-review.md"

cat > "$MSG_FILE" <<EOF
---
id: ${MSG_ID}
from: coda
to: byte
created_at: ${MSG_TS}
type: task
priority: normal
subject: Review session summary for ADR + training extraction — ${REPO} ${TITLE}
in_reply_to: null
thread: ${MSG_ID}
context:
  brand: null
  repo: ${REPO}
  session_file: changelog/${SESSION_FILE_REL}
  commit: ${COMMIT}
---

# Review session summary

The Principal dropped a session summary on Telegram. I (Coda) archived it and added the CHANGELOG row. Per \`shared/protocols/session-changelog.md\`, please:

1. Read the session at \`changelog/${SESSION_FILE_REL}\`
2. Decide whether the work warrants an ADR (see "How to Decide 'Architecturally Significant'" in the protocol)
3. If yes, draft the ADR at \`shared/architecture-decisions/$(date -u +%Y-%m)-${SLUG}.md\`, surface to the Principal on Telegram for approval BEFORE committing
4. Update the CHANGELOG row at \`changelog/CHANGELOG.md\` to link the ADR

Repo: ${REPO}
Title: ${TITLE}
Commit: ${COMMIT:-<not provided>}

No reply expected via this queue — confirm directly to the Principal on Telegram when each artifact is ready for review.
EOF

ops_log "archive-session" "queued message to Byte: $(basename "$MSG_FILE")"

# --- Step 4: Echo confirmation for Coda to paste to the Principal ---
cat <<EOF
Archived session summary.
  • File: changelog/${SESSION_FILE_REL}
  • CHANGELOG: row added (newest top, marked pending Byte review)
  • Routed to Byte: $(basename "$MSG_FILE")

Byte will surface the ADR draft to the Principal for approval when ready.
EOF
