# Tabula Medica - Product Audit Report

## Executive Summary

| Dimension | Current | Recommended Target | Reduction |
|-----------|---------|-------------------|-----------|
| Frontend pages | 454 files (357K lines) | ~60-80 pages | ~85% |
| Server route files | 328 files (180K lines) | ~50-60 files | ~82% |
| Server total files | 404 files (538K lines) | ~80-100 files | ~75% |
| Registered routes | 454 | ~70 | ~85% |
| Schema file | 21,243 lines | ~3,000 lines | ~86% |
| Storage file | 10,745 lines (153 Maps) | ~2,000 lines | ~81% |
| UI components | 224 files | ~60-80 files | ~65% |
| Sidebar nav items | 49 (down from ~150) | 30-35 | ~30% |
| Dashboard pages | 50 | 5-6 | ~90% |

The codebase has extreme duplication across every layer. The primary pattern is "feature proliferation" - the same concept (dashboards, onboarding, care plans, FHIR tools, patient analytics) was built multiple times with slight variations rather than being parameterized or composed from shared primitives.

---

## Priority 1: Critical Redundancies (Highest Impact)

### 1.1 Dashboard Explosion (50 dashboard pages -> 5)

**Problem:** 50 separate dashboard pages, most rendering the same card/chart/table layout with different data sources.

| Duplicate Cluster | Pages | Lines | Consolidate Into |
|-------------------|-------|-------|-----------------|
| Patient dashboards | `patient-dashboard`, `patient-dashboard-new`, `patient-dashboard-page`, `patient-home`, `patient-home-dashboard`, `patient-hub`, `my-health-dashboard`, `personal-health-dashboard`, `simplified-dashboard`, `health-dashboard` | ~6,800 | **Patient Home** (1 page with role/mode toggle) |
| Analytics dashboards | `analytics-dashboard`, `admin-analytics`, `healthcare-analytics-dashboard`, `healthcare-kpi-dashboard`, `clinical-analytics-dashboard`, `advanced-analytics`, `admin-data-dashboard`, `executive-dashboard` | ~8,500 | **Analytics** (1 page with tab/filter system) |
| FHIR dashboards | `fhir-insights-dashboard`, `fhir-audit-dashboard`, `fhir-longitudinal-dashboard`, `ai-fhir-analytics-dashboard`, `data-quality-dashboard` (x2) | ~5,200 | **Data Platform** (1 page with tabs) |
| Provider dashboards | `ai-provider-dashboard`, `ai-provider-dashboard-enhanced`, `clinician-dashboard`, `provider-dashboard-customizable` | ~5,400 | **Provider Dashboard** (1 page) |
| Compliance dashboards | `compliance-dashboard`, `compliance-alerts-dashboard`, `security-dashboard`, `security-admin-dashboard`, `audit-trail-dashboard`, `incident-dashboard` | ~5,000 | **Compliance & Security** (1 page) |
| Other dashboards | `gamification-dashboard`, `profile-dashboard`, `population-dashboard`, `customizable-dashboard`, `external-sync-dashboard`, `billing-dashboard`, `aco-reporting-dashboard`, `cancer-track-dashboard`, `health-insights-dashboard`, `patient-health-analytics-dashboard`, `caregiver-health-dashboard` | ~10,000 | Absorb into respective parent pages |

**Action:** Create a `DashboardShell` component that accepts a config (title, stat cards, chart definitions, table columns, data source URL). Each "dashboard" becomes a ~30-line config file instead of a 500-1500 line page.

### 1.2 Onboarding Proliferation (16 pages -> 2)

**Problem:** 16 separate onboarding flows for the same concept (getting a new user or patient set up).

