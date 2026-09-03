#!/usr/bin/env bash
# SOC 2 A1.2 / A1.3 / CC9.1 — enable Cloud SQL automated backups + point-in-time recovery,
# then guide a documented restore test (OWNER runs). Cloud SQL for PostgreSQL.
#
# Prereqs: `gcloud auth login` as an owner of sawd-ai.
# Usage:   bash setup-cloudsql-backups.sh
set -euo pipefail

PROJECT="sawd-ai"
INSTANCE="sawd-pg"                 # instance id (full conn: sawd-ai:us-central1:sawd-pg)

echo "→ enabling daily backups + PITR on ${PROJECT}:${INSTANCE}"
gcloud sql instances patch "$INSTANCE" --project "$PROJECT" \
  --backup-start-time=08:00 \
  --enable-point-in-time-recovery \
  --retained-backups-count=30 \
  --retained-transaction-log-days=7 \
  --quiet

echo "✓ backups on (30 kept), PITR on (7 days of WAL)."
echo
echo "RESTORE TEST (do this once and save the output as A1.3 evidence):"
echo "  # pick a timestamp a few minutes ago, RFC3339 UTC, e.g. 2026-09-03T18:00:00Z"
echo "  gcloud sql instances clone $INSTANCE ${INSTANCE}-restoretest \\"
echo "    --point-in-time=<RFC3339-UTC> --project $PROJECT"
echo "  # verify row counts on the clone, then delete it:"
echo "  gcloud sql instances delete ${INSTANCE}-restoretest --project $PROJECT --quiet"
echo
echo "Also stand up an INDEPENDENT backup of any Base44-held data (export → GCS), since PITR"
echo "only covers the Cloud SQL instance. Record RTO/RPO in business-continuity-disaster-recovery-policy.md."
