# Unified Chronological Summary

## What & Why
The app currently has a Timeline page at `/timeline` and 15+ fragmented summary pages/services (patient summary, health summary, medication summary, visit summary, document summary, etc.) that are all disconnected. Users need a single, always-accessible unified chronological summary that combines all health data — medical records, medications, vitals, lab results, imaging, procedures, immunizations, wearable data, documents, and AI-generated summaries — into one comprehensive view. This should be persistently available from any page, not just as a standalone route.

## Done looks like
- A persistent "Summary" panel/drawer accessible from the sidebar or a floating button on every page, so users never have to navigate away to see their complete health timeline
- The panel shows a unified, chronologically ordered feed of ALL health events across every data source (EHR records, medications, vitals, labs, wearables, documents, encounters)
- Each entry shows date, event type icon, title, source/facility badge, and expandable details — consistent with the existing Timeline page's card design
- Filter chips allow narrowing by event type (labs, medications, vitals, imaging, diagnoses, procedures, vaccines, visits, wearables)
- A search bar for finding specific events by keyword
- An AI-generated narrative summary section at the top that provides a plain-language chronological overview of the patient's health journey (using the existing OpenAI integration)
- The summary updates automatically as new data comes in
- The existing `/timeline` route continues to work as the full-page version of the same data

## Out of scope
- Consolidating or removing the 15+ existing separate summary service files (that's a separate cleanup/refactor task)
- Cancer track timeline (specialized oncology feature stays separate)
- Export/print functionality
- Caregiver or provider-specific views of the summary

## Tasks
1. Create a unified summary API endpoint that aggregates all health data sources (extending the existing `/api/timeline` endpoint logic) and adds an AI-generated narrative overview using OpenAI
2. Build a collapsible summary drawer/panel component that can be opened from any page — include the chronological event feed with type filters, search, source badges, and the AI narrative section at the top
3. Integrate the summary panel into the app layout so it's accessible via a persistent sidebar icon or floating action button on every page
4. Update the existing `/timeline` page to share the same data-fetching and rendering logic as the summary panel (avoid duplication)

## Relevant files
- `client/src/pages/timeline.tsx`
- `client/src/components/app-sidebar.tsx`
- `client/src/App.tsx:59,152,250`
- `server/routes.ts:7775-7904`
- `shared/schema.ts:120-153,3925-3986,11561-11622`
- `client/src/components/advanced-search-filter.tsx`
- `client/src/components/health-record-detail.tsx`
- `client/src/components/explain-dialog.tsx`
