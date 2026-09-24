#!/usr/bin/env bash
# Fail-closed scrub gate for the public edition.
#
# Patterns come from a PRIVATE denylist that is never committed (a list of the
# terms we removed would itself disclose them). Locally, point SCRUB_DENYLIST at
# the file; in CI it is written from a repository secret.
#
# Output is deliberately location-only (file:line / pattern index), never the
# matched text, so CI logs on a public repo can't leak what the gate protects.
#
#   SCRUB_DENYLIST=/path/to/denylist.txt scripts/scrub-check.sh [tree|history|all]
set -euo pipefail

list="${SCRUB_DENYLIST:?set SCRUB_DENYLIST to the private denylist file}"
mode="${1:-all}"
[[ -r "$list" ]] || { echo "denylist not readable: $list" >&2; exit 2; }

hits=0
idx=0
while IFS= read -r pat || [[ -n "$pat" ]]; do
  [[ -z "$pat" || "$pat" == \#* ]] && continue
  idx=$((idx + 1))

  if [[ "$mode" == tree || "$mode" == all ]]; then
    # file contents (text files only)
    while IFS= read -r loc; do
      echo "HIT content  pattern#$idx  $loc"; hits=$((hits + 1))
    done < <(git grep -nIiE -e "$pat" -- . 2>/dev/null | cut -d: -f1,2 || true)
    # file and directory names
    while IFS= read -r path; do
      echo "HIT path     pattern#$idx  $path"; hits=$((hits + 1))
    done < <(git ls-files | grep -iE -e "$pat" || true)
  fi

  if [[ "$mode" == history || "$mode" == all ]]; then
    # every commit's identities, message and patch
    n=$(git log --all -p --format='%an <%ae>%n%cn <%ce>%n%B' 2>/dev/null | grep -ciE -e "$pat" || true)
    if [[ "${n:-0}" -gt 0 ]]; then
      echo "HIT history  pattern#$idx  $n line(s)"; hits=$((hits + n))
    fi
  fi
done < "$list"

if [[ "$hits" -gt 0 ]]; then
  echo "scrub-check: FAIL ($hits hit(s) across $idx pattern(s))"
  exit 1
fi
echo "scrub-check: PASS ($idx pattern(s), mode=$mode)"
