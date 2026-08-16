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
# It intentionally does NOT try to catch SDK-default leaks (`new OpenAI()` /
# `new Anthropic()`), which are guarded architecturally in code (shims/denylists)
# and are legitimate for non-PHI use — flagging them would be too noisy.
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

# Second check (P1-1.3) — RATCHET on the non-BAA Replit OpenAI proxy env
# (AI_INTEGRATIONS_OPENAI_*). ~213 existing files still reference it (they route to
# Vertex via the vertex-openai build shim at runtime, but that safety is implicit).
# They are grandfathered in scripts/phi-ai-allowlist.txt; no NEW file may add the
# proxy — migrate PHI-bearing callers to server/services/ai-gateway.ts instead.
# (`new OpenAI(...)` itself is intentionally NOT flagged: the build alias rewrites
#  it to the Vertex shim, so 300+ legitimate sites use it.)
ALLOWLIST="$(dirname "$0")/phi-ai-allowlist.txt"
new_proxy="$(grep -rlE "AI_INTEGRATIONS_OPENAI" server/ --include='*.ts' 2>/dev/null \
  | grep -v '\.test\.ts' \
  | grep -vFf "$ALLOWLIST" \
  || true)"
if [ -n "$new_proxy" ]; then
  echo "::error::PHI-AI GUARD FAILED — new file(s) reference the non-BAA AI_INTEGRATIONS_OPENAI proxy."
  echo "$new_proxy"
  echo ""
  echo "PHI-bearing AI must go through server/services/ai-gateway.ts (Vertex/BAA), not the proxy."
  exit 1
fi

echo "PHI-AI guard: OK — no non-BAA AI endpoint URLs, no new non-BAA proxy refs."
