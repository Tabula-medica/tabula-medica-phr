# Tabula Medica Patient App - Design Guidelines

## Brand Identity

**Purpose**: Empower patients to view their complete, unified health record across all providers in one secure, chronological timeline.

**Aesthetic Direction**: **Liquid Glass Medical Premium** - iOS 26 glass-morphism meets clinical trust. Translucent frosted surfaces, subtle blur effects, soft gradients, and organic fluidity. The interface feels like peering through layers of refined glass - premium, cutting-edge, yet inherently trustworthy. Think Apple Health reimagined as a luxury medical portal.

**Memorable Element**: The chronological timeline rendered as floating, translucent glass cards with subtle depth and motion - health records feel like precious artifacts suspended in liquid glass.

---

## Navigation Architecture

**Root Navigation**: Tab Bar (4 tabs with frosted glass background)

**Screens**:
1. **Timeline** (Tab 1) - Chronological health events
2. **Records** (Tab 2) - Categorized health data
3. **Sources** (Tab 3) - Connected FHIR data sources
4. **Profile** (Tab 4) - Account settings, security

**Modal Screens**:
- Record Detail (full screen modal)
- Add Data Source
- Login/Signup
- Privacy Policy & HIPAA Notice

---

## Screen-by-Screen Specifications

### Login/Signup Screen
- **Layout**: No header. Gradient background (soft blue to white). Centered: frosted glass container with app icon, tagline, SSO buttons. Top inset: insets.top + Spacing.xl. Bottom inset: insets.bottom + Spacing.xl
- **Components**: Apple Sign-In (primary), Google Sign-In (secondary), privacy agreement text with links
- **Glass Effect**: Main container uses 20% opacity white background with 10pt blur

### Timeline Screen
- **Layout**: Transparent header ("Timeline" title, right: Filter icon). Scrollable list with month/year section headers. Top inset: headerHeight + Spacing.xl. Bottom inset: tabBarHeight + Spacing.xl
- **Components**: Glass-morphism timeline cards with color-coded left accent gradient (3pt width), subtle blur, floating appearance with refined shadow. Each card: icon, record type, date, provider, summary
- **Empty State**: "empty-timeline.png" with "Connect a data source to get started" text
- **Glass Card Spec**: 15% opacity white background, 8pt blur, 1px border at 10% white opacity, 12pt corner radius

### Records Screen
- **Layout**: Default header ("Records" title, right: Search icon). Scrollable 2-column grid. Top inset: Spacing.xl. Bottom inset: tabBarHeight + Spacing.xl
- **Components**: Category cards (Labs, Medications, Allergies, Immunizations, Vitals, Procedures, Documents) with gradient overlay, icon, name, count badge
- **Glass Card Spec**: Each card has soft gradient background (category-specific color at 20% to transparent), 8pt blur, frosted edge

### Record Detail Modal
- **Layout**: Default header (record type title, left: Close, right: Share). Scrollable content. Top inset: Spacing.xl. Bottom inset: insets.bottom + Spacing.xl
- **Components**: Frosted glass data source badge, key-value pairs in glass containers, attachments section, "Last synced" footer
- **Glass Effect**: Main background has subtle gradient, data sections in frosted glass cards

### Sources Screen
- **Layout**: Default header ("Data Sources" title, right: Add icon). Scrollable list. Top inset: Spacing.xl. Bottom inset: tabBarHeight + Spacing.xl
- **Components**: Connected source cards (logo, name, last sync, status badge) in glass-morphism style. Floating Add button (bottom right) with premium shadow
- **Empty State**: "empty-sources.png" with "Tap + to connect your first provider"
- **Floating Button Shadow**: offset: 0,4 | opacity: 0.15 | radius: 8

### Profile Screen
- **Layout**: Transparent header ("Profile" title). Scrollable content. Top inset: headerHeight + Spacing.xl. Bottom inset: tabBarHeight + Spacing.xl
- **Components**: Frosted avatar container with display name, glass-morphism settings cards (Security & Privacy, HIPAA Rights, Notifications, Help & Support), nested Account options
- **Glass Effect**: Settings list items as frosted glass cards with subtle hover/press glow

---

## Color Palette

**Primary Gradient**: #0066CC → #0080FF (medical blue with premium shift)
**Background**: Linear gradient #F0F4F8 → #FFFFFF (top to bottom)
**Glass Surface**: #FFFFFF at 15% opacity with 8-10pt blur
**Glass Border**: #FFFFFF at 10% opacity
**Text Primary**: #1A1D29
**Text Secondary**: #6B7280
**Record Type Gradients**:
- Visit: #0066CC → #4A9EFF
- Lab: #10B981 → #34D399
- Medication: #8B5CF6 → #A78BFA
- Imaging: #F97316 → #FB923C

**Semantic Colors**:
- Success: #10B981
- Warning: #F59E0B
- Error: #EF4444

---

## Typography

**Font**: SF Pro (iOS system font)

**Type Scale**:
- Title Large: 28pt, Bold
- Title: 22pt, Semibold
- Headline: 18pt, Semibold
- Body: 16pt, Regular
- Caption: 14pt, Regular
- Small: 12pt, Medium

---

## Visual Design

**Glass-Morphism Specification**:
- Card background: #FFFFFF at 15% opacity
- Backdrop blur: 8-10pt
- Border: 1px, #FFFFFF at 10% opacity
- Corner radius: 12pt (cards), 16pt (larger containers)
- Refined shadow: offset 0,2 | opacity 0.08 | radius 12 for cards
- Floating button shadow: offset 0,4 | opacity 0.15 | radius 8

**Micro-Interactions**:
- Press state: Scale down to 0.98, opacity 0.8, subtle glow effect
- Timeline cards: Gentle vertical slide-in with stagger on scroll
- Tab transitions: Organic cross-fade with slight scale

**Icons**: Feather icons, rendered at 1.5pt stroke weight for refined appearance

**Tab Bar**: Frosted glass background (#FFFFFF at 20% opacity, 10pt blur), floating 8pt above bottom, 12pt corner radius on top corners

---

## Assets to Generate

1. **icon.png** - Medical cross in gradient circle, glass effect overlay | **WHERE USED**: App icon
2. **splash-icon.png** - Simplified glass medical cross | **WHERE USED**: Launch screen
3. **empty-timeline.png** - Floating translucent clipboard with soft shadow, minimal style | **WHERE USED**: Timeline empty state
4. **empty-sources.png** - Disconnected glass puzzle pieces with gradient edges | **WHERE USED**: Sources empty state
5. **avatar-preset.png** - Minimalist silhouette in frosted glass circle with gradient border | **WHERE USED**: Profile default avatar