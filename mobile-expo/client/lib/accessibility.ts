import { AccessibilityInfo, Platform, PixelRatio } from "react-native";

export function announceForAccessibility(message: string): void {
  if (Platform.OS === "web") {
    const el = document.getElementById("a11y-live-region");
    if (el) {
      el.textContent = "";
      setTimeout(() => {
        el.textContent = message;
      }, 50);
    }
    return;
  }
  AccessibilityInfo.announceForAccessibility(message);
}

export function setupWebLiveRegion(): void {
  if (Platform.OS !== "web") return;
  if (document.getElementById("a11y-live-region")) return;
  const el = document.createElement("div");
  el.id = "a11y-live-region";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.setAttribute("aria-atomic", "true");
  el.style.position = "absolute";
  el.style.width = "1px";
  el.style.height = "1px";
  el.style.overflow = "hidden";
  el.style.clip = "rect(0,0,0,0)";
  el.style.whiteSpace = "nowrap";
  document.body.appendChild(el);
}

export const MINIMUM_TOUCH_SIZE = 44;

export const WCAG_CONTRAST_RATIO = {
  AA_NORMAL: 4.5,
  AA_LARGE: 3,
  AAA_NORMAL: 7,
  AAA_LARGE: 4.5,
};

export const SECTION_508_GUIDELINES = {
  minTouchTarget: 44,
  minFontSize: 12,
  focusIndicatorWidth: 2,
  animationDuration: 200,
  maxContentWidth: 800,
  skipNavEnabled: true,
  screenReaderOptimized: true,
  keyboardNavigable: true,
  colorNotSoleIndicator: true,
  timingAdjustable: true,
  noAutoPlay: true,
};

export function getScaledFontSize(baseSize: number, scaleFactor: number = 1): number {
  const fontScale = PixelRatio.getFontScale();
  return Math.round(baseSize * fontScale * scaleFactor);
}

export function getAccessibilityProps(
  label: string,
  role?: 'button' | 'link' | 'header' | 'search' | 'image' | 'text' | 'alert' | 'checkbox' | 'radio' | 'tab' | 'menu' | 'menuitem' | 'progressbar' | 'slider' | 'switch' | 'timer',
  hint?: string,
  state?: { disabled?: boolean; selected?: boolean; checked?: boolean; expanded?: boolean },
) {
  return {
    accessible: true,
    accessibilityLabel: label,
    ...(role ? { accessibilityRole: role } : {}),
    ...(hint ? { accessibilityHint: hint } : {}),
    ...(state ? {
      accessibilityState: {
        ...(state.disabled !== undefined ? { disabled: state.disabled } : {}),
        ...(state.selected !== undefined ? { selected: state.selected } : {}),
        ...(state.checked !== undefined ? { checked: state.checked } : {}),
        ...(state.expanded !== undefined ? { expanded: state.expanded } : {}),
      },
    } : {}),
  };
}

export function setupSkipNavigation(): void {
  if (Platform.OS !== "web") return;
  if (document.getElementById("skip-nav-link")) return;
  const link = document.createElement("a");
  link.id = "skip-nav-link";
  link.href = "#main-content";
  link.textContent = "Skip to main content";
  link.style.position = "absolute";
  link.style.top = "-40px";
  link.style.left = "0";
  link.style.backgroundColor = "#000";
  link.style.color = "#fff";
  link.style.padding = "8px 16px";
  link.style.zIndex = "10000";
  link.style.transition = "top 0.2s";
  link.addEventListener("focus", () => {
    link.style.top = "0";
  });
  link.addEventListener("blur", () => {
    link.style.top = "-40px";
  });
  document.body.insertBefore(link, document.body.firstChild);
}

export function setupFocusIndicators(): void {
  if (Platform.OS !== "web") return;
  const style = document.createElement("style");
  style.textContent = `
    *:focus-visible {
      outline: 2px solid #1a73e8 !important;
      outline-offset: 2px !important;
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
    @media (prefers-contrast: more) {
      body {
        --high-contrast: 1;
      }
    }
  `;
  document.head.appendChild(style);
}
