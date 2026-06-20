jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));

import i18n from '../index';
import en from '../locales/en.json';

describe('i18n locales', () => {
  const allLangs = ['en', 'de', 'es', 'fr', 'pt-BR'] as const;

  for (const lang of allLangs) {
    it(`exposes a non-empty auth.signIn title for ${lang}`, async () => {
      await i18n.changeLanguage(lang);
      const value = i18n.t('auth.signInTitle', { lng: lang });
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    });
  }

  it('falls back to en when a key is missing in a non-en locale', async () => {
    await i18n.changeLanguage('de');
    // `smoke.ready` exists only in en, so de should fall back to en
    // when a non-keyed lookup is performed via t.
    const fallback = i18n.t('smoke.ready');
    expect(fallback).toBe(en.smoke.ready);
  });

  it('returns German title when language is set to de', async () => {
    await i18n.changeLanguage('de');
    expect(i18n.t('auth.signInTitle')).toBe('Willkommen zurück');
  });

  it('returns Spanish title when language is set to es', async () => {
    await i18n.changeLanguage('es');
    expect(i18n.t('auth.signInTitle')).toBe('Bienvenido de vuelta');
  });

  it('returns French title when language is set to fr', async () => {
    await i18n.changeLanguage('fr');
    expect(i18n.t('auth.signInTitle')).toBe('Bon retour');
  });

  it('returns pt-BR title when language is set to pt-BR', async () => {
    await i18n.changeLanguage('pt-BR');
    expect(i18n.t('auth.signInTitle')).toBe('Bem-vindo de volta');
  });
});