| Page | Lines | Overlaps With |
|------|-------|---------------|
| `onboarding` | 587 | All below |
| `patient-onboarding` | 1,243 | `patient-onboarding-wizard` |
| `patient-onboarding-wizard` | 1,900 | `patient-onboarding` |
| `new-patient-onboarding` | 851 | `patient-onboarding` |
| `new-user-onboarding` | 627 | `onboarding` |
| `patient-secure-onboarding` | 1,171 | `patient-onboarding` + security |
| `ai-onboarding` | 730 | `onboarding` + AI |
| `ai-patient-onboarding` | 574 | `ai-onboarding` |
| `ai-adaptive-onboarding` | 920 | `ai-onboarding` |
| `ai-guided-recall-onboarding` | 468 | `ai-adaptive-onboarding` |
| `automated-onboarding` | 476 | `ai-onboarding` |
| `automated-patient-onboarding` | 731 | `automated-onboarding` |
| `guided-onboarding` | 682 | `onboarding` |
| `onboarding-workflow` | 503 | `onboarding` |
| `facility-onboarding` | 850 | Different user type, keep |
| `data-source-onboarding` | 708 | Different purpose, keep |

**Action:** Consolidate into 2: **Patient Onboarding** (wizard with AI-assist toggle, secure mode) and **Facility/Data Onboarding** (admin). The existing `WizardShell` shared component already supports this.

### 1.3 Patient Engagement Fragmentation (8 pages -> 1)

| Page | Lines | Overlap |
|------|-------|---------|
| `patient-engagement` | 824 | Base engagement features |
| `patient-engagement-enhanced` | 509 | Same + minor additions |
| `patient-engagement-hub` | 938 | Same + messaging |
| `patient-engagement-portal` | 788 | Same + portal wrapper |
| `ai-patient-engagement` | 673 | Same + AI layer |
| `ai-proactive-patient-engagement-chatbot` | 904 | Chatbot only |
| `patient-experience-hub` | 641 | Engagement + feedback |
| `patient-features` | 427 | Feature catalog |

**Action:** Merge into **Patient Engagement** with tabs: Goals, Rewards, Assessments, Education, Feedback.

---

## Priority 2: High-Impact Consolidations

### 2.1 FHIR Page Explosion (47 pages -> 5)

**Problem:** 47 FHIR-related pages for what should be a single data platform with sections.

| Cluster | Pages | Consolidate Into |
|---------|-------|-----------------|
| Data integration & sync | `fhir-data-integration`, `fhir-bidirectional-sync`, `fhir-sync-rules`, `fhir-sync-scheduler`, `fhir-server-connections`, `custom-fhir-connection`, `enhanced-fhir-integration` | **FHIR Connections** (1 page) |
| Data quality & validation | `fhir-data-quality` (x2), `fhir-custom-validation`, `fhir-profile-validator`, `fhir-conformance`, `realtime-fhir-quality`, `ai-fhir-governance-quality-control`, `ai-fhir-patient-validation` | **Data Quality** (1 page with tabs) |
| Analytics & visualization | `fhir-data-visualization`, `fhir-visualization`, `fhir-visualizations`, `fhir-data-summaries`, `fhir-clinical-analysis`, `fhir-data-lake-analytics`, `ai-fhir-analytics`, `ai-fhir-analytics-dashboard` | **Data Analytics** (1 page) |
| Resource management | `fhir-resource-management`, `ai-fhir-resource-management`, `fhir-advanced-management` (x2), `fhir-template-generator`, `fhir-data-mapping`, `fhir-transformation`, `fhir-data-harmonization`, `fhir-harmonization` | **Resource Manager** (1 page) |
| API & workflow | `fhir-api-explorer`, `ai-fhir-api-integration`, `fhir-workflow-builder`, `ai-fhir-workflow-builder`, `fhir-data-pipeline`, `ai-fhir-data-exchange`, `fhir-external-api-gateway` | **API & Workflows** (1 page) |
| Other | `fhir-search`, `fhir-advanced-search`, `fhir-export`, `ai-fhir-nl-search`, `fhir-alerting`, `fhir-anonymization`, `fhir-standards-mapping`, `ai-fhir-data-governance`, `ai-fhir-data-ingestion`, `ai-fhir-data-monetization`, `fhir-gateway-security`, `fhir-integration-monitoring`, `fhir-audit-dashboard`, `fhir-longitudinal-dashboard`, `fhir-insights-dashboard`, `enhanced-fhir-resources`, `patient-fhir-portal`, `ai-fhir-capabilities` | Absorb into above 5 pages |

