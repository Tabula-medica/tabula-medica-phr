import { Platform } from "react-native";

export const isIOS26 =
  Platform.OS === "ios" &&
  typeof Platform.Version === "number" &&
  Platform.Version >= 26;

export const Colors = {
  light: {
    text: "#0A0A0F",
    textSecondary: "#3C3C4399",
    textTertiary: "#3C3C434D",
    buttonText: "#FFFFFF",

    tabIconDefault: "#8E8E93",
    tabIconSelected: "#007AFF",
    link: "#007AFF",

    primary: "#007AFF",
    primaryDark: "#0055B3",
    primaryVibrant: "#0A84FF",

    success: "#34C759",
    warning: "#FF9F0A",
    error: "#FF3B30",
    info: "#32ADE6",

    // WCAG 2.1 AA / Section 508 accessible foreground tokens for TEXT rendering.
    // The bright palette above (success/warning/error/info) are for icons and
    // decorative indicators only — they do NOT meet 4.5:1 on white backgrounds.
    // Use these *Foreground tokens whenever a semantic color is applied to text.
    // Contrast ratios against #FFFFFF (light) and #1C1C1E (dark):
    //   successForeground  #1B6B2C   6.59:1 / 2.58  (text on white ✓, icon on dark ✓)
    //   warningForeground  #7A4800   7.62:1 / 2.23  (text on white ✓)
    //   errorForeground    #C0392B   5.44:1 / 3.13  (text on white ✓, large text on dark ✓)
    //   infoForeground     #0A5685   7.83:1 / 2.17  (text on white ✓)
    //   linkForeground     #0055B3   7.12:1         (alias of primaryDark)
    successForeground: "#1B6B2C",
    warningForeground: "#7A4800",
    errorForeground: "#C0392B",
    infoForeground: "#0A5685",
    linkForeground: "#0055B3",

    backgroundRoot: "#F2F2F7",
    backgroundDefault: "#FFFFFF",
    backgroundRootDefault: "#FFFFFF",
    backgroundSecondary: "#F2F2F7",
    backgroundTertiary: "#E5E5EA",

    glassBase: "rgba(255,255,255,0.72)",
    glassChrome: "rgba(255,255,255,0.55)",
    glassCard: "rgba(255,255,255,0.65)",
    glassModal: "rgba(242,242,247,0.94)",
    glassSpecular: "rgba(255,255,255,0.30)",
    glassBorder: "rgba(60,60,67,0.10)",
    glassInputBg: "rgba(118,118,128,0.12)",

    border: "#C6C6C8",
    recordVisit: "#007AFF",
    recordLab: "#34C759",
    recordMedication: "#AF52DE",
    recordImaging: "#FF9F0A",
    recordDental: "#5AC8FA",
  },

  dark: {
    text: "#FFFFFF",
    textSecondary: "#EBEBF599",
    textTertiary: "#EBEBF54D",
    buttonText: "#FFFFFF",

    tabIconDefault: "#8E8E93",
    tabIconSelected: "#0A84FF",
    link: "#0A84FF",

    primary: "#0A84FF",
    primaryDark: "#0066CC",
    primaryVibrant: "#409CFF",

    success: "#30D158",
    warning: "#FFD60A",
    error: "#FF453A",
    info: "#64D2FF",

    // Dark-mode accessible foreground tokens for TEXT rendering.
    // Bright palette already passes 4.5:1 on #1C1C1E, so these are aliases
    // that mirror the base values. They exist so component code can always
    // reference theme.*Foreground without conditional light/dark branching.
    successForeground: "#30D158",
    warningForeground: "#FFD60A",
    errorForeground: "#FF453A",
    infoForeground: "#64D2FF",
    linkForeground: "#0A84FF",

    backgroundRoot: "#000000",
    backgroundDefault: "#1C1C1E",
    backgroundRootDefault: "#1C1C1E",
    backgroundSecondary: "#2C2C2E",
    backgroundTertiary: "#3A3A3C",

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

  highContrast: {
    light: {
      text: "#000000",
      textSecondary: "#1C1C1E",
      textTertiary: "#3A3A3C",
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
      textTertiary: "#EBEBF54D",
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
  inputHeight: 50,
  buttonHeight: 54,
  tabBarHeight: 83,
  navBarHeight: 52,
  touchTarget: 44,
};

export const BorderRadius = {
  xs: 8,
  sm: 14,
  md: 20,
  lg: 28,
  xl: 36,
  "2xl": 44,
  "3xl": 56,
  full: 9999,
  pill: 9999,
  input: 14,
  button: 28,
  card: 20,
  cardFeatured: 28,
  modal: 36,
  tabBar: 28,
};

export const Typography = {
  display: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: "700" as const,
    letterSpacing: 0.37,
    fontFamily: isIOS26 ? "ui-rounded" : undefined,
  },
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
    letterSpacing: -0.41,
  },
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
  callout: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "400" as const,
    letterSpacing: -0.32,
  },
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
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400" as const,
    letterSpacing: -0.08,
  },
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

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
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
  glass: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 6,
  },
  floating: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 10,
  },
  cardElevated: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  cardGlass: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  cardSubtle: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  buttonPrimary: {
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 10,
    elevation: 4,
  },
  colored: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.20,
    shadowRadius: 12,
    elevation: 4,
  }),
};

