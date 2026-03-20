#!/usr/bin/env bash

set -u

BASE_URL="${1:-${BASE_URL:-https://drive.orbit.example}}"
SESSION_TOKEN="${CLERK_SESSION_TOKEN:-${SESSION_TOKEN:-}}"
WRONG_ORG_ID="${WRONG_ORG_ID:-}"
TMP_DIR="$(mktemp -d)"
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
FILE_ID=""
UPLOAD_URL=""
DOWNLOAD_URL=""
SHARE_ID=""
SHARE_TOKEN=""
SHARE_DOWNLOAD_URL=""

GREEN="$(printf '\033[32m')"
RED="$(printf '\033[31m')"
YELLOW="$(printf '\033[33m')"
BLUE="$(printf '\033[34m')"
RESET="$(printf '\033[0m')"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf "%bPASS%b %s\n" "$GREEN" "$RESET" "$1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf "%bFAIL%b %s\n" "$RED" "$RESET" "$1"
  shift || true
  if [ "$#" -gt 0 ]; then
    printf "  %s\n" "$*"
  fi
}

skip() {
  SKIP_COUNT=$((SKIP_COUNT + 1))
  printf "%bSKIP%b %s\n" "$YELLOW" "$RESET" "$1"
}

json_get() {
  local file="$1"
  local expr="$2"
  python3 - "$file" "$expr" <<'PY'
import json, sys
path, expr = sys.argv[1], sys.argv[2]
with open(path, "r", encoding="utf-8") as fh:
    data = json.load(fh)
value = data
for part in expr.split("."):
    if not part:
        continue
    if part.endswith("]") and "[" in part:
        name, index = part[:-1].split("[", 1)
        if name:
            value = value[name]
        value = value[int(index)]
    else:
        value = value[part]
if isinstance(value, (dict, list)):
    print(json.dumps(value))
else:
    print(value)
PY
}

request() {
  local name="$1"
  local method="$2"
  local path="$3"
  shift 3

  local headers_file="$TMP_DIR/${name}.headers"
  local body_file="$TMP_DIR/${name}.body"
  local code

  code="$(curl -sS -X "$method" -D "$headers_file" -o "$body_file" -w '%{http_code}' \
    -H "Authorization: Bearer ${SESSION_TOKEN}" \
    -H "Cookie: __session=${SESSION_TOKEN}" \
    "$@" "${BASE_URL}${path}")"

  LAST_NAME="$name"
  LAST_CODE="$code"
  LAST_HEADERS="$headers_file"
  LAST_BODY="$body_file"
}

print_context() {
  local body_preview
  body_preview="$(tr '\n' ' ' < "$LAST_BODY" | cut -c1-180)"
  printf "status=%s content-type=%s body=%s\n" \
    "$LAST_CODE" \
    "$(awk 'BEGIN{IGNORECASE=1} /^content-type:/ {sub(/\r$/,"",$0); print substr($0,15); exit}' "$LAST_HEADERS")" \
    "$body_preview"
}

if [ -z "$SESSION_TOKEN" ]; then
  echo "${YELLOW}SKIP${RESET} Auth smoke tests require CLERK_SESSION_TOKEN or SESSION_TOKEN."
  exit 0
fi

echo "${BLUE}Smoke testing authenticated endpoints against ${BASE_URL}${RESET}"

request "list_files_initial" "GET" "/api/drive/files"
if [ "$LAST_CODE" = "200" ] && json_get "$LAST_BODY" "files" >/dev/null 2>&1; then
  pass "List files returns 200 with JSON payload"
else
  fail "List files returns 200 with JSON payload" "$(print_context)"
fi

request "quota" "GET" "/api/drive/quota"
if [ "$LAST_CODE" = "200" ] && json_get "$LAST_BODY" "quota.usedBytes" >/dev/null 2>&1 && json_get "$LAST_BODY" "quota.quotaBytes" >/dev/null 2>&1; then
  pass "Quota returns usedBytes and quotaBytes"
else
  fail "Quota returns usedBytes and quotaBytes" "$(print_context)"
fi

request "create_folder" "POST" "/api/drive/folders" -H "Content-Type: application/json" --data '{"name":"smoke-test-folder"}'
if [ "$LAST_CODE" = "200" ] || [ "$LAST_CODE" = "201" ]; then
  FOLDER_ID="$(json_get "$LAST_BODY" "folder.id" 2>/dev/null || true)"
  pass "Create folder succeeds"
else
  fail "Create folder succeeds" "$(print_context)"
fi