### 2.2 AI Assistant/Chat Duplication (10 pages -> 2)

| Page | Lines | Purpose |
|------|-------|---------|
| `ai-health-assistant` | 1,585 | General health Q&A |
| `ai-medical-assistant` | 1,063 | Medical Q&A (same as above) |
| `ai-chatbot` | 725 | Chat interface (same) |
| `ai-patient-communication` | 893 | Patient messaging with AI |
| `ai-communication-assistant` | 647 | Communication help |
| `patient-chatbot` | 534 | Patient-facing chat |
| `patient-ai-assistant` | 496 | Patient AI help |
| `patient-assistant` | 370 | Patient help |
| `ai-clinical-documentation` | 884 | Clinical note AI |
| `ai-clinical-documentation-assistant` | 789 | Same as above |

**Action:** Merge into **AI Health Assistant** (patient-facing) and **AI Clinical Assistant** (provider-facing). Use a shared `ChatShell` component with pluggable system prompts.

### 2.3 Care Plan/Coordination Duplication (8 pages -> 2)

| Page | Lines | Overlap |
|------|-------|---------|
| `ai-care-plan` | 1,264 | AI-generated care plans |
| `ai-care-plan-review` | 740 | Review of above |
| `ai-care-coordination` | 669 | Team coordination |
| `ai-personalized-care-plans` | 669 | Same as ai-care-plan |
| `collaborative-care-plans` | 808 | Team care plans |
| `personalized-care-journey` | 1,117 | Care plan + journey |
| `care-team-collaboration` | 1,542 | Team features |
| `care-team-ai` | 827 | AI for team |

**Action:** Merge into **Care Plans** (create/review/track) and **Care Team** (collaboration/messaging).

### 2.4 Caregiver Duplication (7 pages -> 1)

| Page | Lines |
|------|-------|
| `caregivers` | 1,626 |
| `caregiver-portal` | 2,422 |
| `caregiver-hub` | 1,138 |
| `caregiver-management` | 706 |
| `caregiver-collaboration-hub` | 760 |
| `caregiver-health-dashboard` | 1,014 |
| `caregiver-reporting` | 865 |

**Action:** Single **Caregiver Portal** with tabs: Overview, Health View, Messages, Reports, Settings.

### 2.5 Health Journey/Timeline Duplication (10 pages -> 1)

| Page | Lines |
|------|-------|
| `health-journeys` | 521 |
| `my-health-journey` | 1,117 |
| `enhanced-health-journey` | 1,283 |
| `longitudinal-health-journey` | 991 |
| `personalized-health-journey` | 1,126 |
| `personalized-care-journey` | 1,117 |
| `treatment-journey` | 641 |
| `medical-journey` | 927 |
| `patient-journey-explorer` | 819 |
| `admin-journey-analytics` | 698 |

**Action:** Single **Health Timeline** page (already exists as `/timeline`). Add analytics tab for admin view.

---

## Priority 3: Data Model & API Redundancies

### 3.1 Schema Bloat (21,243 lines)

**Problem:** `shared/schema.ts` is 21K lines with significant overlap.

| Redundancy Pattern | Examples | Action |
|-------------------|----------|--------|
| Duplicate type definitions | `Patient` vs `UnifiedPatient` vs `PatientDetail` | Merge into `Patient` with optional fields |
| Overlapping Zod schemas | Multiple medication schemas, multiple appointment schemas | Single schema per entity with `.pick()` / `.extend()` |
| Unused types | Types for features only in in-memory storage | Remove types with no DB table or API consumer |
| Inline enums | Status strings repeated across 20+ schemas | Extract shared enums (`Status`, `Priority`, `Category`) |

### 3.2 Storage Interface Bloat (10,745 lines, 153 Maps)

**Problem:** `server/storage.ts` has 153 in-memory Maps for demo data that parallel the 67 Postgres tables.