export const GlassEffects = {
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
  tinted: (hexColor: string, opacity = 0.18) => ({
    intensity: 50,
    tint: "light" as const,
    background: `${hexColor}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`,
    border: `${hexColor}30`,
    specularHighlight: "rgba(255,255,255,0.28)",
  }),
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
  light: {
    background: "rgba(255, 255, 255, 0.55)",
    border: "rgba(255, 255, 255, 0.40)",
    overlay: "rgba(255, 255, 255, 0.05)",
    blur: 8,
  },
  medium: {
    background: "rgba(255, 255, 255, 0.65)",
    border: "rgba(255, 255, 255, 0.15)",
    overlay: "rgba(255, 255, 255, 0.08)",
    blur: 10,
  },
  dark: {
    background: "rgba(0, 0, 0, 0.20)",
    border: "rgba(255, 255, 255, 0.08)",
    overlay: "rgba(0, 0, 0, 0.10)",
    blur: 10,
  },
};

export const Gradients = {
  primary: ["#007AFF", "#0A84FF"],
  primaryVibrant: ["#0055FF", "#007AFF", "#34AAFF"],
  visit: ["#007AFF", "#5AC8FA"],
  lab: ["#34C759", "#30D158"],
  medication: ["#AF52DE", "#BF5AF2"],
  imaging: ["#FF9F0A", "#FFB340"],
  dental: ["#5AC8FA", "#64D2FF"],
  healthHero: ["#007AFF", "#34AAFF", "#5AC8FA"],
  background: ["#F2F2F7", "#FFFFFF"],
  backgroundLight: ["#F2F2F7", "#FFFFFF"],
  backgroundDark: ["#000000", "#1C1C1E"],
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

export const Animation = {
  spring: {
    damping: 20,
    stiffness: 300,
    mass: 1,
  },
  springGentle: {
    damping: 28,
    stiffness: 200,
    mass: 1,
  },
  springSnappy: {
    damping: 15,
    stiffness: 400,
    mass: 0.8,
  },
  duration: {
    fast: 180,
    normal: 280,
    slow: 420,
  },
  easing: {
    standard: "cubic-bezier(0.4, 0, 0.2, 1)",
    enter: "cubic-bezier(0.0, 0, 0.2, 1)",
    exit: "cubic-bezier(0.4, 0, 1, 1)",
    liquidGlass: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
  },
};

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

export const Tokens = {
  ambientActive: {
    color: Colors.light.error,
    pulseColor: "rgba(255,59,48,0.25)",
  },
  aiConfidence: {
    high: Colors.light.success,
    medium: Colors.light.warning,
    low: Colors.light.error,
  },
  a11y: {
    minContrastBody: 4.5,
    minContrastLarge: 3.0,
    minContrastAAA: 7.0,
    minTouchTarget: 44,
    focusRingWidth: 3,
    focusRingColor: "#007AFF",
    focusRingOffset: 2,
  },
};

// Material 3 Expressive surface tokens for Android.
// Additive — opt-in only; existing iOS Liquid Glass tokens (Colors / GlassEffects)
// remain authoritative on iOS. Use these on Android components / Android-specific
// branches to align with Material 3 Expressive (Android 16+).
export const MaterialExpressive = {
  light: {
    surface: "#FEF7FF",
    surfaceContainerLowest: "#FFFFFF",
    surfaceContainerLow: "#F7F2FA",
    surfaceContainer: "#F3EDF7",
    surfaceContainerHigh: "#ECE6F0",
    surfaceContainerHighest: "#E6E0E9",
    onSurface: "#1D1B20",
    onSurfaceVariant: "#49454F",
    primary: "#0061A4",
    onPrimary: "#FFFFFF",
    primaryContainer: "#D1E4FF",
    onPrimaryContainer: "#001D36",
    secondary: "#535F70",
    secondaryContainer: "#D7E3F7",
    onSecondaryContainer: "#101C2B",
    tertiary: "#6B5778",
    tertiaryContainer: "#F2DAFF",
    outline: "#79747E",
    outlineVariant: "#CAC4D0",
  },
  dark: {
    surface: "#141218",
    surfaceContainerLowest: "#0F0D13",
    surfaceContainerLow: "#1D1B20",
    surfaceContainer: "#211F26",
    surfaceContainerHigh: "#2B2930",
    surfaceContainerHighest: "#36343B",
    onSurface: "#E6E0E9",
    onSurfaceVariant: "#CAC4D0",
    primary: "#9ECAFF",
    onPrimary: "#003258",
    primaryContainer: "#00497D",
    onPrimaryContainer: "#D1E4FF",
    secondary: "#BBC7DB",
    secondaryContainer: "#3B4858",
    onSecondaryContainer: "#D7E3F7",
    tertiary: "#D6BEE4",
    tertiaryContainer: "#523F5F",
    outline: "#938F99",
    outlineVariant: "#49454F",
  },
  shape: {
    extraSmall: 4,
    small: 8,
    medium: 12,
    large: 16,
    extraLarge: 28,
    fullExpressive: 32,
  },
  motion: {
    spatialFast: { damping: 26, stiffness: 380, mass: 0.8 },
    spatialDefault: { damping: 24, stiffness: 300, mass: 1 },
    spatialSlow: { damping: 30, stiffness: 220, mass: 1.1 },
    emphasizedDuration: 500,
    standardDuration: 300,
  },
};

export type ColorScheme = "light" | "dark";
export type ThemeColors = typeof Colors.light;
