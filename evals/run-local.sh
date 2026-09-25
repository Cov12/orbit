#!/usr/bin/env bash
# Run the evals against a throwaway local runtime:
#   private docker network + a dedicated Qdrant (so memory uses real per-company collections)
#   + the agent-runtime image, published on 127.0.0.1 only. Torn down afterwards.
#
#   evals/run-local.sh --provider anthropic|openai [--model NAME] [--suite role_map|memory|all]
#                      [--env-file FILE ...] [--out DIR] [--keep]
#
# Keys come from --env-file files (ANTHROPIC_API_KEY / OPENAI_API_KEY); they are passed to the
# container and never printed. The memory suite needs an embeddings key (OPENAI_API_KEY).
set -euo pipefail
cd "$(dirname "$0")/.."

provider="" model="" suite="all" out="evals/results" keep=0 env_files=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --provider) provider=$2; shift 2 ;;
    --model) model=$2; shift 2 ;;
    --suite) suite=$2; shift 2 ;;
    --env-file) env_files+=("$2"); shift 2 ;;
    --out) out=$2; shift 2 ;;
    --keep) keep=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 64 ;;
  esac
done
[[ "$provider" == anthropic || "$provider" == openai ]] || { echo "--provider anthropic|openai is required" >&2; exit 64; }

image=${ORBIT_RUNTIME_IMAGE:-orbit/agent-runtime:dev}
net=orbit-eval-net qdrant=orbit-eval-qdrant runtime=orbit-eval-runtime port=${EVAL_PORT:-18643}
api_key=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')

cleanup() {
  [[ $keep -eq 1 ]] && { echo "kept: $runtime on 127.0.0.1:$port"; return; }
  docker rm -f "$runtime" "$qdrant" >/dev/null 2>&1 || true
  docker network rm "$net" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network inspect "$net" >/dev/null 2>&1 || docker network create "$net" >/dev/null
docker rm -f "$runtime" "$qdrant" >/dev/null 2>&1 || true
docker run -d --name "$qdrant" --network "$net" --memory 1g qdrant/qdrant:v1.19.0 >/dev/null

env_args=()
for f in "${env_files[@]}"; do env_args+=(--env-file "$f"); done
model_args=()
[[ -n "$model" ]] && model_args=(-e "HERMES_MODEL=$model")

docker run -d --name "$runtime" --network "$net" --memory 2g -p "127.0.0.1:$port:8642" \
  "${env_args[@]}" "${model_args[@]}" \
  -e "HERMES_API_KEY=$api_key" -e "HERMES_PROVIDER=$provider" \
  -e "MEM0_QDRANT_HOST=$qdrant" -e "MEM0_QDRANT_PORT=6333" \
  "$image" >/dev/null

printf 'waiting for runtime'
for _ in $(seq 1 90); do
  curl -fsS "http://127.0.0.1:$port/health" >/dev/null 2>&1 && { echo " — up"; break; }
  printf '.'; sleep 2
done
curl -fsS "http://127.0.0.1:$port/health" >/dev/null || { echo; docker logs --tail 40 "$runtime"; exit 1; }

label="${provider}-${model:-default}"
HERMES_API_KEY="$api_key" python3 evals/run.py --base-url "http://127.0.0.1:$port" \
  --label "$label" --suite "$suite" --out "$out"
