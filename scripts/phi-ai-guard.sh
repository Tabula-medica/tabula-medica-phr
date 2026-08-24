#!/usr/bin/env bash
# PHI-AI boundary guard (portable CI regression control).
#
# PORTFOLIO RULE: PHI-bearing AI must go to Vertex AI (Google BAA) — never a
# non-BAA endpoint (OpenAI / Anthropic / the consumer Gemini API). This gate
# fails the build if a non-BAA AI endpoint URL appears in source, so a fix like
# the bp_cpt2 / Uninsurance-dedup ones can't silently regress.
#
# Scope + why it's low-false-positive: it matches only full `https://…` endpoint
# URLs, so it does NOT flag:
#   - bare-hostname denylist strings (e.g. "openai.com" in a vendor_guard), or
#   - the Vertex endpoint (aiplatform.googleapis.com), which is allowed.
# SDK-default leaks (`new OpenAI()`) are NOT caught by the URL scan — the SDK
# bakes api.openai.com in, so no URL ever appears in source. That gap was not
# theoretical: the Vertex shim meant to close it was never wired up, and ~280
# files sent PHI to OpenAI while this guard reported OK. The URL scan is kept,
# and the alias that actually routes those files to Vertex is now verified
# below.
#
# Usage: bash scripts/phi-ai-guard.sh   (exit 1 on a hit)
set -euo pipefail

# Non-BAA AI endpoints, as they appear in a URL. Add hosts here as needed.
PATTERN='https://[a-zA-Z0-9.-]*(api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|openai\.azure\.com)'

hits="$(grep -rnE "$PATTERN" \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' --include='*.py' \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build \
  --exclude-dir=.git --exclude-dir=__pycache__ \
  --exclude-dir=tests --exclude-dir=test --exclude-dir=__tests__ \
  --exclude-dir=demo-kit --exclude-dir=demo --exclude-dir=examples \
  . 2>/dev/null \
  | grep -vE ':[0-9]+:\s*(//|#|\*)' \
  | grep -viE '/tests?/|__tests__|_test\.|\.test\.|\.spec\.' \
  || true)"

if [ -n "$hits" ]; then
  echo "::error::PHI-AI GUARD FAILED — non-BAA AI endpoint URL(s) found. PHI-bearing AI must use Vertex (Google BAA)."
  echo "$hits"
  echo ""
  echo "If this is genuinely NON-PHI, route it through a reviewed non-PHI path and add a scoped exception; do not send PHI here."
  exit 1
fi

# --- The alias is the whole boundary; verify it exists ----------------------
# ~280 server files do `import OpenAI from "openai"`. The esbuild alias in
# script/build.ts is what redirects that to the Vertex shim. Without it the shim
# is unreachable and every one of those files reaches OpenAI directly.
if ! grep -qE 'alias:[[:space:]]*\{' script/build.ts 2>/dev/null ||
   ! grep -q 'server/lib/vertex-openai.ts' script/build.ts 2>/dev/null; then
  echo "::error::PHI-AI GUARD FAILED — script/build.ts no longer aliases \`openai\` to server/lib/vertex-openai.ts."
  echo "Without that alias the Vertex shim is dead code and PHI-bearing AI goes to OpenAI (no BAA)."
  exit 1
fi

# The shim must not import the aliased specifier, or it recurses into itself.
if grep -qE '^import[[:space:]]+[A-Za-z]+[[:space:]]+from[[:space:]]+"openai"' server/lib/vertex-openai.ts 2>/dev/null; then
  echo "::error::PHI-AI GUARD FAILED — server/lib/vertex-openai.ts imports the bare \`openai\` specifier."
  echo "With the alias active that resolves back to the shim itself. Import the real SDK by relative path."
  exit 1
fi

echo "PHI-AI guard: OK — no non-BAA endpoint URLs, and the openai->Vertex alias is in place."
