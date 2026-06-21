/**
 * Tabula Medica — Design System
 * iOS 26 / Xcode 26 / Liquid Glass compliant
 *
 * Liquid Glass is Apple's iOS 26 design language:
 * - Translucent, layered surfaces with real-time blur
 * - Specular highlights on interactive elements
 * - Material-aware tinting (content bleeds through chrome)
 * - Increased border radii (pill shapes, 28–36px cards)
 * - SF Pro Rounded for headings on iOS 26
 * - Vibrant fills that adapt to background luminance
 *
 * Implementation: expo-blur BlurView for glass surfaces,
 * expo-linear-gradient for specular highlights,
 * Platform.OS === 'ios' && parseInt(Platform.Version) >= 26 for native APIs.
 */
import { Platform } from "react-native";

// ─────────────────────────────────────────────────────────
// iOS 26 detection
//
// IMPORTANT React Native gotcha:
//   iOS:     Platform.Version is a STRING  e.g. "18.2", "26.0"
//   Android: Platform.Version is a NUMBER  e.g. 34
//
// Never use `typeof Platform.Version === "number"` for iOS —
// it will always be false and Liquid Glass will never activate.
// ─────────────────────────────────────────────────────────
export const isIOS26 = (() => {
  if (Platform.OS !== "ios") return false;
  const major = parseInt(String(Platform.Version).split(".")[0], 10);
  return !isNaN(major) && major >= 26;
})();

// ─────────────────────────────────────────────────────────
// Color System
// Liquid Glass uses translucent tinted surfaces, not flat fills.
// Base palette kept; glass overlays defined separately.
// ─────────────────────────────────────────────────────────
export const Colors = {
  light: {
    // Text
    text: "#0A0A0F",
    textSecondary: "#3C3C4399",   // iOS system label secondary (60% opacity)
    textTertiary: "#3C3C434D",    // iOS system label tertiary
    buttonText: "#FFFFFF",

    // Navigation
    tabIconDefault: "#8E8E93",
    tabIconSelected: "#007AFF",   // iOS 26 system blue
    link: "#007AFF",

    // Brand
    primary: "#007AFF",           // iOS 26 system blue (updated from #0066CC)
    primaryDark: "#0055B3",
    primaryVibrant: "#0A84FF",    // Liquid Glass vibrant variant

    // Semantic
    success: "#34C759",           // iOS system green
    warning: "#FF9F0A",           // iOS system orange
    error: "#FF3B30",             // iOS system red
    info: "#32ADE6",              // iOS system teal

    // Surfaces — Liquid Glass layers
    backgroundRoot: "#F2F2F7",    // iOS grouped background
    backgroundDefault: "#FFFFFF",
    backgroundRootDefault: "#FFFFFF",
    backgroundSecondary: "#F2F2F7",
    backgroundTertiary: "#E5E5EA",

    // Glass surfaces (used with BlurView)
    glassBase: "rgba(255,255,255,0.72)",
    glassChrome: "rgba(255,255,255,0.55)",       // nav bar, tab bar
    glassCard: "rgba(255,255,255,0.65)",          // cards on colored bg
    glassModal: "rgba(242,242,247,0.94)",         // modals, sheets
    glassSpecular: "rgba(255,255,255,0.30)",      // inner highlight edge
    glassBorder: "rgba(60,60,67,0.10)",           // 1px separators
    glassInputBg: "rgba(118,118,128,0.12)",       // text field fills

    // Health record type colours
    border: "#C6C6C8",
    recordVisit: "#007AFF",
    recordLab: "#34C759",
    recordMedication: "#AF52DE",
    recordImaging: "#FF9F0A",
    recordDental: "#5AC8FA",
  },

  dark: {
    // Text
    text: "#FFFFFF",
    textSecondary: "#EBEBF599",   // iOS dark label secondary
    textTertiary: "#EBEBF54D",
    buttonText: "#FFFFFF",

    // Navigation
    tabIconDefault: "#8E8E93",
    tabIconSelected: "#0A84FF",
    link: "#0A84FF",

    // Brand
    primary: "#0A84FF",
    primaryDark: "#0066CC",
    primaryVibrant: "#409CFF",

    // Semantic
    success: "#30D158",
    warning: "#FFD60A",
    error: "#FF453A",
    info: "#64D2FF",

    // Surfaces
    backgroundRoot: "#000000",
    backgroundDefault: "#1C1C1E",
    backgroundRootDefault: "#1C1C1E",
    backgroundSecondary: "#2C2C2E",
    backgroundTertiary: "#3A3A3C",

    // Glass surfaces
    glassBase: "rgba(28,28,30,0.78)",
    glassChrome: "rgba(28,28,30,0.65)",
    glassCard: "rgba(44,44,46,0.72)",
    glassModal: "rgba(28,28,30,0.95)",
    glassSpecular: "rgba(255,255,255,0.08)",
    glassBorder: "rgba(255,255,255,0.10)",
    glassInputBg: "rgba(118,118,128,0.24)",

    border: "#38383A",
    recordVisit: "#0A84FF",
    recordLab: "#30D158",
    recordMedication: "#BF5AF2",
    recordImaging: "#FF9F0A",
    recordDental: "#64D2FF",
  },

  // Section 508 high-contrast modes (WCAG 2.2 AA minimum 4.5:1, AAA 7:1)
  highContrast: {
    light: {
      text: "#000000",
      textSecondary: "#1C1C1E",
      buttonText: "#FFFFFF",
      tabIconDefault: "#3A3A3C",
      tabIconSelected: "#00359F",
      link: "#00359F",
      primary: "#00359F",
      primaryDark: "#00246B",
      primaryVibrant: "#00359F",
      success: "#006621",
      warning: "#875200",
      error: "#C00000",
      info: "#004F8C",
      border: "#000000",
      backgroundRoot: "#FFFFFF",
      backgroundDefault: "#FFFFFF",
      backgroundRootDefault: "#FFFFFF",
      backgroundSecondary: "#F2F2F7",
      backgroundTertiary: "#E5E5EA",
      glassBase: "#FFFFFF",
      glassChrome: "#F2F2F7",
      glassCard: "#FFFFFF",
      glassModal: "#FFFFFF",
      glassSpecular: "transparent",
      glassBorder: "#000000",
      glassInputBg: "#F2F2F7",
      recordVisit: "#00359F",
      recordLab: "#006621",
      recordMedication: "#5A0099",
      recordImaging: "#875200",
      recordDental: "#005F87",
    },
    dark: {
      text: "#FFFFFF",
      textSecondary: "#E5E5EA",
      buttonText: "#000000",
      tabIconDefault: "#C7C7CC",
      tabIconSelected: "#66B2FF",
      link: "#66B2FF",
      primary: "#66B2FF",
      primaryDark: "#409CFF",
      primaryVibrant: "#66B2FF",
      success: "#4CD964",
      warning: "#FFD60A",
      error: "#FF6961",
      info: "#5AC8FA",
      border: "#FFFFFF",
      backgroundRoot: "#000000",
      backgroundDefault: "#000000",
      backgroundRootDefault: "#000000",
      backgroundSecondary: "#1C1C1E",
      backgroundTertiary: "#2C2C2E",
      glassBase: "#1C1C1E",
      glassChrome: "#000000",
      glassCard: "#1C1C1E",
      glassModal: "#1C1C1E",
      glassSpecular: "transparent",
      glassBorder: "#FFFFFF",
      glassInputBg: "#2C2C2E",
      recordVisit: "#66B2FF",
      recordLab: "#4CD964",
      recordMedication: "#DA8FFF",
      recordImaging: "#FFD60A",
      recordDental: "#5AC8FA",
    },
  },
};