| Issue | Count | Action |
|-------|-------|--------|
| In-memory Maps duplicating DB tables | ~40 | Migrate to use DB exclusively |
| Maps for features with no DB table | ~113 | Consolidate or remove unused features |
| Duplicate CRUD methods | ~300+ methods | Use generic CRUD factory |

**Action:** Create `createCrudStore<T>(tableName)` factory that generates standard `get`, `list`, `create`, `update`, `delete` methods, reducing ~300 methods to ~30 unique ones plus the factory.

### 3.3 Duplicate API Route Registrations

**Problem:** Multiple route files register overlapping endpoint paths. Server logs show 20+ duplicate route path registrations:

| Duplicate Path | Registered Times |
|----------------|-----------------|
| `/api/workflow-orchestrator/*` | 8x |
| `/api/security-admin/*` | 8x |
| `/api/realtime-fhir-quality/*` | 8x |
| `/api/rbac/*` | 8x |
| `/api/patient-summary-enrichment/*` | 8x |
| `/api/identity/*` | 8x |
| `/api/device-sessions/*` | 8x |
| `/api/collaboration-hub/*` | 8x |
| `/api/clinical-rules/*` | 8x |
| `/api/advanced-reporting/*` | 8x |

**Action:** Deduplicate route registration in `server/routes.ts`. Each API path should be registered exactly once. Current 328 route files should consolidate to ~50-60 domain-grouped files.

---

## Priority 4: UI Component Redundancies

### 4.1 Inline Pattern Duplication

| Pattern | Occurrences | Shared Component Exists? | Action |
|---------|------------|------------------------|--------|
| Stat card grids | 401 pages use `grid grid-cols` | Yes: `StatCardGrid` | Migrate remaining 390+ pages |
| Date formatting | 222 pages use `toLocaleDateString` | Yes: `formatDate` in `format-helpers` | Migrate remaining 210+ pages |
| Status badges | 36 pages define own `StatusBadge` | Yes: shared `StatusBadge` | Remove inline versions |
| Loading/empty states | ~200 pages define inline | Yes: `LoadingState`, `EmptyState` | Migrate pages |
| Page headers | ~300 pages define own header | Yes: `PageHeader` | Migrate pages |
| Filter/search bars | ~150 pages define inline | Yes: `DataFiltersBar` | Migrate pages |
| Tab navigation | ~180 pages use inline tabs | No | Create shared `TabShell` |

### 4.2 Missing Shared Components

| Needed Component | Used In (approx) | Description |
|-----------------|-----------------|-------------|
| `ChatShell` | 10+ AI chat pages | Chat interface with message history, input, AI streaming |
| `DashboardShell` | 50 dashboard pages | Configurable stat cards + charts + tables layout |
| `TabShell` | 180+ pages | Standard tab navigation with URL sync |
| `DataTable` | 200+ pages | Sortable, filterable, paginated table |
| `TimelineView` | 10+ journey pages | Chronological event display |
| `FormWizard` | 16 onboarding pages | Multi-step form with validation and progress |

---

## Priority 5: User Flow Redundancies

### 5.1 Duplicate User Flows

| Flow | Implemented In | Recommended |
|------|---------------|-------------|
| View health records | `health-records`, `my-health-record`, `secure-health-records`, `patient-health-record`, `patient-fhir-portal`, `advanced-patient-records` | 1 page: **Health Records** with security toggle |
| View medications | `medications`, `ai-medication-management`, `ai-prescription-management`, `medication-management` | 1 page: **Medications** with AI assist panel |
| View patient summary | `patient-360`, `patient-360-comprehensive`, `patient-detail`, `patient-profile-summary`, `ai-patient-summary-generator`, `patient-summary-enrichment` | 1 page: **Patient Summary** |
| Send messages | `messages`, `patient-messaging`, `patient-communications`, `ai-patient-communication` | 1 page: **Messages** with AI compose |
| View analytics | 8+ analytics pages | 1 page: **Analytics** with role-based tabs |

### 5.2 Navigation Confusion

