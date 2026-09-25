#!/usr/bin/env bash
# Build the agent-runtime image: upstream Hermes Agent at UPSTREAM_REF, our
# patches applied, the mem0_local memory provider added, then docker build.
#
#   apps/agent-runtime/build.sh [--tag TAG] [--test] [--keep-context]
#
#   --tag TAG        image tag (default: orbit/agent-runtime:dev)
#   --test           also build the `test` target and run the patch tests in it
#                    (tests/gateway/test_api_server.py, tests/tools/test_mcp_tool.py)
#   --keep-context   keep the assembled build context and print its path
#
# Environment:
#   HERMES_UPSTREAM_REPO  where to fetch upstream from (URL or local clone path;
#                         default https://github.com/NousResearch/hermes-agent.git)
#   BUILD_NICE            nice level for docker build (default 10)
#   DOCKER_BUILD_ARGS     extra args passed to docker build (word-split)
#
# Fails (non-zero, with the patch name) if any patch does not apply cleanly.
set -euo pipefail

die() { echo "build.sh: ERROR: $*" >&2; exit 1; }
log() { echo "build.sh: $*" >&2; }

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAG="orbit/agent-runtime:dev"
RUN_TESTS=0
KEEP_CONTEXT=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag) [[ $# -ge 2 ]] || die "--tag needs a value"; TAG="$2"; shift 2 ;;
    --test) RUN_TESTS=1; shift ;;
    --keep-context) KEEP_CONTEXT=1; shift ;;
    -h|--help) sed -n '2,19p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown argument: $1 (see --help)" ;;
  esac
done

REPO="${HERMES_UPSTREAM_REPO:-https://github.com/NousResearch/hermes-agent.git}"
NICE="${BUILD_NICE:-10}"
REF="$(tr -d '[:space:]' < "$APP_DIR/UPSTREAM_REF")"
[[ "$REF" =~ ^[0-9a-f]{40}$ ]] || die "UPSTREAM_REF must be a full 40-char commit sha, got '$REF'"

command -v git >/dev/null || die "git not found"
command -v docker >/dev/null || die "docker not found"

shopt -s nullglob
PATCHES=("$APP_DIR"/patches/*.patch)
shopt -u nullglob
[[ ${#PATCHES[@]} -gt 0 ]] || die "no patches found in $APP_DIR/patches"

CTX="$(mktemp -d "${TMPDIR:-/tmp}/agent-runtime-ctx.XXXXXX")"
cleanup() {
  if [[ "$KEEP_CONTEXT" == 1 ]]; then log "build context kept at $CTX"; else rm -rf "$CTX"; fi
}
trap cleanup EXIT

# 1) Upstream source at the pinned commit (shallow fetch of exactly that sha).
log "fetching upstream $REF from $REPO"
git init -q "$CTX/hermes"
git -C "$CTX/hermes" fetch -q --depth 1 "$REPO" "$REF" || die "could not fetch $REF from $REPO"
git -C "$CTX/hermes" -c advice.detachedHead=false checkout -q FETCH_HEAD
[[ "$(git -C "$CTX/hermes" rev-parse HEAD)" == "$REF" ]] || die "checked-out HEAD does not match UPSTREAM_REF"

# 2) Our patches, in order. --check first so a bad patch fails before any change.
for p in "${PATCHES[@]}"; do
  name="$(basename "$p")"
  if ! git -C "$CTX/hermes" apply --check "$p"; then
    die "patch does not apply to $REF: $name"
  fi
  git -C "$CTX/hermes" apply "$p" || die "failed applying patch: $name"
  log "applied $name"
done

# 3) Our memory provider, as a bundled plugin.
[[ -d "$APP_DIR/plugins/memory/mem0_local" ]] || die "plugins/memory/mem0_local missing"
[[ ! -e "$CTX/hermes/plugins/memory/mem0_local" ]] || die "upstream already ships plugins/memory/mem0_local; refusing to overwrite"
cp -r "$APP_DIR/plugins/memory/mem0_local" "$CTX/hermes/plugins/memory/"
find "$CTX/hermes/plugins/memory/mem0_local" -name '__pycache__' -type d -prune -exec rm -rf {} +

# Baked revision (read by upstream's build_info for `hermes dump` / banner).
echo "$REF" > "$CTX/hermes/.hermes_build_sha"

# 4) Docker assets + context ignore list.
cp -r "$APP_DIR/docker" "$CTX/docker"
cp "$APP_DIR/docker/context.dockerignore" "$CTX/.dockerignore"

PATCH_SET_SHA="$(cat "${PATCHES[@]}" "$APP_DIR"/plugins/memory/mem0_local/*.* | sha256sum | cut -c1-12)"
LABELS=(
  --label "org.opencontainers.image.title=orbit-agent-runtime"
  --label "org.opencontainers.image.source=https://github.com/NousResearch/hermes-agent"
  --label "org.opencontainers.image.revision=$REF"
  --label "orbit.agent-runtime.patchset=$PATCH_SET_SHA"
)
# shellcheck disable=SC2206
EXTRA=(${DOCKER_BUILD_ARGS:-})

log "docker build $TAG (nice -n $NICE)"
nice -n "$NICE" docker build "${LABELS[@]}" "${EXTRA[@]}" \
  -f "$CTX/docker/Dockerfile" --target runtime -t "$TAG" "$CTX"

size="$(docker image inspect -f '{{.Size}}' "$TAG")"
log "built $TAG ($(( size / 1024 / 1024 )) MiB)"

if [[ "$RUN_TESTS" == 1 ]]; then
  TEST_TAG="${TAG}-test"
  log "docker build $TEST_TAG (test target)"
  nice -n "$NICE" docker build "${LABELS[@]}" "${EXTRA[@]}" \
    -f "$CTX/docker/Dockerfile" --target test -t "$TEST_TAG" "$CTX"
  log "running patch tests in $TEST_TAG (no network)"
  docker run --rm --network none "$TEST_TAG"
fi
