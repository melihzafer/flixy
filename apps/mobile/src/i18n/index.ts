import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import bg from './locales/bg.json';
import en from './locales/en.json';
import tr from './locales/tr.json';

// Phase 1: en/tr/bg fully translated. de/es/fr/pt-BR keys fall back to en
// per the build prompt; their resource files will be added in Phase 2.
const resources = {
  en: { translation: en },
  tr: { translation: tr },
  bg: { translation: bg },
};

const deviceLocale = Localization.getLocales()[0]?.languageCode ?? 'en';
const initialLanguage = deviceLocale in resources ? deviceLocale : 'en';

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export default i18n;