- **49 sidebar items** still too many for a patient-facing app. Target: 15-20 for patients, separate admin section.
- **No role-based filtering**: Patients see admin items, admins see patient items.
- **Recommendation:** Split sidebar by role: Patient view (12-15 items), Provider view (15-20 items), Admin view (10-15 items).

---

## Recommended Consolidation Roadmap

### Phase 1: Quick Wins (1-2 weeks, ~60% reduction)

1. **Merge dashboard pages** (50 -> 5): Build `DashboardShell`, rewrite each as config
2. **Merge onboarding pages** (16 -> 2): Extend `WizardShell` 
3. **Merge AI chat pages** (10 -> 2): Build `ChatShell`
4. **Merge FHIR pages** (47 -> 5): Tabbed data platform
5. **Role-based sidebar filtering**: Show only relevant items per role

### Phase 2: Deep Consolidation (2-3 weeks, ~80% reduction)

6. **Merge journey/timeline pages** (10 -> 1)
7. **Merge caregiver pages** (7 -> 1) 
8. **Merge engagement pages** (8 -> 1)
9. **Merge care plan pages** (8 -> 2)
10. **Migrate all pages to shared components** (StatusBadge, PageHeader, etc.)

### Phase 3: Architecture Cleanup (2-3 weeks, ~85% reduction)

11. **Consolidate schema** (21K -> 3K lines): Shared enums, merged types
12. **Consolidate storage** (10K -> 2K lines): CRUD factory, remove unused Maps
13. **Consolidate route files** (328 -> 50): Domain-grouped, deduplicate registrations
14. **Build remaining shared components** (ChatShell, DashboardShell, DataTable, TabShell)

### Expected Outcome

| Metric | Before | After Phase 3 |
|--------|--------|--------------|
| Frontend pages | 454 | 60-80 |
| Frontend LOC | 357K | ~50K |
| Server route files | 328 | 50-60 |
| Server LOC | 538K | ~80K |
| Schema LOC | 21K | ~3K |
| Sidebar items | 49 | 15-20 (role-filtered) |
| Time to find a feature | High (search 454 files) | Low (search 60-80 files) |
| New developer onboarding | Days | Hours |

---

## Appendix: Full Duplicate Groups

### A. All 54 AI Pages

```
ai-adaptive-onboarding          -> merge into Patient Onboarding
ai-admin-automation              -> merge into Admin Analytics
ai-admin-operations              -> merge into Admin Analytics
ai-advanced-standardization      -> merge into Data Quality
ai-audit-log-enrichment          -> merge into Compliance
ai-care-coordination             -> merge into Care Plans
ai-care-plan                     -> merge into Care Plans
ai-care-plan-review              -> merge into Care Plans
ai-case-review-dashboard         -> merge into Provider Dashboard
ai-chatbot                       -> merge into AI Health Assistant
ai-clinical-documentation        -> merge into AI Clinical Assistant
ai-clinical-documentation-assistant -> merge into AI Clinical Assistant
ai-clinical-workflows            -> merge into Provider Dashboard
ai-communication-assistant       -> merge into Messages
ai-data-governance               -> merge into Data Platform
ai-data-standardization          -> merge into Data Quality
ai-fhir-analytics                -> merge into Data Analytics
ai-fhir-analytics-dashboard      -> merge into Data Analytics
ai-fhir-api-integration          -> merge into FHIR API
ai-fhir-capabilities             -> merge into Data Platform
ai-fhir-data-exchange            -> merge into FHIR Connections
ai-fhir-data-governance          -> merge into Data Quality
ai-fhir-data-ingestion           -> merge into FHIR Connections
ai-fhir-data-monetization        -> merge into Data Platform
ai-fhir-governance-quality-control -> merge into Data Quality
ai-fhir-nl-search                -> merge into Search
ai-fhir-patient-validation       -> merge into Data Quality
ai-fhir-resource-management      -> merge into Resource Manager
ai-fhir-workflow-builder         -> merge into FHIR API
ai-guided-recall-onboarding      -> merge into Patient Onboarding
ai-health-assistant              -> KEEP (primary patient AI)
ai-healthcare-workflow-automation -> merge into Provider Dashboard
ai-medical-assistant             -> merge into AI Health Assistant
ai-medication-management         -> merge into Medications
ai-model-management              -> merge into Admin (AI settings)
ai-onboarding                    -> merge into Patient Onboarding
ai-patient-analytics             -> merge into Analytics
ai-patient-communication         -> merge into Messages
ai-patient-data-analytics        -> merge into Analytics
ai-patient-education-hub         -> merge into Education
ai-patient-engagement            -> merge into Patient Engagement
ai-patient-intelligence          -> merge into Analytics
ai-patient-onboarding            -> merge into Patient Onboarding
ai-patient-outreach              -> merge into Provider Dashboard
ai-patient-summary-generator     -> merge into Patient Summary
ai-personalized-care-plans       -> merge into Care Plans
ai-prescription-management       -> merge into Medications
ai-proactive-patient-engagement-chatbot -> merge into AI Health Assistant
ai-profile-insights              -> KEEP (profile AI panel)
ai-provider-dashboard            -> merge into Provider Dashboard
ai-provider-dashboard-enhanced   -> merge into Provider Dashboard
ai-provider-workflow             -> merge into Provider Dashboard
ai-public-health-forecasting     -> merge into Analytics
ai-quality-assurance             -> merge into Data Quality
ai-summary                       -> merge into Patient Summary
```

