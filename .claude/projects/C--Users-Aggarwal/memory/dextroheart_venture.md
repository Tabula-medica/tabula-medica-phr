---
name: dextroheart-venture
description: "DextroHeart — 14-lead ECG acquisition device; master plan, mobile app, store submission state"
metadata:
  node_type: memory
  type: project
  originSessionId: current
---

DextroHeart v1 — palm-sized BLE ECG module targeting inferior/RV/posterior infarction detection (the territories standard 12-lead misses in ~85% of patients with dominant RCA). Owned by Tabula Medica LLC. Domain: dextroheart.com held.

**Master plan:** `Desktop/DextroHeart_Master_Plan.md` (v1.0, 2026-10-17) — single source of truth. Supersedes all prior bench HTML builds.

**Current phase:** Gate A (Oct–Nov 2026) — Define.
- Gate A exit requires: O1 predicate selection (Wellue/Viatom vs Eko CORE vs AliveCor 6L), O2 Tier-A decision (hardware-ready+software-locked recommended), trademark filing, regulatory consultant hired.
- Gate C (Nov–Dec 2026) = ADS1298 eval board + nRF52840 DK bench proof. **No PCB order until Gate C passes.**

**Web landing page:** `C:/Users/Aggarwal/repos/dextroheart-web/` — Vite+React+TS+Tailwind, LIVE at `Tabula-medica/dextroheart-web` (GitHub, private). CI passes (npm build). CF Pages deploy gated on CF Pages token — ops token (stored in CLOUDFLARE_API_TOKEN secret) is read-only (code: 9106); user must update the `CLOUDFLARE_API_TOKEN` repo secret with a token that has `Pages:Edit` permission, then re-run the deploy workflow. CF Pages project name: `dextroheart`.

**Mobile app:** `C:/Users/Aggarwal/repos/dextroheart-mobile/` — Expo SDK 57, bundle `com.dextroheart.app`, EAS project `c1c1bb63-b780-48eb-a920-118ce1a890b7` (@rajivka2/dextroheart).

**Store submission state (as of 2026-10-24):**
- iOS build 2 (buildId `e8fd908c-a1d1-4165-b9c4-7096ebe0fa3e`) **already in ASC** (ASC App ID `6824245200`). Gate: open ASC apps/6824245200 → submit for review.
- Android versionCode 4 (buildId `260d80d8-07fa-40c2-9012-1ad84ba6521e`) **already in Play Console** (`com.dextroheart.app`). Gate: Play Console → promote to Production.
- Both stores: builds from 2026-10-18, IPA + AAB ready. Submitting again would need new build numbers.

**Eval kit orders (Gate A → C):**
- ADS1298 PDK (~$700) — cascaded pair for 13-channel DHB2 bench proof
- nRF52840 DK (~$50) — BLE throughput measurement
- These are allowed NOW; PCB order gated behind Gate C pass

**Hardware architecture (frozen):** nRF52840 (Raytac MDBT50Q) + 2× TI ADS1298 + Zephyr RTOS + DHB2 protocol + battery-isolated during acquisition. Profile system: right14 (marketed v1) + combined17 (software-enabled).

**Bench artifacts:**
- `DextroHeart_Bench (3).html` (Build 0.2) = canonical DHB2 protocol + profile system
- `DextroHeart_Workbench.html` = research viewer  
- `ekg-14lead` / `ekg14-cardio` packages = analysis layer (ventures/ dir)
- All v0.1 bench copies + ef35 bundles → RETIRE per master plan

**Budget to 510(k) clearance:** ~$450k. Target: Jan 2028 launch (14 months from Gate C completion).

See [[energystoragedisease-state]] (same Tabula Medica LLC umbrella)
