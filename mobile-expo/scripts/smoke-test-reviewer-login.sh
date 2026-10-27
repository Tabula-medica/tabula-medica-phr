#!/usr/bin/env bash
# Smoke-test the reviewer login flow against production.
# Usage: REVIEWER_EMAIL=... REVIEWER_PASSWORD=... ./scripts/smoke-test-reviewer-login.sh
# Optional: API_BASE=https://api.tabulamedica.health (default)
#
# Unit-test complement
# --------------------
# This script tests the live production endpoint end-to-end (real TLS, real DB,
# real session tokens, real demo-data seeding).  The paired in-process unit test
# is server/__tests__/reviewer-login.test.ts — it exercises the same
# POST /api/auth/login route in isolation using a fake reviewer email so it can
# run in CI without prod secrets.
# Keep the two in sync: any new behavior added to the login route (rate-limiting,
# IP allow-listing, new response fields, etc.) that one layer covers should also
# be reflected in the other, so they don't drift apart over time.
#
# SYNC-CHECK tags
# ---------------
# Each behavioral check below is annotated with a machine-readable tag:
#   # SYNC-CHECK: <id>
#   # SYNC-CHECK: <id> (live-only)
#
# The contract checker (server/__tests__/reviewer-login-contract.test.ts) reads
# this file and server/__tests__/reviewer-login.test.ts and verifies that every
# non-(live-only) tag appears in the unit test with a corresponding assertion.
# To ADD a new check here: add a SYNC-CHECK tag, add the same tag to the unit
# test with a matching assertion, then update the contract if needed.  CI will
# reject any push where a non-(live-only) tag is present here but absent there.
# The checker also reads the login handler's top-level JSON fields. New fields
# need a mapping in server/__tests__/helpers/login-response-contract.ts plus
# matching SYNC-CHECK assertions here and in the unit test.

set -u

API_BASE="${API_BASE:-https://api.tabulamedica.health}"

# Emergency bypass: set SKIP_REVIEWER_LOGIN_CHECK=1 when REVIEWER_EMAIL /
# REVIEWER_PASSWORD have not been propagated to the production Cloud Run
# service yet (e.g. initial deploy, credential rotation in progress).
# This mirrors the same escape-hatch in scripts/push-asc-metadata.mjs.
# The gate skips the live-prod curl checks and exits 0 with a loud warning.
# Remove / leave unset once the Cloud Run service has REVIEWER_EMAIL +
# REVIEWER_PASSWORD set to match the CI secrets.
if [ "${SKIP_REVIEWER_LOGIN_CHECK:-0}" = "1" ]; then
  echo "##################################################################"
  echo "WARNING: SKIP_REVIEWER_LOGIN_CHECK=1 — reviewer login check SKIPPED"
  echo "The reviewer demo account has NOT been verified against production."
  echo "Set REVIEWER_EMAIL + REVIEWER_PASSWORD on the Cloud Run service,"
  echo "then remove SKIP_REVIEWER_LOGIN_CHECK from CI secrets."
  echo "##################################################################"
  exit 0
fi

EMAIL="${REVIEWER_EMAIL:?Set REVIEWER_EMAIL env var}"
PASSWORD="${REVIEWER_PASSWORD:?Set REVIEWER_PASSWORD env var}"

pass=0
fail=0
ok()   { echo "  PASS  $1"; pass=$((pass+1)); }
bad()  { echo "  FAIL  $1"; fail=$((fail+1)); }

echo "==> Target: $API_BASE"
echo "==> Reviewer email: $EMAIL"
echo

# 1. /api/auth/login
echo "[1/4] POST /api/auth/login"
LOGIN_RESP=$(curl -sS -w "\n%{http_code}" -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
LOGIN_BODY=$(echo "$LOGIN_RESP" | sed '$d')
LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -n1)

# SYNC-CHECK: login-200
if [ "$LOGIN_CODE" = "200" ]; then
  ok "login returned 200"
else
  bad "login returned $LOGIN_CODE (expected 200)"
  echo "       body: $LOGIN_BODY" | head -c 400
  echo
  echo
  echo "Hint: 401 = REVIEWER_EMAIL/REVIEWER_PASSWORD not set in prod (or wrong values)."
  echo "      403 with TLS_VERSION_INSUFFICIENT = TLS 1.3 check failing — check load balancer."
  echo "      423 = brute-force lockout — wait or clear in-memory store."
  echo "      500 = backend error — check production logs."
  exit 1
fi

