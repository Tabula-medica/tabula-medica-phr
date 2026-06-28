/**
 * Design tokens — mirrors the web client's brand palette so the native app
 * is visually consistent with tabulamedica.us / .world. Brand deep-navy
 * (#1a3a52) + sky accent (#0ea5e9) are the two anchor colors.
 */

export const colors = {
  // Brand
  brand: "#1a3a52",
  brandDark: "#0f2438",
  brandLight: "#2c5a7a",
  accent: "#0ea5e9",
  accentDark: "#0284c7",
  accentLight: "#7dd3fc",

  // Semantic
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
  dangerDark: "#b91c1c",

  // Surfaces
  background: "#f8fafc",
  surface: "#ffffff",
  surfaceAlt: "#f1f5f9",
  border: "#e2e8f0",
  overlay: "rgba(15, 36, 56, 0.55)",

  // Text
  text: "#0f172a",
  textMuted: "#64748b",
  textSubtle: "#94a3b8",
  textInverse: "#ffffff",

  // Timeline event accents (mirror web record-type chips)
  eventEncounter: "#0ea5e9",
  eventMedication: "#8b5cf6",
  eventCondition: "#dc2626",
  eventObservation: "#16a34a",
  eventProcedure: "#d97706",
  eventImmunization: "#0891b2",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: "700" as const, color: colors.text },
  h2: { fontSize: 22, fontWeight: "700" as const, color: colors.text },
  h3: { fontSize: 18, fontWeight: "600" as const, color: colors.text },
  body: { fontSize: 15, fontWeight: "400" as const, color: colors.text },
  bodyMuted: { fontSize: 15, fontWeight: "400" as const, color: colors.textMuted },
  caption: { fontSize: 13, fontWeight: "400" as const, color: colors.textSubtle },
  label: { fontSize: 13, fontWeight: "600" as const, color: colors.textMuted },
} as const;

export const shadow = {
  card: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;
