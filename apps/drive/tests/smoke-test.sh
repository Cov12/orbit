#!/usr/bin/env bash

set -u

BASE_URL="${1:-${BASE_URL:-https://drive.orbit.example}}"
TMP_DIR="$(mktemp -d)"
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

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

json_like() {
  local file="$1"
  grep -Eq '^[[:space:]]*[\{\[]' "$file"
}

request() {
  local name="$1"
  local method="$2"
  local path="$3"
  shift 3

  local headers_file="$TMP_DIR/${name}.headers"
  local body_file="$TMP_DIR/${name}.body"
  local code

  code="$(curl -sS -X "$method" -D "$headers_file" -o "$body_file" -w '%{http_code}' "$@" "${BASE_URL}${path}")"

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

expect_status_any() {
  local test_name="$1"
  shift
  local expected=("$@")
  local status
  for status in "${expected[@]}"; do
    if [ "$LAST_CODE" = "$status" ]; then
      pass "$test_name"
      return 0
    fi
  done
  fail "$test_name" "$(print_context)"
  return 1
}

echo "${BLUE}Smoke testing unauthenticated endpoints against ${BASE_URL}${RESET}"

request "health" "GET" "/api/health"
if [ "$LAST_CODE" = "200" ] && json_like "$LAST_BODY"; then
  pass "Health check returns 200 JSON"
else
  fail "Health check returns 200 JSON" "$(print_context)"
fi

request "files_unauth" "GET" "/api/drive/files"
expect_status_any "Unauthenticated GET /api/drive/files is blocked" 401 302 303 307 308 404

request "upload_unauth" "POST" "/api/drive/upload" -H "Content-Type: application/json" --data '{"name":"test.txt","mimeType":"text/plain","size":4}'
expect_status_any "Unauthenticated POST /api/drive/upload is blocked" 401 302 303 307 308 404

request "quota_unauth" "GET" "/api/drive/quota"
expect_status_any "Unauthenticated GET /api/drive/quota is blocked" 401 302 303 307 308 404

request "folders_unauth" "POST" "/api/drive/folders" -H "Content-Type: application/json" --data '{"name":"smoke-test-folder"}'
expect_status_any "Unauthenticated POST /api/drive/folders is blocked" 401 302 303 307 308 404

request "share_invalid" "GET" "/api/drive/shares/nonexistent"
expect_status_any "Public share invalid ID returns error" 404 400 401

request "files_options" "OPTIONS" "/api/drive/files" -H "Origin: https://example.com" -H "Access-Control-Request-Method: GET"
if grep -Eqi '^(access-control-allow-origin|allow|x-clerk-auth-status):' "$LAST_HEADERS"; then
  pass "OPTIONS /api/drive/files returns response headers"
else
  fail "OPTIONS /api/drive/files returns response headers" "$(print_context)"
fi

if json_like "$TMP_DIR/share_invalid.body"; then
  pass "Public share invalid ID error response is JSON"
else
  fail "Public share invalid ID error response is JSON" "$(print_context)"
fi

if json_like "$TMP_DIR/files_unauth.body"; then
  pass "Unauthenticated GET /api/drive/files error response is JSON"
else
  fail "Unauthenticated GET /api/drive/files error response is JSON" "$(print_context)"
fi

printf "\nSummary: %b%d passed%b, %b%d failed%b, %b%d skipped%b\n" \
  "$GREEN" "$PASS_COUNT" "$RESET" \
  "$RED" "$FAIL_COUNT" "$RESET" \
  "$YELLOW" "$SKIP_COUNT" "$RESET"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
