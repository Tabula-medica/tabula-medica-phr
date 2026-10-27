import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager, Alert, Platform } from 'react-native';
import { reloadAppAsync } from 'expo';
import * as Localization from 'expo-localization';
import { SupportedLanguage, TranslationStrings, SUPPORTED_LANGUAGES, LanguageInfo } from '../i18n/types';
import { getTranslations, isRTL, getLanguageInfo } from '../i18n';

const LANGUAGE_STORAGE_KEY = '@tabula_medica_language';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  t: TranslationStrings;
  isRTL: boolean;
  languageInfo: LanguageInfo;
  supportedLanguages: LanguageInfo[];
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: async () => {},
  t: getTranslations('en'),
  isRTL: false,
  languageInfo: SUPPORTED_LANGUAGES[0],
  supportedLanguages: SUPPORTED_LANGUAGES,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>('en');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved && SUPPORTED_LANGUAGES.some(l => l.code === saved)) {
        // User has an explicit preference — honour it.
        setLanguageState(saved as SupportedLanguage);
        const rtl = isRTL(saved as SupportedLanguage);
        if (I18nManager.isRTL !== rtl) {
          I18nManager.allowRTL(rtl);
          I18nManager.forceRTL(rtl);
        }
      } else {
        // First launch (or no saved preference): auto-detect the device locale
        // via expo-localization and match it to the closest supported language.
        // e.g. "es-419" → "es", "zh-Hant-TW" → "zh".
        const deviceLocales: Localization.Locale[] = Localization.getLocales?.() ?? [];
        const detected = deviceLocales
          .map(l => l.languageCode ?? l.languageTag.split('-')[0])
          .find(code => SUPPORTED_LANGUAGES.some(l => l.code === code));

        if (detected) {
          const lang = detected as SupportedLanguage;
          setLanguageState(lang);
          await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
          const rtl = isRTL(lang);
          if (I18nManager.isRTL !== rtl) {
            I18nManager.allowRTL(rtl);
            I18nManager.forceRTL(rtl);
          }
        }
        // If no match, keep the default 'en' set in useState.
      }
    } catch (error) {
      console.error('Error loading language:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const setLanguage = useCallback(async (lang: SupportedLanguage) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      const rtl = isRTL(lang);
      const rtlChanged = I18nManager.isRTL !== rtl;
      if (rtlChanged) {
        I18nManager.allowRTL(rtl);
        I18nManager.forceRTL(rtl);
      }
      setLanguageState(lang);
      // React Native requires a reload for RTL to take effect
      if (rtlChanged) {
        if (Platform.OS !== 'web') {
          Alert.alert(
            'Restart Required',
            'The app needs to restart to apply the new text direction.',
            [
              {
                text: 'Restart Now',
                onPress: async () => {
                  try {
                    await reloadAppAsync();
                  } catch {
                    // In development, reloadAsync may not be available
                    console.warn('Please restart the app manually to apply RTL changes.');
                  }
                },
              },
            ],
            { cancelable: false }
          );
        }
      }
    } catch (error) {
      console.error('Error saving language:', error);
    }
  }, []);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: getTranslations(language),
    isRTL: isRTL(language),
    languageInfo: getLanguageInfo(language),
    supportedLanguages: SUPPORTED_LANGUAGES,
  }), [language, setLanguage]);

  if (!isLoaded) {
    return null;
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
