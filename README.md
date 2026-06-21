# Tabula Medica — Unified Version

**This is the canonical, unified Tabula Medica repository.**

All Tabula Medica source code lives here:

- **Web app** — Express server (`server/`) + React/TypeScript client (`client/`)
- **Mobile app** — Expo React Native project (`tabula-medica-mobile/`)
- **Native iOS / Android** — Capacitor wrapper config + native build artifacts (`capacitor.config.ts`, `ios/`, `android/`)
- **Shared schema, services, and types** — (`shared/`, `modules/`)
- **F1 encryption program, legal routes, CI pipeline** — (`.local/deliverables/`, `.github/workflows/`)

## What about the "mobile version" Replit project?

**Deprecated.** A separate Replit project previously held a duplicate of the mobile codebase along with EAS build credentials (`EXPO_TOKEN`, Apple ID, ASC App ID, Apple Team ID). It is now redundant — **no new development happens there**.

Its only remaining role until full retirement is as the EAS build trigger point. The workflow is:

1. In the mobile Replit shell: `git pull` (pulls the latest commit from this repo)
2. `eas build --platform ios --profile production` (uses the credentials configured there)
3. `eas submit --platform ios --latest`

Action Item **AF** in `.local/deliverables/f1-action-items.md` tracks the consolidation work to move EAS credentials directly into this Replit so the mobile Replit can be fully archived.

## Canonical documentation

- `replit.md` — codebase topology, architecture, recent changes
- `.local/deliverables/README.md` — index of long-form deliverables
- `.local/deliverables/tm-comprehensive-roadmap.md` — master living roadmap
- `.local/deliverables/f1-action-items.md` — F1 encryption program backlog (AA–AF filed)
- `.local/deliverables/f1-status.md` — F1 program status
- `.local/deliverables/health-mint-mining-report.md` — feature mining report
- `.local/deliverables/unified-architecture-plan.md` — Tabula Medica + Uninsurance unified plan

## Recent unified-version milestones

- `2e9df14a` — TMD-4 Phase 2: disabled `newArchEnabled` for iPad compatibility (addresses App Store submission `69f718ee` rejection on iPad Air 11" M3 / iPadOS 26.4.1)
- Previous: F1 PHI encryption guardrail program in progress (84 violations remaining of original 102+)

## Sister projects (separate repos / Replits)

- **Uninsurance** — Virginia DMPO-pending membership product. Owned by Uninsurance LLC. Separate codebase, separate Replit, separate deployment, separate Stripe merchant account, separate App Store listing. Cross-app integration with Tabula Medica is planned via SMART on FHIR (Phase 1 of `unified-architecture-plan.md`) but not yet active.
