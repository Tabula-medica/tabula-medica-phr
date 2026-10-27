# Patient merge linkage

## Canonical owner

A patient profile has one unique `user_id`. The survivor's profile ID is the
canonical MPI identity and its **existing user ID** owns the unified clinical
history. Do not write a patient-profile ID into a clinical `user_id` column.
Neither user account nor profile is deleted; authentication identities, sessions,
roles, consents, historical audit actors and sharing grants are not account-merged.
The merged profile remains as the demographic snapshot source. An active merge
history entry prevents it from participating in another merge in either direction.

## Transfer boundary

`server/patient-merge-records.ts` is the explicit clinical-subject allowlist.
It moves records, attachments, source provenance, import/sync job history,
harmonized data, conflicts, reports/insights, goals/progress, medications/adherence,
appointments, conversations, care plans/journeys, sensor observations, episodes,
journals, encounters/actions, intakes, lab orders, case summaries/research and
care-plan notes and provider-authored clinical rows whose `patient_id` refers to a **user**, not a
profile (some legacy columns do not declare a foreign key). Provider/author IDs stay intact.
Child rows keyed only by a record, conversation, plan, episode, or visit ID follow
unchanged because parent IDs do not change (including resource version history).
Attachment object paths and bytes are not rewritten.

This is clinical-history consolidation, not consolidation of credentials or
authorization. Payer/Fasten/device credentials, provider organization access,
care-team grants, share links/packets, family/pet records, account preferences,
gamification and immutable compliance logs remain with their original accounts.
Source rows (including their existing source credentials) move with records so
source ownership stays consistent; other
external connections require an explicit reconnect/account-transition policy.
No similar-looking clinical rows are deleted or collapsed.

## Atomicity and audit/reversal

The demographics update, identifier transfer, clinical transfer, merge history,
candidate statuses and audit insertion share one database transaction. A failure
rolls back everything. Profile and user locks serialize overlapping merges and
block new FK inserts during the transfer. Writers resuming **after** the commit
must use the surviving account; this operation does not redirect old sessions or
background connection workers.

The existing demographic `merged_data` snapshot keeps its top-level fields for
compatibility and adds `clinicalTransfer`:

- `version`: manifest format version (currently 1)
- `fromUserId` / `toUserId`: original and surviving user IDs
- `tables`: physical table name → `ownerColumn` and exact moved `rowIds`

Empty tables are recorded too. IDs come from `UPDATE RETURNING`, not counts or
a pre-update guess. `match_details.transferredIdentifierIds` records identifier
IDs, while `field_resolutions` records original survivor/merged demographic values.
Audit metadata includes per-table transfer counts without duplicating clinical
content or source credentials.

There is no public undo endpoint. An authorized, reviewed reversal must process
later merges first, verify every manifest row still belongs to `toUserId`, and
restore **only those IDs** to `fromUserId` in a transaction, along with identifiers
and appropriate demographic resolutions. Never reverse using a blanket
`WHERE user_id = survivor`: that would take the survivor's original/new records.
Retain both users/profiles and the history; do not delete the losing account as
part of this operation. External side effects and later edits require separate
review before reversal.
