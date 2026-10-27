import { SupportedLanguage, TranslationStrings, SUPPORTED_LANGUAGES, RegionMode, RegionConfig, REGION_CONFIGS } from './types';
import en from './translations/en';
import es from './translations/es';
import fr from './translations/fr';
import zh from './translations/zh';
import ar from './translations/ar';
import pt from './translations/pt';
import vi from './translations/vi';
import ko from './translations/ko';
import hi from './translations/hi';
import pa from './translations/pa';
import ru from './translations/ru';
import ja from './translations/ja';
import de from './translations/de';
import bn from './translations/bn';
import tr from './translations/tr';
import it from './translations/it';
import th from './translations/th';
import ur from './translations/ur';
import id from './translations/id';
import tl from './translations/tl';
import sw from './translations/sw';
import ta from './translations/ta';
import mr from './translations/mr';
import fa from './translations/fa';
import te from './translations/te';
import ne from './translations/ne';
import gu from './translations/gu';
import ms from './translations/ms';
import pl from './translations/pl';
import uk from './translations/uk';
import nl from './translations/nl';
import el from './translations/el';
import he from './translations/he';
import ro from './translations/ro';
import cs from './translations/cs';
import hu from './translations/hu';
import am from './translations/am';
import my from './translations/my';
import ha from './translations/ha';
import yo from './translations/yo';
import ig from './translations/ig';
import zu from './translations/zu';
import so from './translations/so';
import af from './translations/af';
import kn from './translations/kn';
import ml from './translations/ml';
import or from './translations/or';
import km from './translations/km';
import ps from './translations/ps';
import ti from './translations/ti';
import ht from './translations/ht';
import hmn from './translations/hmn';

const translations: Record<SupportedLanguage, TranslationStrings> = {
  en,
  es,
  fr,
  zh,
  ar,
  pt,
  vi,
  ko,
  hi,
  pa,
  ru,
  ja,
  de,
  bn,
  tr,
  it,
  th,
  ur,
  id,
  tl,
  sw,
  ta,
  mr,
  fa,
  te,
  ne,
  gu,
  ms,
  pl,
  uk,
  nl,
  el,
  he,
  ro,
  cs,
  hu,
  am,
  my,
  ha,
  yo,
  ig,
  zu,
  so,
  af,
  kn,
  ml,
  or,
  km,
  ps,
  ti,
  ht,
  hmn,
};

export function getTranslations(language: SupportedLanguage): TranslationStrings {
  return translations[language] || translations.en;
}

export function getLanguageInfo(code: SupportedLanguage) {
  return SUPPORTED_LANGUAGES.find(l => l.code === code) || SUPPORTED_LANGUAGES[0];
}

export function isRTL(language: SupportedLanguage): boolean {
  const info = getLanguageInfo(language);
  return info.rtl;
}

export function getRegionConfig(mode: RegionMode): RegionConfig {
  return REGION_CONFIGS[mode];
}

export function getDefaultRegion(language: SupportedLanguage): RegionMode {
  return language === 'en' ? 'us' : 'international';
}

export { SUPPORTED_LANGUAGES, REGION_CONFIGS };
export type { SupportedLanguage, TranslationStrings, RegionMode, RegionConfig };
