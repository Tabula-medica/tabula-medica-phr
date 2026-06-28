#!/usr/bin/env bash
# Cloudflare DNS for the PHR .us / .world split → Cloud Run (tabula-medica-web).
# Idempotent: re-running is safe (updates existing records, creates missing).
#
# Usage:
#   export CF_API_TOKEN="..."        # Zone:DNS:Edit on tabulamedica.us + .world
#   ./cloudflare-phr-dns.sh us       # point tabulamedica.us live (grey-cloud)
#   ./cloudflare-phr-dns.sh world    # GUARDED: only after the EU geofence is in place
#
# WHY .us is grey-cloud (proxied=false): Cloud Run apex mappings serve their own
# managed TLS via Google's anycast IPs; proxying through Cloudflare (orange) would
# break the cert handshake unless CF SSL=Full(strict) is configured.
#
# WHY .world is GUARDED: the GDPR-defer plan requires blocking EU traffic. Edge
# geofencing needs CF proxy ON (orange), which is a DIFFERENT setup than .us.
# Do NOT point .world DNS until the geofence approach is chosen (see GO-LIVE-CHECKLIST.md).

set -euo pipefail

: "${CF_API_TOKEN:?Set CF_API_TOKEN (Zone:DNS:Edit on the two zones) before running}"
API="https://api.cloudflare.com/client/v4"
AUTH=(-H "Authorization: Bearer ${CF_API_TOKEN}" -H "Content-Type: application/json")

A_IPS=(216.239.32.21 216.239.34.21 216.239.36.21 216.239.38.21)
AAAA_IPS=(2001:4860:4802:32::15 2001:4860:4802:34::15 2001:4860:4802:36::15 2001:4860:4802:38::15)

target="${1:-}"
case "$target" in
  us)    ZONE="tabulamedica.us" ;;
  world)
    echo "!! .world is GUARDED. Confirm the EU geofence is live FIRST, then run:"
    echo "   CONFIRM_WORLD=yes ./cloudflare-phr-dns.sh world"
    [ "${CONFIRM_WORLD:-}" = "yes" ] || exit 1
    ZONE="tabulamedica.world" ;;
  *) echo "usage: $0 us|world"; exit 2 ;;
esac

zone_id=$(curl -s "${API}/zones?name=${ZONE}" "${AUTH[@]}" | python -c "import json,sys;d=json.load(sys.stdin);print(d['result'][0]['id'] if d.get('result') else '')")
[ -n "$zone_id" ] || { echo "Zone $ZONE not found / token lacks access"; exit 1; }
echo "Zone $ZONE -> $zone_id"

upsert() {  # type value
  local type="$1" value="$2"
  local existing
  existing=$(curl -s "${API}/zones/${zone_id}/dns_records?type=${type}&name=${ZONE}" "${AUTH[@]}" \
    | python -c "import json,sys;d=json.load(sys.stdin);print(next((r['id'] for r in d.get('result',[]) if r['content']=='${value}'),''))")
  local body
  body=$(printf '{"type":"%s","name":"%s","content":"%s","ttl":1,"proxied":false}' "$type" "$ZONE" "$value")
  if [ -n "$existing" ]; then
    curl -s -X PUT "${API}/zones/${zone_id}/dns_records/${existing}" "${AUTH[@]}" --data "$body" >/dev/null
    echo "  updated $type $value"
  else
    curl -s -X POST "${API}/zones/${zone_id}/dns_records" "${AUTH[@]}" --data "$body" >/dev/null
    echo "  created $type $value"
  fi
}

for ip in "${A_IPS[@]}";    do upsert A    "$ip"; done
for ip in "${AAAA_IPS[@]}"; do upsert AAAA "$ip"; done
echo "Done. Verify cert provisioning: gcloud beta run domain-mappings describe --domain ${ZONE} --region us-central1 --project united-planet-485003-n7"