// ─────────────────────────────────────────────────────────
// Spacing — 4pt base grid (iOS 26 uses generous spacing)
// ─────────────────────────────────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 50,     // iOS 26: slightly taller inputs
  buttonHeight: 54,    // iOS 26: pill buttons are taller
  tabBarHeight: 83,    // iOS 26: taller tab bar with home indicator
  navBarHeight: 52,
  touchTarget: 44,     // WCAG minimum touch target
};

// ─────────────────────────────────────────────────────────
// Border Radius — iOS 26 uses larger radii ("liquid" curves)
// Key change: cards 20→28, buttons 14→28 (full pill), modals 28→36
// ─────────────────────────────────────────────────────────
export const BorderRadius = {
  xs: 8,
  sm: 14,
  md: 20,              // standard card
  lg: 28,              // iOS 26 featured card / modal
  xl: 36,              // iOS 26 full-bleed sheet
  "2xl": 44,
  "3xl": 56,
  pill: 9999,          // use for buttons, badges, tags
  input: 14,           // text field corners
  button: 28,          // iOS 26 pill-style primary button (not full pill)
  card: 20,
  cardFeatured: 28,    // hero cards, app clips
  modal: 36,           // sheets, modals
  tabBar: 28,          // iOS 26 floating tab bar
};

