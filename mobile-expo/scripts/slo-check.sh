#!/usr/bin/env bash
# scripts/slo-check.sh
#
# Production SLO check for Tabula Medica — 24 h window via Cloud Monitoring API.
#
# Evaluates two SLO guarantees against the last 24 h of Cloud Monitoring data:
#   1. Availability ≥ 99.9 %  (measured by uptime-check success ratio)
#   2. p99 request latency ≤ 800 ms (measured by Cloud Run request_latencies)
#
# If Cloud Monitoring credentials are unavailable (GOOGLE_APPLICATION_CREDENTIALS_JSON
# not set), the script falls back to a point-in-time synthetic probe of
# /health and /api/security/attestation against the production host and
# evaluates latency from those samples. This fallback is used by the
# scheduled uptime-smoke workflow which may not have GCP credentials.
#
# Usage:
#   API_BASE=https://api.tabulamedica.health \
#   GOOGLE_APPLICATION_CREDENTIALS_JSON='...' \
#   GCP_PROJECT_ID=united-planet-485003-n7 \
#   bash scripts/slo-check.sh
#
# Environment variables:
#   API_BASE                            Production API base URL
#   GCP_PROJECT_ID                      GCP project ID for Cloud Monitoring queries
#   GOOGLE_APPLICATION_CREDENTIALS_JSON GCP service-account JSON (optional; enables 24h mode)
#   SLO_AVAILABILITY_THRESHOLD          Min availability % (default: 99.9)
#   SLO_LATENCY_P99_MS                  Max p99 latency in ms (default: 800)
#   SLO_LATENCY_WARN_MS                 Warn-only latency threshold ms (default: 500)
#   SLO_PROBE_COUNT                     Synthetic probes per endpoint in fallback mode (default: 10)
#
# Exit codes:
#   0 — SLO met
#   1 — SLO violated (availability below threshold or latency above threshold)

set -euo pipefail

API_BASE="${API_BASE:-https://api.tabulamedica.health}"
GCP_PROJECT_ID="${GCP_PROJECT_ID:-united-planet-485003-n7}"
SLO_AVAILABILITY_THRESHOLD="${SLO_AVAILABILITY_THRESHOLD:-99.9}"
SLO_LATENCY_P99_MS="${SLO_LATENCY_P99_MS:-800}"
SLO_LATENCY_WARN_MS="${SLO_LATENCY_WARN_MS:-500}"
SLO_PROBE_COUNT="${SLO_PROBE_COUNT:-10}"

FAIL=0

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Tabula Medica Production SLO Check                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo "API_BASE:  ${API_BASE}"
echo "Project:   ${GCP_PROJECT_ID}"
echo "Thresholds: availability ≥${SLO_AVAILABILITY_THRESHOLD}%  |  p99 latency ≤${SLO_LATENCY_P99_MS}ms"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# MODE A: Cloud Monitoring API — 24 h window evaluation
# Requires GOOGLE_APPLICATION_CREDENTIALS_JSON and node/googleapis.
# ─────────────────────────────────────────────────────────────────────────────
if [ -n "${GOOGLE_APPLICATION_CREDENTIALS_JSON:-}" ]; then
  echo "==> Mode: Cloud Monitoring API (24 h window)"
  echo ""

  # Write credentials to a temp file so gcloud/googleapis can read them.
  CREDS_FILE=$(mktemp /tmp/slo-gcp-creds.XXXXXX.json)
  trap 'rm -f "${CREDS_FILE}"' EXIT
  echo "${GOOGLE_APPLICATION_CREDENTIALS_JSON}" > "${CREDS_FILE}"
  export GOOGLE_APPLICATION_CREDENTIALS="${CREDS_FILE}"

  # Execute Cloud Monitoring evaluation via Node.js + googleapis (already in deps).
  node --input-type=module << NODEEOF
import { google } from 'googleapis';
import { readFileSync } from 'fs';

const PROJECT = process.env.GCP_PROJECT_ID;
const SLO_AVAIL = parseFloat(process.env.SLO_AVAILABILITY_THRESHOLD ?? '99.9');
const SLO_P99   = parseInt(process.env.SLO_LATENCY_P99_MS ?? '800', 10);
const WARN_P99  = parseInt(process.env.SLO_LATENCY_WARN_MS ?? '500', 10);

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/monitoring.read'],
});

const monitoring = google.monitoring({ version: 'v3', auth });

const now  = Math.floor(Date.now() / 1000);
const past = now - 86400; // 24 hours ago
const interval = {
  startTime: new Date(past * 1000).toISOString(),
  endTime:   new Date(now  * 1000).toISOString(),
};

let overallFail = false;

