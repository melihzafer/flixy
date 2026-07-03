import {
  MOOD_PRESETS,
  MoodPresetSchema,
  VIBE_PRESETS,
  VibePresetSchema,
  vibeToFilter,
  vibesToGenres,
} from '../deck';

describe('deck schema extensions', () => {
  it('surfaces all 10 mood presets as enum members', () => {
    const ids = Object.keys(MOOD_PRESETS);
    expect(ids).toEqual([
      'cozy',
      'edge_of_seat',
      'mind_bender',
      'feel_good',
      'short_pick',
      'classic',
      'dark',
      'romantic',
      'epic',
      'chill',
    ]);
    for (const id of ids) {
      expect(MoodPresetSchema.safeParse(id).success).toBe(true);
    }
  });

  it('rejects unknown mood presets', () => {
    expect(MoodPresetSchema.safeParse('rowdy').success).toBe(false);
  });

  it('defines the 12 vibe presets as enum members', () => {
    const ids = Object.keys(VIBE_PRESETS);
    expect(ids).toHaveLength(12);
    for (const id of ids) {
      expect(VibePresetSchema.safeParse(id).success).toBe(true);
    }
  });

  it('aggregates genres across multiple selected vibes (deduped)', () => {
    const genres = vibesToGenres(['dark', 'epic']);
    expect(genres).not.toBeNull();
    expect(new Set(genres)).toEqual(
      new Set(['horror', 'thriller', 'crime', 'action', 'adventure', 'fantasy', 'sci_fi']),
    );
  });

  it('returns null when no vibes are selected', () => {
    expect(vibesToGenres(null)).toBeNull();
    expect(vibesToGenres([])).toBeNull();
  });

  it('resolves a vibe preset to its filter shape', () => {
    expect(vibeToFilter('dark')).toEqual({ genres: ['horror', 'thriller', 'crime'] });
    expect(vibeToFilter(null)).toEqual({});
  });
});
