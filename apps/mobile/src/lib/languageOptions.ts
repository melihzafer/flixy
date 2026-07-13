/**
 * Original-language options shared by the deck FilterSheet and the
 * settings "Content languages" page. IDs are ISO 639-1 codes exactly as TMDB
 * reports `original_language`, so they compare directly against
 * `Title.language` in the deck filter policy.
 */
export const LANGUAGE_OPTIONS = [
  { id: 'en', label: 'English' },
  { id: 'tr', label: 'Turkish' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'it', label: 'Italian' },
  { id: 'ja', label: 'Japanese' },
  { id: 'ko', label: 'Korean' },
  { id: 'hi', label: 'Hindi' },
] as const;

export type LanguageOptionId = (typeof LANGUAGE_OPTIONS)[number]['id'];

export function languageLabel(id: string): string {
  return LANGUAGE_OPTIONS.find((option) => option.id === id)?.label ?? id.toUpperCase();
}
