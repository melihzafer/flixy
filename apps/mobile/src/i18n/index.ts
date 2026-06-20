import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

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

const SUPPORTED_LANGS = new Set(Object.keys(resources));

function detectInitialLanguage(): string {
  const locales = Localization.getLocales() ?? [];
  for (const loc of locales) {
    const tag = loc.languageTag?.replace('_', '-');
    if (tag && SUPPORTED_LANGS.has(tag)) return tag;
    const code = loc.languageCode;
    if (code && SUPPORTED_LANGS.has(code)) return code;
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

export default i18n;
