# `.local/deliverables/` — index

This directory holds session-spanning analysis documents, planning
artifacts, and audit reports referenced across the F1 program and
related initiatives. Files here are NOT shipped to production —
they are working documents for the agent + user collaboration.

---

## Canonical docs to consult at session start

When starting a new session, an agent should orient against these
master documents before diving into work:

- **`tm-comprehensive-roadmap.md`** — Master living roadmap (Phase A/B/C/D/E
  sessions, regulatory landscape, current TM state, action items table,
  next-immediate-actions). Maintained as the source of truth for what
  comes next.
- **`unified-architecture-plan.md`** — TM + Uninsurance "cousins"
  architecture. Care Access microservice phasing, cross-app data flow,
  shared infrastructure decisions.
- **`f1-status.md`** — F1 PHI encryption program current status.
  Per-session progress, cumulative violation counts, file inventory,
  next-file recommendations.
- **`f1-action-items.md`** — Action items queue (H through AE+). Filed
  with full background, scope, dependencies, severity. The discoverable
  backlog when sessions dispatch.
- **`health-mint-mining-report.md`** — Health Mint predecessor codebase
  feature mining report. 10 ranked features, 5 UX patterns, integration
  taxonomy, "do not port" list, LLM prompt-engineering patterns. Source
  for Phase C session scope decisions.

---

## Indexed deliverables

Other working documents in this directory:

### Architecture & roadmap
- `tm-comprehensive-roadmap.md` — see canonical list above (505 lines)
- `health-mint-mining-report.md` — see canonical list above (498 lines)
- `unified-architecture-plan.md` — see canonical list above

### F1 PHI encryption program
- `f1-status.md` — see canonical list above
- `f1-action-items.md` — see canonical list above
- `f1-encryption-plan.md` — original F1 program plan
- `f1-encryption-plan-v2.md` — revised F1 plan
- `f1-schema-audit.md` — schema-side PHI inventory
- `f1-remaining-violations-triage.md` — backlog triage
- `f1-triage-A-phi-interpolation.txt` / `f1-triage-B-via-services.txt`
  / `f1-triage-union-honest-scope.txt` — triage worksheets
- `action-item-H-plaintext-backfill.md` — Action Item H detail

### Marketing & campaign kits
- `unraj-seedance/` — Seedance 2.0 video kit for unraj.org (Koh-i-Noor
  repatriation campaign): prompts, Higgsfield MCP runbook, fal.ai batch
  generator, ffmpeg encode pipeline, drop-in hero components, QA checklist

### Compliance & audit
- `accessibility-audit-session-6.md` — WCAG audit findings (Action Item U)
- `audit-methodology-notes.md` — audit approach + conventions
- `key-management-audit.md` — key rotation + escrow analysis
- `netwitness-siem-gap-analysis.md` — detection & response gap analysis
  (Action Item AH). Maps a healthcare SIEM checklist against TM's real
  logging/alerting posture: audit-sink retention defect, absent alert
  policies, seeded demo telemetry on compliance surfaces. Includes
  TM/UI/SAWD applicability and a do-not-buy recommendation.
- `vitest-runner-health-check.md` — Action Item V findings
- `object-form-conversion-template.md` — logger conversion reference
  (Action Item K / T methodology)

### Submissions & narratives
- `app-store-submission.md` — Apple App Store submission notes
- `capacitor-build-playbook.md` — iOS/Android Capacitor build runbook
- `google-for-startups-narrative.md` — funding pitch material

### Product initiatives
- `roblox-healthcare-games-concept.md` — "World Clinic" Roblox
  integration: PHI-free reward-relay architecture, backend routes
  (`server/roblox-education-link-routes.ts`), dashboard tab, and the
  `roblox/` Rojo project with 3 working mini-games
- `roblox-hedis-future-health.md` — "Future Health": HEDIS
  measure *concepts* taught via fictional NPC patients, rules-based star
  rating of the player's own pretend clinic, AI (Vertex, PHI-free) used only
  for Nova's coaching tips; explains why real-provider HEDIS rating was
  deliberately kept out of the kids' game
- `roblox-campus-life-concept.md` — "World Clinic: Campus Life"
  (`roblox-campus/`, `server/roblox-campus-routes.ts`): the teen/college/
  newlywed tier as a SEPARATE Roblox place (content-maturity labeling), with
  its own preventive-care measure catalog (mental health, sexual health,
  substance-use screening, sports physicals, family planning, insurance
  literacy) handled per Roblox's teen-content boundary
- `life-stage-challenges-concept.md` — "Life Stage Health Challenges"
  (`server/life-stage-challenges-routes.ts`, `/life-stage` page): decade-
  banded preventive-care nudges for 50+ users inside the main app (not
  Roblox — that audience isn't there), auto-tiered from the profile's real
  date of birth

---

## Notes on document maintenance

- The roadmap doc (`tm-comprehensive-roadmap.md`) is treated as a
  living document per its own Section H. Updates land after each
  completed session (move from "queued" to "completed", update F1
  cumulative count, add new action items if surfaced).
- Action items are filed in `f1-action-items.md` using the canonical
  template (background, scope, dependencies, severity, connections to
  other items, "why filed and not done now").
- This README is the discoverability index. New deliverables added to
  this directory should also be indexed here at the time of filing.
