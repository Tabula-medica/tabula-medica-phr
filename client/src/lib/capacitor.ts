// Web-safe Capacitor wrapper. Only @capacitor/core is a real dependency; the native
// plugin packages (@capacitor/app, status-bar, etc.) are NOT installed for the web
// build. They are imported DYNAMICALLY behind an isNative guard, so the web bundle
// never needs to resolve them at runtime. (vite marks them external so the build
// doesn't try to bundle them — see vite.config.ts build.rollupOptions.external.)
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();
export const isIOS = platform === 'ios';
export const isAndroid = platform === 'android';
export const isWeb = platform === 'web';

export async function initCapacitor() {
  if (!isNative) return;
  const { App } = await import('@capacitor/app');
  const { StatusBar, Style } = await import('@capacitor/status-bar');
  const { SplashScreen } = await import('@capacitor/splash-screen');
  const { Keyboard } = await import('@capacitor/keyboard');

  await SplashScreen.hide();

  if (isIOS) {
    try {
      await StatusBar.setStyle({ style: Style.Dark });
    } catch {}
  }

  App.addListener('appUrlOpen', ({ url }: { url: string }) => {
    const slug = url.split('tabulamedica.health').pop();
    if (slug) window.location.hash = slug;
  });

  App.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
    if (canGoBack) window.history.back();
    else App.exitApp();
  });

  try {
    Keyboard.addListener('keyboardWillShow', (info: { keyboardHeight: number }) => {
      document.body.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
    });
    Keyboard.addListener('keyboardWillHide', () => {
      document.body.style.setProperty('--keyboard-height', '0px');
    });
  } catch {}
}

export async function hapticFeedback(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (!isNative) return;
  const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
  const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
  await Haptics.impact({ style: map[style] });
}

export async function openExternalUrl(url: string) {
  if (isNative) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url, presentationStyle: 'popover' });
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

export async function shareContent(opts: { title: string; text: string; url?: string }) {
  if (isNative) {
    const { Share } = await import('@capacitor/share');
    await Share.share(opts);
  } else if (navigator.share) {
    await navigator.share(opts);
  }
}

export async function setPreference(key: string, value: string) {
  if (isNative) {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key, value });
  } else {
    try { localStorage.setItem(key, value); } catch {}
  }
}

export async function getPreference(key: string): Promise<string | null> {
  if (isNative) {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key });
    return value;
  }
  try { return localStorage.getItem(key); } catch { return null; }
}

export async function removePreference(key: string) {
  if (isNative) {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.remove({ key });
  } else {
    try { localStorage.removeItem(key); } catch {}
  }
}