ACCESS_TOKEN=$(echo "$LOGIN_BODY" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
USER_ID=$(echo "$LOGIN_BODY" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

# SYNC-CHECK: access-token
if [ -n "$ACCESS_TOKEN" ]; then ok "received accessToken (${#ACCESS_TOKEN} chars)"
else bad "no accessToken in response"; fi

# SYNC-CHECK: user-id
if [ -n "$USER_ID" ]; then ok "received user.id ($USER_ID)"
else bad "no user.id in response"; fi

REFRESH_TOKEN=$(echo "$LOGIN_BODY" | sed -n 's/.*"refreshToken":"\([^"]*\)".*/\1/p')
# SYNC-CHECK: refresh-token
if [ -n "$REFRESH_TOKEN" ]; then ok "received refreshToken"
else bad "no refreshToken in response"; fi

# Missing credentials is a safe negative probe (no failed-password lockout).
ERROR_RESP=$(curl -sS -w "\n%{http_code}" -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" -d '{}')
ERROR_BODY=$(echo "$ERROR_RESP" | sed '$d')
ERROR_CODE=$(echo "$ERROR_RESP" | tail -n1)
# SYNC-CHECK: login-error
if [ "$ERROR_CODE" = "400" ] && \
  echo "$ERROR_BODY" | grep -Eq '"error"[[:space:]]*:[[:space:]]*"[^"]+"'; then
  ok "missing credentials returned 400 with error message"
else
  bad "missing credentials expected 400 with error message (got $ERROR_CODE)"
fi

AUTH=(-H "Authorization: Bearer $ACCESS_TOKEN")

# Require one JSON array of objects with IDs; nested IDs must not inflate counts.
count_ids() {
  jq -es '
    if length != 1 then error("expected one JSON array") else .[0] end
    | if type != "array" then error("expected an array") else . end
    | if all(.[]; type == "object" and .id != null)
      then [.[].id] | length
      else error("expected objects with IDs")
      end
  '
}

# 2. /api/auth/me (session verify) — tolerant of older deployments without /me
echo
echo "[2/4] GET /api/auth/me (session verify)"
ME_CODE=$(curl -sS -o /dev/null -w "%{http_code}" "${AUTH[@]}" "$API_BASE/api/auth/me")
# SYNC-CHECK: session-verify
if [ "$ME_CODE" = "200" ]; then
  ok "session verified via /api/auth/me"
elif [ "$ME_CODE" = "404" ]; then
  echo "  SKIP  /api/auth/me not deployed yet — falling back to /api/records check"
  pass=$((pass+1))
else
  bad "expected 200 or 404, got $ME_CODE"
fi

# 3. Demo data should be seeded — health records
echo
echo "[3/4] GET /api/records (demo data check)"
RECORDS_RESP=$(curl -sS -w "\n%{http_code}" "${AUTH[@]}" "$API_BASE/api/records")
RECORDS=$(printf '%s\n' "$RECORDS_RESP" | sed '$d')
RECORDS_CODE=$(printf '%s\n' "$RECORDS_RESP" | tail -n1)
# SYNC-CHECK: demo-records
if [ "$RECORDS_CODE" != "200" ]; then
  bad "records returned $RECORDS_CODE (expected 200)"
elif ! RECORD_COUNT=$(printf '%s\n' "$RECORDS" | count_ids); then
  bad "records response is not a valid JSON array of objects with IDs"
elif [ "$RECORD_COUNT" -ge 3 ]; then
  ok "$RECORD_COUNT health records present (demo data seeded)"
else
  bad "only $RECORD_COUNT records — demo seed may have failed"
  echo "       body: $(echo "$RECORDS" | head -c 300)"
fi

# 4. Data sources
echo
echo "[4/4] GET /api/data-sources"
DS_RESP=$(curl -sS -w "\n%{http_code}" "${AUTH[@]}" "$API_BASE/api/data-sources")
DS=$(printf '%s\n' "$DS_RESP" | sed '$d')
DS_CODE=$(printf '%s\n' "$DS_RESP" | tail -n1)
# SYNC-CHECK: data-sources (live-only)
# NOTE: /api/data-sources is only available in the live production environment;
# the in-process unit test cannot replicate this check without a production-grade
# data-source route. The demo seeding is verified via /api/records instead.
if [ "$DS_CODE" != "200" ]; then
  bad "data sources returned $DS_CODE (expected 200)"
elif ! DS_COUNT=$(printf '%s\n' "$DS" | count_ids); then
  bad "data sources response is not a valid JSON array of objects with IDs"
elif [ "$DS_COUNT" -ge 1 ]; then ok "$DS_COUNT data source(s) present"
else bad "no data sources — demo seed may have failed"; fi

echo
echo "================================"
echo "Passed: $pass    Failed: $fail"
echo "================================"
[ "$fail" -eq 0 ] && exit 0 || exit 1
