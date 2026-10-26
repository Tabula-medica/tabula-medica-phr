# RegLens Mobile — App Store + Play Store Plan

## Architecture
Same pattern as rest of fleet: Expo WebView wrapper pointing to reglens.tabulamedica.com
Optimized for iPad Pro (landscape) and Android tablets (Samsung Galaxy Tab / Pixel Tablet)

## App Store Metadata

**App Name:** RegLens — SNF Survey Intelligence
**Bundle ID:** com.tabulamedica.reglens
**Category:** Medical / Business
**Rating:** 17+ (medical professional tool)

**Short Description (30 chars):** SNF Survey Intelligence

**Long Description:**
RegLens gives skilled nursing facility Directors of Nursing, quality directors, and MDS coordinators a complete survey readiness toolkit — all in one place.

WHAT REGLENS DOES:
• 107+ CMS F-tags with full Survey Operations Manual citations, severity A–L, and department mapping
• 46-item department-level prep checklists — Nursing, Pharmacy, Dietary, Infection Control, Administration, and more
• Deficiency tracker — log, assign, and resolve open findings; export history to CSV
• CMS Care Compare 5-star lookup by CCN — see your facility's public rating instantly
• NPI Registry lookup — verify any SNF by name or NPI number
• Survey countdown calendar with prep milestone reminders
• Running deficiency risk score based on open findings in your tracker

BUILT FOR THE NURSING FLOOR:
• Tablet-optimized layout for iPad Pro and Android tablets
• Works in landscape and portrait
• No software to install — browser-based app

NOTE: RegLens is a reference and quality-improvement tool. It does not connect to EHR, MDS, NHSN, or claims systems. No resident PHI is entered or stored.

**Keywords:** SNF, MDS coordinator, CMS survey, skilled nursing, PDPM, iQIES, Five Star, F689, survey readiness, nursing home quality

## Google Play Metadata
(Same description, adapted)
**Package:** com.tabulamedica.reglens
**Category:** Medical
**Content Rating:** Everyone (professional tool)

## Build Steps
1. Create ~/repos/reglens-mobile (Expo SDK 57, same as fleet)
2. WebView pointing to https://reglens.tabulamedica.com
3. Add tablet layout hints (landscape orientation, larger viewport)
4. Splash screen: navy #0A1628 with RegLens logo
5. App icon: RL mark on #0A1628 background
6. eas.json: ios image: latest (Xcode-26 fix, per iOS EAS memory)
7. Build: eas build --platform all --auto-submit
8. ASC: create new app under Team U56SKX5MXX

## Domain Setup
Custom domain for Base44 app: reglens.tabulamedica.com
CNAME → base44.onrender.com (same pattern as mds.tabulamedica.com)
Add via Cloudflare DNS (zone 559a59d6f2c5b901ae1b690b77202382)

## Timeline
- Day 1: App builds, custom domain live, flyer sent
- Day 2-3: Expo wrapper scaffolded, eas build submitted
- Day 5-7: App Store review (Medical apps: 1-3 days typically)
- Day 7-10: LIVE on both stores