### B. All 48 Patient Pages

```
patient-360                      -> merge into Patient Summary
patient-360-comprehensive        -> merge into Patient Summary
patient-ai-assistant             -> merge into AI Health Assistant
patient-analytics                -> merge into Analytics
patient-assistant                -> merge into AI Health Assistant
patient-care-hub                 -> merge into Patient Home
patient-care-portal              -> merge into Patient Portal
patient-care-team                -> merge into Care Team
patient-cdc-enrichment           -> merge into Health Records
patient-chatbot                  -> merge into AI Health Assistant
patient-communications           -> merge into Messages
patient-dashboard                -> merge into Patient Home
patient-dashboard-new            -> merge into Patient Home
patient-dashboard-page           -> merge into Patient Home (9 lines, just redirect)
patient-detail                   -> merge into Patient Summary
patient-education-center         -> KEEP (education hub)
patient-education-module         -> merge into Education Center
patient-engagement               -> merge into Patient Engagement (KEEP)
patient-engagement-enhanced      -> merge into Patient Engagement
patient-engagement-hub           -> merge into Patient Engagement
patient-engagement-portal        -> merge into Patient Engagement
patient-experience-hub           -> merge into Patient Engagement
patient-features                 -> remove (feature catalog, not user-facing)
patient-feedback-analytics       -> merge into Analytics
patient-fhir-portal              -> merge into Health Records
patient-health-analytics-dashboard -> merge into Analytics
patient-health-record            -> merge into Health Records
patient-health-tracking          -> merge into Vitals
patient-history-builder          -> merge into Health Records
patient-home                     -> merge into Patient Home (KEEP)
patient-home-dashboard           -> merge into Patient Home
patient-hub                      -> merge into Patient Home
patient-immunization-portal      -> KEEP (immunizations)
patient-insights                 -> merge into AI Profile Insights
patient-intake-wizard            -> merge into Patient Onboarding
patient-journey-explorer         -> merge into Timeline
patient-match-review             -> merge into Admin (dedup)
patient-messaging                -> merge into Messages
patient-onboarding               -> merge into Patient Onboarding (KEEP)
patient-onboarding-wizard        -> merge into Patient Onboarding
patient-outreach                 -> merge into Provider Dashboard
patient-portal                   -> KEEP (main patient portal)
patient-profile-summary          -> merge into Patient Summary
patient-registration             -> merge into Patient Onboarding
patient-secure-onboarding        -> merge into Patient Onboarding (secure flag)
patient-summary-enrichment       -> merge into Patient Summary
patient-summary-generator        -> merge into Patient Summary
patient-telehealth-portal        -> KEEP (telehealth)
```