printf 'smoke test payload\n' > "$TMP_DIR/test.txt"
FILE_SIZE="$(wc -c < "$TMP_DIR/test.txt" | tr -d ' ')"
request "upload_prepare" "POST" "/api/drive/upload" -H "Content-Type: application/json" --data "{\"name\":\"test.txt\",\"mimeType\":\"text/plain\",\"size\":${FILE_SIZE}}"
if [ "$LAST_CODE" = "200" ] || [ "$LAST_CODE" = "201" ]; then
  FILE_ID="$(json_get "$LAST_BODY" "fileId" 2>/dev/null || true)"
  UPLOAD_URL="$(json_get "$LAST_BODY" "uploadUrl" 2>/dev/null || true)"
  if [ -n "$FILE_ID" ] && [ -n "$UPLOAD_URL" ]; then
    if curl -sS -X PUT -H "Content-Type: text/plain" --data-binary @"$TMP_DIR/test.txt" "$UPLOAD_URL" >/dev/null; then
      request "upload_finalize" "POST" "/api/drive/files/${FILE_ID}"
      if [ "$LAST_CODE" = "200" ]; then
        pass "Signed upload flow succeeds"
      else
        fail "Signed upload flow succeeds" "$(print_context)"
      fi
    else
      fail "Signed upload flow succeeds" "PUT to signed upload URL failed"
    fi
  else
    fail "Signed upload flow succeeds" "Upload prepare response missing fileId/uploadUrl"
  fi
else
  fail "Signed upload flow succeeds" "$(print_context)"
fi

request "list_files_after" "GET" "/api/drive/files"
if [ -n "$FILE_ID" ] && [ "$LAST_CODE" = "200" ] && grep -Fq "\"id\":\"${FILE_ID}\"" "$LAST_BODY"; then
  pass "Uploaded file appears in file list"
else
  fail "Uploaded file appears in file list" "$(print_context)"
fi

request "download" "GET" "/api/drive/files/${FILE_ID}/download"
if [ -n "$FILE_ID" ] && [ "$LAST_CODE" = "200" ]; then
  DOWNLOAD_URL="$(json_get "$LAST_BODY" "downloadUrl" 2>/dev/null || true)"
  if [ -n "$DOWNLOAD_URL" ]; then
    curl -sS "$DOWNLOAD_URL" -o "$TMP_DIR/downloaded.txt"
    if cmp -s "$TMP_DIR/test.txt" "$TMP_DIR/downloaded.txt"; then
      pass "Download flow returns original file content"
    else
      fail "Download flow returns original file content" "Downloaded content did not match uploaded file"
    fi
  else
    fail "Download flow returns original file content" "Download response missing downloadUrl"
  fi
else
  fail "Download flow returns original file content" "$(print_context)"
fi

request "share_create" "POST" "/api/drive/files/${FILE_ID}/share" -H "Content-Type: application/json" --data '{"expiresInHours":1}'
if [ -n "$FILE_ID" ] && [ "$LAST_CODE" = "200" ]; then
  SHARE_ID="$(json_get "$LAST_BODY" "shareId" 2>/dev/null || true)"
  SHARE_TOKEN="$(json_get "$LAST_BODY" "token" 2>/dev/null || true)"
  if [ -n "$SHARE_ID" ] && [ -n "$SHARE_TOKEN" ]; then
    pass "Create share link succeeds"
  else
    fail "Create share link succeeds" "Share response missing shareId/token"
  fi
else
  fail "Create share link succeeds" "$(print_context)"
fi

request "share_public" "GET" "/api/drive/files/${FILE_ID}/download?token=${SHARE_TOKEN}"
if [ -n "$FILE_ID" ] && [ -n "$SHARE_TOKEN" ] && [ "$LAST_CODE" = "200" ]; then
  SHARE_DOWNLOAD_URL="$(json_get "$LAST_BODY" "downloadUrl" 2>/dev/null || true)"
  if [ -n "$SHARE_DOWNLOAD_URL" ]; then
    curl -sS "$SHARE_DOWNLOAD_URL" -o "$TMP_DIR/shared.txt"
    if cmp -s "$TMP_DIR/test.txt" "$TMP_DIR/shared.txt"; then
      pass "Public share download succeeds"
    else
      fail "Public share download succeeds" "Shared download content did not match uploaded file"
    fi
  else
    fail "Public share download succeeds" "Public download response missing downloadUrl"
  fi
else
  fail "Public share download succeeds" "$(print_context)"
fi

request "delete_file" "DELETE" "/api/drive/files/${FILE_ID}"
if [ -n "$FILE_ID" ] && [ "$LAST_CODE" = "200" ]; then
  pass "Delete file succeeds"
else
  fail "Delete file succeeds" "$(print_context)"
fi

request "verify_delete" "GET" "/api/drive/files/${FILE_ID}"
if [ -n "$FILE_ID" ] && [ "$LAST_CODE" = "404" ]; then
  pass "Deleted file returns 404"
else
  fail "Deleted file returns 404" "$(print_context)"
fi

if [ -n "$WRONG_ORG_ID" ]; then
  request "wrong_org" "GET" "/api/drive/files" -H "X-Org-Id: ${WRONG_ORG_ID}"
  if [ "$LAST_CODE" = "403" ]; then
    pass "Wrong X-Org-Id is rejected with 403"
  else
    fail "Wrong X-Org-Id is rejected with 403" "$(print_context)"
  fi
else
  skip "Cross-org isolation check skipped; set WRONG_ORG_ID to enable strict 403 assertion"
fi

printf "\nSummary: %b%d passed%b, %b%d failed%b, %b%d skipped%b\n" \
  "$GREEN" "$PASS_COUNT" "$RESET" \
  "$RED" "$FAIL_COUNT" "$RESET" \
  "$YELLOW" "$SKIP_COUNT" "$RESET"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
