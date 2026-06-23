#!/bin/bash
# Complete the Cloud SQL password rotation for the PHR (tabula-medica-db).
# Temp-file-free (avoids Windows/git-bash /tmp mismatch): old URL + new URL pass through
# shell variables. Safe order: build new URL (read-only) -> change DB password -> add new
# secret version -> redeploy the two services. Password never echoed. ~1-2 min blip on redeploy.
#   Run:  bash rotate-db.sh
set -euo pipefail

PROJ=united-planet-485003-n7
INST=tabula-medica-db
SECRET=patient-db-secret-us-central1
SERVICES=(tabula-medica-backend tabula-medica-service)

echo "1) reading current DATABASE_URL + building the new one (fresh 32-char password)…"
OLDURL="$(gcloud secrets versions access latest --secret="$SECRET" --project "$PROJ")"
NEWPW="$(python -c 'import secrets,string;print("".join(secrets.choice(string.ascii_letters+string.digits) for _ in range(32)))')"
NEWURL="$(OLDURL="$OLDURL" NEWPW="$NEWPW" python - <<'PY'
import os
from urllib.parse import urlsplit, urlunsplit, quote
old = os.environ["OLDURL"].strip()
assert old.startswith("postgres"), "unexpected DATABASE_URL scheme"
u = urlsplit(old); host = u.hostname or ""; port = f":{u.port}" if u.port else ""
nn = f'{u.username}:{quote(os.environ["NEWPW"], safe="")}@{host}{port}'
print(urlunsplit((u.scheme, nn, u.path, u.query, u.fragment)))
PY
)"
[ -n "$NEWURL" ] || { echo "   failed to build new URL — aborting, nothing changed"; exit 1; }
echo "   new URL built (host/socket + db preserved)."

echo "2) setting the Cloud SQL 'postgres' password…"
gcloud sql users set-password postgres --instance="$INST" --project "$PROJ" --password="$NEWPW" --quiet
echo "   DB password changed."

echo "3) adding the new DATABASE_URL as a new secret version…"
printf '%s' "$NEWURL" | gcloud secrets versions add "$SECRET" --project "$PROJ" --data-file=- >/dev/null
echo "   secret updated."

echo "4) redeploying the services that use the DB…"
for S in "${SERVICES[@]}"; do
  gcloud run services update "$S" --region us-central1 --project "$PROJ" \
    --update-secrets "DATABASE_URL=$SECRET:latest" --quiet >/dev/null
  echo "   redeployed $S"
done
unset NEWPW NEWURL OLDURL

echo "5) health check:"
for S in "${SERVICES[@]}"; do
  echo "   $S -> $(gcloud run services describe "$S" --region us-central1 --project "$PROJ" --format='value(status.conditions[0].status)')"
done
echo "Done — leaked password retired."