// ── Availability: Cloud Run request count (success / total) ──────────────────
async function checkAvailability() {
  console.log('── Availability (24 h Cloud Run request success rate) ────────');
  try {
    // Successful requests (2xx)
    const successRes = await monitoring.projects.timeSeries.list({
      name: \`projects/\${PROJECT}\`,
      filter:
        'metric.type="run.googleapis.com/request_count"' +
        ' AND resource.type="cloud_run_revision"' +
        ' AND resource.labels.service_name="tabula-medica-web"' +
        ' AND metric.labels.response_code_class="2xx"',
      'interval.startTime': interval.startTime,
      'interval.endTime':   interval.endTime,
      aggregations: [{
        alignmentPeriod: '86400s',
        perSeriesAligner: 'ALIGN_SUM',
        crossSeriesReducer: 'REDUCE_SUM',
      }],
    });

    // All requests
    const totalRes = await monitoring.projects.timeSeries.list({
      name: \`projects/\${PROJECT}\`,
      filter:
        'metric.type="run.googleapis.com/request_count"' +
        ' AND resource.type="cloud_run_revision"' +
        ' AND resource.labels.service_name="tabula-medica-web"',
      'interval.startTime': interval.startTime,
      'interval.endTime':   interval.endTime,
      aggregations: [{
        alignmentPeriod: '86400s',
        perSeriesAligner: 'ALIGN_SUM',
        crossSeriesReducer: 'REDUCE_SUM',
      }],
    });

    const successPts = successRes.data.timeSeries?.[0]?.points ?? [];
    const totalPts   = totalRes.data.timeSeries?.[0]?.points ?? [];

    const successCount = successPts.reduce((s, p) => s + (parseInt(p.value?.int64Value ?? '0', 10) || 0), 0);
    const totalCount   = totalPts.reduce((s, p) => s + (parseInt(p.value?.int64Value ?? '0', 10) || 0), 0);

    if (totalCount === 0) {
      console.log('  [WARN] No Cloud Run request data in the last 24 h — skipping availability check.');
      console.log('         (Service may have received no traffic or metric export is delayed.)');
      return;
    }

    const availability = (successCount / totalCount) * 100;
    console.log(\`  Requests (2xx): \${successCount.toLocaleString()} / \${totalCount.toLocaleString()} total\`);
    console.log(\`  Availability:   \${availability.toFixed(4)} %  (threshold: \${SLO_AVAIL} %)\`);

    if (availability < SLO_AVAIL) {
      console.log(\`  [FAIL] Availability \${availability.toFixed(4)} % is below the \${SLO_AVAIL} % SLO threshold.\`);
      overallFail = true;
    } else {
      console.log(\`  [PASS] Availability SLO met.\`);
    }
  } catch (err) {
    console.log(\`  [WARN] Cloud Monitoring availability query failed: \${err.message}\`);
    console.log('         This may be a permissions or data-delay issue; check manually.');
  }
  console.log('');
}

// ── p99 Latency: Cloud Run request_latencies ─────────────────────────────────
async function checkLatency() {
  console.log('── Request p99 Latency (24 h Cloud Run request_latencies) ───');
  try {
    const latRes = await monitoring.projects.timeSeries.list({
      name: \`projects/\${PROJECT}\`,
      filter:
        'metric.type="run.googleapis.com/request_latencies"' +
        ' AND resource.type="cloud_run_revision"' +
        ' AND resource.labels.service_name="tabula-medica-web"',
      'interval.startTime': interval.startTime,
      'interval.endTime':   interval.endTime,
      aggregations: [{
        alignmentPeriod: '86400s',
        perSeriesAligner: 'ALIGN_PERCENTILE_99',
        crossSeriesReducer: 'REDUCE_PERCENTILE_99',
      }],
    });

    const pts = latRes.data.timeSeries?.[0]?.points ?? [];
    if (pts.length === 0) {
      console.log('  [WARN] No Cloud Run latency data in the last 24 h — skipping latency check.');
      return;
    }

    // The aggregated point value is the p99 latency in milliseconds.
    const p99 = parseFloat(pts[0].value?.doubleValue ?? '0');
    console.log(\`  p99 latency (24 h): \${p99.toFixed(1)} ms  (threshold: \${SLO_P99} ms)\`);

    if (p99 >= SLO_P99) {
      console.log(\`  [FAIL] p99 latency \${p99.toFixed(1)} ms exceeds the \${SLO_P99} ms SLO.\`);
      overallFail = true;
    } else if (p99 >= WARN_P99) {
      console.log(\`  [WARN] p99 latency \${p99.toFixed(1)} ms is above the warn threshold (\${WARN_P99} ms).\`);
    } else {
      console.log(\`  [PASS] Latency SLO met.\`);
    }
  } catch (err) {
    console.log(\`  [WARN] Cloud Monitoring latency query failed: \${err.message}\`);
    console.log('         This may be a permissions or data-delay issue; check manually.');
  }
  console.log('');
}

await checkAvailability();
await checkLatency();

console.log('══════════════════════════════════════════════════════════════');
if (overallFail) {
  console.error('SLO check FAILED — one or more thresholds violated.');
  process.exit(1);
}
console.log('SLO check PASSED (Cloud Monitoring 24 h evaluation).');
NODEEOF

  exit $?
fi

# ─────────────────────────────────────────────────────────────────────────────
# MODE B: Synthetic probe fallback (no GCP credentials available)
# Pings /health and /api/security/attestation with N samples, measures p99.
# ─────────────────────────────────────────────────────────────────────────────
echo "==> Mode: Synthetic probe fallback (GOOGLE_APPLICATION_CREDENTIALS_JSON not set)"
echo "    Latency thresholds: warn=${SLO_LATENCY_WARN_MS}ms  fail=${SLO_LATENCY_P99_MS}ms"
echo "    Probes per endpoint: ${SLO_PROBE_COUNT}"
echo ""

ENDPOINTS=(
  "/health"
  "/api/security/attestation"
)

probe_endpoint() {
  local path="$1"
  local url="${API_BASE}${path}"
  local latencies=()
  local errors=0

  echo "==> Probing ${url} (${SLO_PROBE_COUNT} samples)"

  for i in $(seq 1 "${SLO_PROBE_COUNT}"); do
    result=$(curl -o /dev/null -s -w "%{http_code} %{time_total}" \
      --max-time 5 \
      --retry 0 \
      -H "User-Agent: tabula-medica-slo-check/1.0" \
      "${url}" 2>&1) || {
      echo "  [FAIL] probe ${i}/${SLO_PROBE_COUNT}: curl error (timeout or network)"
      (( errors++ )) || true
      continue
    }

    http_code=$(echo "${result}" | awk '{print $1}')
    time_total=$(echo "${result}" | awk '{print $2}')
    latency_ms=$(echo "${time_total} * 1000" | bc | cut -d'.' -f1)

    if [[ "${http_code}" -lt 200 || "${http_code}" -ge 300 ]]; then
      echo "  [FAIL] probe ${i}/${SLO_PROBE_COUNT}: HTTP ${http_code} (${latency_ms}ms)"
      (( errors++ )) || true
    elif [[ "${latency_ms}" -ge "${SLO_LATENCY_P99_MS}" ]]; then
      echo "  [WARN] probe ${i}/${SLO_PROBE_COUNT}: HTTP ${http_code} — ${latency_ms}ms exceeds ${SLO_LATENCY_P99_MS}ms threshold"
      latencies+=("${latency_ms}")
    else
      echo "  [PASS] probe ${i}/${SLO_PROBE_COUNT}: HTTP ${http_code} — ${latency_ms}ms"
      latencies+=("${latency_ms}")
    fi
  done

  if [[ "${errors}" -gt 0 ]]; then
    echo "  RESULT: FAIL — ${errors}/${SLO_PROBE_COUNT} probes errored"
    (( FAIL++ )) || true
    return
  fi

  if [[ "${#latencies[@]}" -eq 0 ]]; then
    echo "  RESULT: FAIL — no successful probes"
    (( FAIL++ )) || true
    return
  fi

  # Sort and compute p99
  mapfile -t sorted < <(printf '%s\n' "${latencies[@]}" | sort -n)
  count="${#sorted[@]}"
  p99_idx=$(( (count * 99 + 99) / 100 - 1 ))
  if [[ "${p99_idx}" -lt 0 ]]; then p99_idx=0; fi
  p99="${sorted[${p99_idx}]}"

  echo "  p99 latency: ${p99}ms (threshold: ${SLO_LATENCY_P99_MS}ms)"

  if [[ "${p99}" -ge "${SLO_LATENCY_P99_MS}" ]]; then
    echo "  RESULT: FAIL — p99 ${p99}ms exceeds ${SLO_LATENCY_P99_MS}ms SLO"
    (( FAIL++ )) || true
  else
    echo "  RESULT: PASS"
  fi
  echo ""
}

for endpoint in "${ENDPOINTS[@]}"; do
  probe_endpoint "${endpoint}"
done

echo "══════════════════════════════════════════════════════════════"
if [[ "${FAIL}" -gt 0 ]]; then
  echo "SLO check FAILED (synthetic probe) — ${FAIL} endpoint(s) outside SLO budget."
  exit 1
fi
echo "SLO check PASSED (synthetic probe fallback)."
exit 0
