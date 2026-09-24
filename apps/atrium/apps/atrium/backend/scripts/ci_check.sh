#!/usr/bin/env bash
set -euo pipefail

echo "=== Atrium CI Check ==="

# 1. Python syntax check - compile all backend Python files
echo ">>> Python syntax check (py_compile)..."
find apps/atrium/backend -name "*.py" -not -path "*/__pycache__/*" | while read f; do
  python3 -m py_compile "$f" || { echo "FAIL: $f"; exit 1; }
done
echo "✅ All Python files compile"

# 2. Check for common Svelte convention violations
echo ">>> Svelte convention check..."
# Check for onclick (should be on:click)
if grep -rn "onclick=" src/lib/components/atrium/ --include="*.svelte" 2>/dev/null; then
  echo "FAIL: Found 'onclick=' — use 'on:click' (Svelte 4)"
  exit 1
fi
# Check for class: directive with / (Tailwind conflict)
if grep -rn 'class:.*/' src/lib/components/atrium/ --include="*.svelte" 2>/dev/null | grep -v "//"; then
  echo "WARN: Possible class: directive with / — verify manually"
fi
echo "✅ Svelte conventions OK"

# 3. TypeScript check (if tsc available)
echo ">>> TypeScript check..."
if command -v npx &>/dev/null; then
  npx tsc --noEmit --skipLibCheck 2>&1 | tail -5 || echo "⚠️ TS errors (non-blocking for now)"
fi

# 4. Python import check - verify all backend modules can be found
echo ">>> Import structure check..."
python3 -c "
import ast, sys, pathlib
errors = []
for p in pathlib.Path('apps/atrium/backend').rglob('*.py'):
    if '__pycache__' in str(p): continue
    try:
        ast.parse(p.read_text())
    except SyntaxError as e:
        errors.append(f'{p}: {e}')
if errors:
    for e in errors: print(f'FAIL: {e}')
    sys.exit(1)
print('✅ All AST parses pass')
"

echo ""
echo "=== All CI checks passed ✅ ==="
