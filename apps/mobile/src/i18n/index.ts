import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { setTmdbLanguage } from '../lib/tmdb';

import bg from './locales/bg.json';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ptBR from './locales/pt-BR.json';
import tr from './locales/tr.json';

const resources = {
  en: { translation: en },
  tr: { translation: tr },
  bg: { translation: bg },
  de: { translation: de },
  es: { translation: es },
  fr: { translation: fr },
  'pt-BR': { translation: ptBR },
};

// Languages users can actually pick today. Translations for the rest are
// incomplete, so they are hidden from the selectors and excluded from
// auto-detection until they are finished.
export const ENABLED_LANGUAGES = ['en', 'tr'] as const;
export type EnabledLanguage = (typeof ENABLED_LANGUAGES)[number];

const ENABLED_LANG_SET = new Set<string>(ENABLED_LANGUAGES);

export function isLanguageEnabled(code: string): boolean {
  return ENABLED_LANG_SET.has(code);
}

function detectInitialLanguage(): string {
  const locales = Localization.getLocales() ?? [];
  for (const loc of locales) {
    const tag = loc.languageTag?.replace('_', '-');
    if (tag && ENABLED_LANG_SET.has(tag)) return tag;
    const code = loc.languageCode;
    if (code && ENABLED_LANG_SET.has(code)) return code;
  }
  return 'en';
}

const initialLanguage = detectInitialLanguage();

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v3',
});

// Keep TMDB content (titles, overviews for both movies and series) localized to
// the active app language, and re-localize whenever the user switches it.
setTmdbLanguage(initialLanguage);
i18n.on('languageChanged', (lng) => setTmdbLanguage(lng));

export default i18n;
