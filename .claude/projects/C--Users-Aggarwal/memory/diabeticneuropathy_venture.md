---
name: diabeticneuropathy-venture
description: "Diabetic Neuropathy / MNI venture — educational reframe, MNSI calculator, repos, CF Pages deploy gates"
metadata:
  node_type: memory
  type: project
  originSessionId: current
---

New venture (2026-10-24): Diabetic Neuropathy reframed as "Metabolic Nerve Injury" (MNI) — same paradigm shift as ESD (T2D → Energy Storage Disease). Hook: "Diabetic neuropathy" is named after who gets it, not why. 50% of T2D patients develop it; by the time tingling appears, up to 50% of small nerve fibers may already be damaged. MNI is reversible with metabolic correction.

**Web repo:** `C:/Users/Aggarwal/repos/diabeticneuropathy-web/` → GitHub `Tabula-medica/diabeticneuropathy-web` (private)
- React + Vite + TypeScript + Tailwind v3
- Color scheme: burgundy #7B1E2D + amber #D4A017 + cream #FAF7F0
- 10 sections: Hero / ProblemSection / MniFramework / MnsiCalculator / LabMarkers / ReversalEvidence / ForWhom / DownloadSection / WaitlistSection / Footer
- **MnsiCalculator:** Full 7-question validated MNSI (Michigan Neuropathy Screening Instrument), localStorage history (10 entries), trend indicators, 3 categories: Normal 0–2 / Borderline 3–4 / High Risk 5–7
- **LabMarkers:** HbA1c / fasting glucose / B12 / methylmalonic acid / homocysteine / ABI with target ranges
- CF Pages function: `functions/api/subscribe.ts` → KV binding `DPN_WAITLIST`
- Build clean. **Deploy:** `wrangler pages deploy dist --project-name diabeticneuropathy`
- Domain target: `diabeticneuropathy.com` (not yet registered)

**Mobile repo:** `C:/Users/Aggarwal/repos/diabeticneuropathy-app/` → GitHub `Tabula-medica/diabeticneuropathy-app` (private)
- Expo SDK ~57.0.4, bundle `com.diabeticneuropathy.app`, owner `rajivka2`
- 3-tab: Home (native overview) / MNSI Calculator (native, SecureStore history 10 entries, auto-advance Q7 reverse-scored) / Research (WebView)
- EAS project ID: **`1d7fc34b-f5aa-4de4-9146-dedac99baffb`** @rajivka2/diabeticneuropathy (DONE 2026-10-26)
- ASC App ID: placeholder `0000000000` → CREATE app in ASC (com.diabeticneuropathy.app, name=Diabetic Neuropathy) then update eas.json
- Permissions: HealthKit + Motion + Notifications

**Gates before first EAS build:**
1. ~~EAS init~~ DONE — project `1d7fc34b` linked 2026-10-26
2. Create ASC app (BROWSER: appstoreconnect.apple.com → + → iOS → bundle=com.diabeticneuropathy.app, name=Diabetic Neuropathy) → update eas.json ascAppId from `0000000000`
3. Create Google Play app (BROWSER: play.google.com/console → Create app → com.diabeticneuropathy.app)
4. Register domain `diabeticneuropathy.com` (CF Registrar, user gate)
5. CF Pages KV bound as `DPN_WAITLIST` ✓
6. Replace placeholder asset PNGs with branded burgundy/amber artwork

**Note:** Natural companion to ESD — neuropathy is a downstream consequence of T2D/"Energy Storage Disease". Consider cross-linking the two sites and apps.

See [[energystoragedisease-state]] [[continuouseeg-venture]]
