import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useAccessibility } from "@/context/AccessibilityContext";

export function useTheme() {
  const colorScheme = useColorScheme();
  const { settings, fontScale } = useAccessibility();
  const isDark = colorScheme === "dark";
  
  let theme;
  if (settings.highContrast) {
    theme = isDark ? Colors.highContrast.dark : Colors.highContrast.light;
  } else {
    theme = colorScheme === "dark" ? Colors.dark : Colors.light;
  }

  return {
    theme,
    isDark,
    highContrast: settings.highContrast,
    largeText: settings.largeText,
    fontScale,
    reducedMotion: settings.reducedMotion,
  };
}
