import type { TFunction } from 'i18next';

import type { StreamingService } from '@flixy/shared';

import type { PrefsRow } from '../onboarding/hooks';
import type { ProfileRow } from './hooks';

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  tr: 'Türkçe',
  bg: 'Български',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
  'pt-BR': 'Português (Brasil)',
};

type ProfilePreferenceDisplayInput = {
  profile: ProfileRow | null | undefined;
  prefs: PrefsRow | null | undefined;
  services?: StreamingService[];
  signedIn: boolean;
  isPreviewUser: boolean;
  t: TFunction;
};

export type ProfilePreferenceDisplay = {
  displayName: string;
  handleText: string;
  profileSummary: string;
  regionText: string;
  languageText: string;
  servicesSummary: string;
  genresSummary: string;
  hasProfileDetails: boolean;
  hasServices: boolean;
  hasGenres: boolean;
};

export function toProfilePreferenceDisplay({
  profile,
  prefs,
  services = [],
  signedIn,
  isPreviewUser,
  t,
}: ProfilePreferenceDisplayInput): ProfilePreferenceDisplay {
  const displayName = clean(profile?.display_name);
  const handle = clean(profile?.handle);
  const hasProfileDetails = !!displayName || !!handle;
  const serviceNameById = new Map(services.map((service) => [service.id, service.name]));

  return {
    displayName:
      displayName ??
      (signedIn
        ? t('display.nameNotSet', 'Name not set')
        : isPreviewUser
          ? t('display.anonymousPreview', 'Anonymous preview')
          : t('display.addProfileDetails', 'Add profile details')),
    handleText:
      handle !== null
        ? `@${handle}`
        : signedIn
          ? t('display.handleNotSet', 'Handle not set')
          : isPreviewUser
            ? t('display.previewMode', 'Preview mode')
            : t('display.noAccountYet', 'No account yet'),
    profileSummary: summarizeProfile(displayName, handle, signedIn, isPreviewUser, t),
    regionText: clean(profile?.region) ?? t('display.regionNotSet', 'Region not set'),
    languageText: languageLabel(clean(profile?.language), t),
    servicesSummary: summarizeList(
      (prefs?.selected_services ?? []).map((id) => serviceNameById.get(id) ?? humanizeId(id)),
      t('display.noServices', 'No services selected'),
    ),
    genresSummary: summarizeList(
      (prefs?.selected_genres ?? []).map((id) => t(`genres.${id}`, humanizeId(id))),
      t('display.noGenres', 'No genres selected'),
    ),
    hasProfileDetails,
    hasServices: (prefs?.selected_services ?? []).length > 0,
    hasGenres: (prefs?.selected_genres ?? []).length > 0,
  };
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function languageLabel(language: string | null, t: TFunction): string {
  if (!language) return t('display.languageNotSet', 'Language not set');
  return LANGUAGE_LABELS[language] ?? language;
}

function summarizeProfile(
  displayName: string | null,
  handle: string | null,
  signedIn: boolean,
  isPreviewUser: boolean,
  t: TFunction,
) {
  if (displayName && handle) return `${displayName} · @${handle}`;
  if (displayName) return displayName;
  if (handle) return `@${handle}`;
  if (signedIn) return t('display.addProfileDetails', 'Add profile details');
  return isPreviewUser
    ? t('display.anonymousPreview', 'Anonymous preview')
    : t('display.noAccountYet', 'No account yet');
}

function summarizeList(values: string[], emptyText: string): string {
  if (values.length === 0) return emptyText;
  return values.join(', ');
}

function humanizeId(id: string): string {
  return id
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