// ─────────────────────────────────────────────────────────
// Typography — iOS 26 / SF Pro
// SF Pro Rounded used for large display text in iOS 26
// ─────────────────────────────────────────────────────────
export const Typography = {
  // Display (large hero text — SF Pro Rounded on iOS 26)
  display: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: "700" as const,
    letterSpacing: 0.37,
    fontFamily: isIOS26 ? "ui-rounded" : undefined,
  },
  // Headings
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700" as const,
    letterSpacing: 0.36,
    fontFamily: isIOS26 ? "ui-rounded" : undefined,
  },
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700" as const,
    letterSpacing: 0.35,
  },
  h3: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "600" as const,
    letterSpacing: 0.38,
  },
  h4: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600" as const,
    letterSpacing: -0.41,    // iOS body letter spacing
  },
  // Body — iOS 26 system body is 17pt
  body: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "400" as const,
    letterSpacing: -0.41,
  },
  bodyEmphasized: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600" as const,
    letterSpacing: -0.41,
  },
  // Callout — used in list cells
  callout: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "400" as const,
    letterSpacing: -0.32,
  },
  // Subheadline
  subheadline: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "400" as const,
    letterSpacing: -0.24,
  },
  subheadlineEmphasized: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600" as const,
    letterSpacing: -0.24,
  },
  // Footnote
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400" as const,
    letterSpacing: -0.08,
  },
  // Caption
  caption1: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
  },
  caption2: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "400" as const,
    letterSpacing: 0.07,
  },
  // Keep legacy aliases
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
  },
  link: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "400" as const,
    letterSpacing: -0.41,
  },
  sizes: {
    display: 34,
    title: 28,
    subtitle: 22,
    body: 17,
    callout: 16,
    subheadline: 15,
    small: 14,
    footnote: 13,
    caption: 12,
  },
};

// ─────────────────────────────────────────────────────────
// Font families — SF Pro system fonts
// ─────────────────────────────────────────────────────────
export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",       // SF Pro Rounded — iOS 26 headers
    mono: "ui-monospace",
    display: isIOS26 ? "ui-rounded" : "system-ui",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
    display: "normal",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Nunito', 'Varela Round', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace",
    display: "'SF Pro Rounded', 'Nunito', system-ui, sans-serif",
  },
});

// ─────────────────────────────────────────────────────────
// Shadows — iOS 26 uses softer, larger-radius shadows
// Glass surfaces have specific shadow profiles
// ─────────────────────────────────────────────────────────
export const Shadows = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  small: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  medium: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  large: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  // Liquid Glass card shadow — diffuse, low opacity, large radius
  glass: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 6,
  },
  // Floating elements (FABs, sheets peeking over content)
  floating: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 10,
  },
  // Colored shadows for health record cards (match record type color)
  colored: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.20,
    shadowRadius: 12,
    elevation: 4,
  }),
};

// ─────────────────────────────────────────────────────────
// Glass Effects — iOS 26 Liquid Glass material system
//
// Usage with expo-blur:
//   <BlurView intensity={glass.intensity} tint={glass.tint}
//     style={{ borderRadius: BorderRadius.card, overflow: 'hidden' }}>
//     <View style={{ backgroundColor: glass.background }}>
//       {children}
//     </View>
//   </BlurView>
//
// The specularHighlight View sits absolute, top: 0, left: 0, right: 0,
// height: 1, borderTopLeftRadius, borderTopRightRadius = card radius.
// ─────────────────────────────────────────────────────────
export const GlassEffects = {
  // Standard card — sits on app background
  card: {
    intensity: 60,
    tint: "light" as const,
    background: "rgba(255,255,255,0.55)",
    backgroundDark: "rgba(44,44,46,0.65)",
    border: "rgba(255,255,255,0.40)",
    borderDark: "rgba(255,255,255,0.10)",
    specularHighlight: "rgba(255,255,255,0.35)",
    specularHighlightDark: "rgba(255,255,255,0.08)",
  },
  // Chrome — nav bars, tab bars, toolbars
  chrome: {
    intensity: 80,
    tint: "light" as const,
    background: "rgba(242,242,247,0.72)",
    backgroundDark: "rgba(28,28,30,0.72)",
    border: "rgba(60,60,67,0.12)",
    borderDark: "rgba(255,255,255,0.08)",
    specularHighlight: "rgba(255,255,255,0.25)",
    specularHighlightDark: "rgba(255,255,255,0.04)",
  },
  // Modal / bottom sheet
  modal: {
    intensity: 90,
    tint: "light" as const,
    background: "rgba(242,242,247,0.92)",
    backgroundDark: "rgba(28,28,30,0.94)",
    border: "rgba(60,60,67,0.08)",
    borderDark: "rgba(255,255,255,0.06)",
    specularHighlight: "rgba(255,255,255,0.20)",
    specularHighlightDark: "rgba(255,255,255,0.04)",
  },
  // Tinted glass — health record headers
  tinted: (hexColor: string, opacity = 0.18) => ({
    intensity: 50,
    tint: "light" as const,
    background: `${hexColor}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`,
    border: `${hexColor}30`,
    specularHighlight: "rgba(255,255,255,0.28)",
  }),
  // Fallback for platforms without blur support (web, older Android)
  fallback: {
    light: {
      background: "rgba(242,242,247,0.96)",
      border: "rgba(60,60,67,0.15)",
    },
    dark: {
      background: "rgba(28,28,30,0.97)",
      border: "rgba(255,255,255,0.10)",
    },
  },
};

