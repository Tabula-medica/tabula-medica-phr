import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Keyboard } from '@capacitor/keyboard';
import { Browser } from '@capacitor/browser';
import { Share } from '@capacitor/share';
import { Preferences } from '@capacitor/preferences';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();
export const isIOS = platform === 'ios';
export const isAndroid = platform === 'android';
export const isWeb = platform === 'web';

export async function initCapacitor() {
  if (!isNative) return;

  await SplashScreen.hide();

  if (isIOS) {
    try {
      await StatusBar.setStyle({ style: Style.Dark });
    } catch {}
  }

  App.addListener('appUrlOpen', ({ url }) => {
    const slug = url.split('tabulamedica.health').pop();
    if (slug) {
      window.location.hash = slug;
    }
  });

  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      App.exitApp();
    }
  });

  try {
    Keyboard.addListener('keyboardWillShow', (info) => {
      document.body.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
    });

    Keyboard.addListener('keyboardWillHide', () => {
      document.body.style.setProperty('--keyboard-height', '0px');
    });
  } catch {}
}

export async function hapticFeedback(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (!isNative) return;
  const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
  await Haptics.impact({ style: map[style] });
}

export async function openExternalUrl(url: string) {
  if (isNative) {
    await Browser.open({ url, presentationStyle: 'popover' });
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

export async function shareContent(opts: { title: string; text: string; url?: string }) {
  if (isNative) {
    await Share.share(opts);
  } else if (navigator.share) {
    await navigator.share(opts);
  }
}

export async function setPreference(key: string, value: string) {
  await Preferences.set({ key, value });
}

export async function getPreference(key: string): Promise<string | null> {
  const { value } = await Preferences.get({ key });
  return value;
}

export async function removePreference(key: string) {
  await Preferences.remove({ key });
}
