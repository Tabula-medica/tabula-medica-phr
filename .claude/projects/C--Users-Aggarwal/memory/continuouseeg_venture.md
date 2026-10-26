---
name: continuouseeg-venture
description: "ContinuEEG — ambulatory EEG monitoring venture; repos, mobile app, CF Pages deploy gates"
metadata:
  node_type: memory
  type: project
  originSessionId: current
---

New venture (2026-10-24): ContinuEEG — continuous/ambulatory EEG monitoring platform. Targets epilepsy patients, sleep disorder patients, cognitive health monitoring. Hook: traditional EEG = 20 minutes in a lab; ContinuEEG = 24/7 monitoring.

**Web repo:** `C:/Users/Aggarwal/repos/continuouseeg-web/` → GitHub `Tabula-medica/continuouseeg-web` (private)
- React + Vite + TypeScript + Tailwind v3
- Color scheme: navy #0D1B2A + teal #00C9B8
- 9 sections: Hero / ProblemSection / CeegFramework / SeizureRiskCalculator / CompatibleDevices / ResearchEvidence / DownloadSection / WaitlistSection / Footer
- SeizureRiskCalculator: 10-question weighted 0–100 risk index, 3 tiers (Low/Moderate/High), localStorage history (10 entries)
- CF Pages function: `functions/api/subscribe.ts` → KV binding `CEEG_WAITLIST`
- Build clean. **Deploy:** `wrangler pages deploy dist --project-name continuouseeg`
- Domain target: `continuouseeg.com` (not yet registered)

**Mobile repo:** `C:/Users/Aggarwal/repos/continuouseeg-app/` → GitHub `Tabula-medica/continuouseeg-app` (private)
- Expo SDK ~57.0.4, bundle `com.continuouseeg.app`, owner `rajivka2`
- 3-tab: Overview (native) / Seizure Risk Calculator (native, SecureStore history) / Research (WebView)
- EAS project ID: **`df1677e0-395f-4ae7-a475-53810d059371`** @rajivka2/continuouseeg (DONE 2026-10-26)
- ASC App ID: placeholder `0000000000` → CREATE app in ASC (com.continuouseeg.app, name=ContinuEEG) then update eas.json
- Permissions: BLE + Camera + Microphone + HealthKit + Motion

**Gates before first EAS build:**
1. ~~EAS init~~ DONE — project `df1677e0` linked 2026-10-26
2. Create ASC app (BROWSER: appstoreconnect.apple.com → + → iOS → bundle=com.continuouseeg.app, name=ContinuEEG) → update eas.json ascAppId from `0000000000`
3. Create Google Play app (BROWSER: play.google.com/console → Create app → com.continuouseeg.app)
4. Register domain `continuouseeg.com` (CF Registrar, user gate)
5. CF Pages KV bound as `CEEG_WAITLIST` ✓

**Compatible devices (Phase 1):** BrainBit, Muse S, OpenBCI Cyton. ContinuEEG Original hardware = Phase 2.
**Phases:** Phase 1 (INFERENCE_ENABLED=false) = data collection; Phase 2 = seizure/sleep/cognitive AI inference.

**Architecture pattern:** mirrors VISTA-PD (FastAPI backend + Expo mobile + CF Pages landing). Backend not yet scaffolded.

See [[vista_pd_venture]] [[parkinsons_rpm_project]]