// ─────────────────────────────────────────────────────────
// Gradients — updated for iOS 26 vibrant style
// ─────────────────────────────────────────────────────────
export const Gradients = {
  primary: ["#007AFF", "#0A84FF"],
  primaryVibrant: ["#0055FF", "#007AFF", "#34AAFF"],
  visit: ["#007AFF", "#5AC8FA"],
  lab: ["#34C759", "#30D158"],
  medication: ["#AF52DE", "#BF5AF2"],
  imaging: ["#FF9F0A", "#FFB340"],
  dental: ["#5AC8FA", "#64D2FF"],
  // Health dashboard hero gradient
  healthHero: ["#007AFF", "#34AAFF", "#5AC8FA"],
  // Background gradients — subtle, iOS 26 style
  backgroundLight: ["#F2F2F7", "#FFFFFF"],
  backgroundDark: ["#000000", "#1C1C1E"],
  // Liquid Glass specular gradient — inner edge highlight
  specularEdge: [
    "rgba(255,255,255,0.30)",
    "rgba(255,255,255,0.08)",
    "rgba(255,255,255,0.00)",
  ],
  specularEdgeDark: [
    "rgba(255,255,255,0.12)",
    "rgba(255,255,255,0.03)",
    "rgba(255,255,255,0.00)",
  ],
};

// ─────────────────────────────────────────────────────────
// Animation — iOS 26 spring physics
// Use with react-native-reanimated withSpring()
// ─────────────────────────────────────────────────────────
export const Animation = {
  // Standard spring (button press, card tap)
  spring: {
    damping: 20,
    stiffness: 300,
    mass: 1,
  },
  // Gentle spring (sheets, modals sliding in)
  springGentle: {
    damping: 28,
    stiffness: 200,
    mass: 1,
  },
  // Snappy spring (tab switch, quick interactions)
  springSnappy: {
    damping: 15,
    stiffness: 400,
    mass: 0.8,
  },
  // Duration for non-spring transitions
  duration: {
    fast: 180,
    normal: 280,
    slow: 420,
  },
  // Easing strings for Animated API
  easing: {
    standard: "cubic-bezier(0.4, 0, 0.2, 1)",
    enter: "cubic-bezier(0.0, 0, 0.2, 1)",
    exit: "cubic-bezier(0.4, 0, 1, 1)",
    // iOS 26 signature — fast in, gentle settle
    liquidGlass: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
  },
};

// ─────────────────────────────────────────────────────────
// Health record type config — colour + glass tint
// ─────────────────────────────────────────────────────────
export const RecordTypes = {
  visit: {
    color: Colors.light.recordVisit,
    gradient: Gradients.visit,
    glass: GlassEffects.tinted(Colors.light.recordVisit),
    icon: "stethoscope",
    label: "Visit",
  },
  lab: {
    color: Colors.light.recordLab,
    gradient: Gradients.lab,
    glass: GlassEffects.tinted(Colors.light.recordLab),
    icon: "flask",
    label: "Lab",
  },
  medication: {
    color: Colors.light.recordMedication,
    gradient: Gradients.medication,
    glass: GlassEffects.tinted(Colors.light.recordMedication),
    icon: "pill",
    label: "Medication",
  },
  imaging: {
    color: Colors.light.recordImaging,
    gradient: Gradients.imaging,
    glass: GlassEffects.tinted(Colors.light.recordImaging),
    icon: "scan",
    label: "Imaging",
  },
  dental: {
    color: Colors.light.recordDental,
    gradient: Gradients.dental,
    glass: GlassEffects.tinted(Colors.light.recordDental),
    icon: "tooth",
    label: "Dental",
  },
} as const;

// ─────────────────────────────────────────────────────────
// Semantic tokens — shorthand for common patterns
// ─────────────────────────────────────────────────────────
export const Tokens = {
  // Ambient encounter indicator — pulsing red mic
  ambientActive: {
    color: Colors.light.error,
    pulseColor: "rgba(255,59,48,0.25)",
  },
  // AI confidence levels
  aiConfidence: {
    high: Colors.light.success,
    medium: Colors.light.warning,
    low: Colors.light.error,
  },
  // Section 508: minimum contrast ratios
  a11y: {
    minContrastBody: 4.5,     // WCAG AA
    minContrastLarge: 3.0,    // WCAG AA large text
    minContrastAAA: 7.0,      // WCAG AAA
    minTouchTarget: 44,       // px
    focusRingWidth: 3,
    focusRingColor: "#007AFF",
    focusRingOffset: 2,
  },
};

export type ColorScheme = "light" | "dark";
export type ThemeColors = typeof Colors.light;
