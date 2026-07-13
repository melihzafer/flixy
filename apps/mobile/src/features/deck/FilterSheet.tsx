import {
  Brain,
  Flame,
  Heart,
  Laugh,
  Moon,
  Rocket,
  Search,
  Sofa,
  Sparkles,
  Timer,
  Trophy,
  Waves,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import type { MoodPreset } from '@flixy/shared';

import { Text } from '../../components/Text';
import { useDeckFilters } from '../../features/deck/filterStore';
import { events } from '../../features/telemetry/events';
import { FALLBACK_GENRES_PARSED, FALLBACK_STREAMING_SERVICES } from '../../lib/fallbackCatalogue';
import { LANGUAGE_OPTIONS } from '../../lib/languageOptions';
import { colors, fonts } from '../../theme/tokens';
import { useUserPreferences } from '../onboarding/hooks';
import { useProfile } from '../profile/hooks';

const MOODS = [
  { id: 'feel_good', label: 'Quick laugh', Icon: Laugh },
  { id: 'edge_of_seat', label: 'Edge of seat', Icon: Search },
  { id: 'cozy', label: 'Comfort watch', Icon: Sofa },
  { id: 'mind_bender', label: 'Mind bender', Icon: Brain },
  { id: 'short_pick', label: 'Short pick', Icon: Timer },
  { id: 'classic', label: 'Classic', Icon: Trophy },
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'romantic', label: 'Romantic', Icon: Heart },
  { id: 'epic', label: 'Epic', Icon: Rocket },
  { id: 'chill', label: 'Chill', Icon: Waves },
] as const;

const VIBES = [
  { id: 'feel_good', label: 'Feel good', Icon: Sparkles },
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'wholesome', label: 'Wholesome', Icon: Heart },
  { id: 'intense', label: 'Intense', Icon: Flame },
  { id: 'slow_burn', label: 'Slow burn', Icon: Timer },
  { id: 'mind_bending', label: 'Mind bending', Icon: Brain },
  { id: 'nostalgic', label: 'Nostalgic', Icon: Trophy },
  { id: 'epic', label: 'Epic', Icon: Rocket },
  { id: 'offbeat', label: 'Offbeat', Icon: Waves },
  { id: 'emotional', label: 'Emotional', Icon: Heart },
  { id: 'funny', label: 'Funny', Icon: Laugh },
  { id: 'surreal', label: 'Surreal', Icon: Rocket },
] as const;

const TYPES = ['Movies', 'Series'] as const;
const TYPE_I18N: Record<(typeof TYPES)[number], string> = {
  Movies: 'filters.kinds.movie',
  Series: 'filters.kinds.tv',
};

const LANGUAGES = LANGUAGE_OPTIONS;

const RUNTIME_RANGES = [
  { key: 'any', label: 'Any length', min: null, max: null },
  { key: 'short', label: 'Under 90 min', min: null, max: 89 },
  { key: 'feature', label: '90–150 min', min: 90, max: 150 },
  { key: 'long', label: 'Over 150 min', min: 151, max: null },
] as const;

const YEAR_RANGES = [
  { key: 'any', label: 'Any year', min: null, max: null },
  { key: 'thisYear', label: 'This year', min: new Date().getFullYear(), max: null },
  { key: 'last5', label: 'Last 5 years', min: new Date().getFullYear() - 4, max: null },
  { key: 'y2020s', label: '2020s', min: 2020, max: null },
  { key: 'y2010s', label: '2010s', min: 2010, max: 2019 },
  { key: 'y2000s', label: '2000s', min: 2000, max: 2009 },
  { key: 'y1990s', label: '1990s', min: 1990, max: 1999 },
  { key: 'y1980s', label: '1980s', min: 1980, max: 1989 },
  { key: 'classics', label: 'Classics', min: null, max: 1979 },
] as const;

const COUNTRIES = [
  { id: 'US', label: 'filters.countries.US' },
  { id: 'GB', label: 'filters.countries.GB' },
  { id: 'TR', label: 'filters.countries.TR' },
  { id: 'KR', label: 'filters.countries.KR' },
  { id: 'JP', label: 'filters.countries.JP' },
  { id: 'IN', label: 'filters.countries.IN' },
  { id: 'DE', label: 'filters.countries.DE' },
  { id: 'ES', label: 'filters.countries.ES' },
  { id: 'FR', label: 'filters.countries.FR' },
  { id: 'IT', label: 'filters.countries.IT' },
  { id: 'BR', label: 'filters.countries.BR' },
  { id: 'MX', label: 'filters.countries.MX' },
] as const;

export function FilterSheet({
  visible,
  onClose,
  advancedAllowed = true,
  onAdvancedBlocked,
}: {
  visible: boolean;
  onClose: () => void;
  advancedAllowed?: boolean;
  onAdvancedBlocked?: () => void;
}) {
  const { t } = useTranslation();
  const {
    forYou,
    mood,
    vibes,
    country,
    kinds,
    minYear,
    maxYear,
    serviceIds,
    genres,
    excludedGenres,
    languages,
    excludedLanguages,
    minRuntime,
    maxRuntime,
    blindDate,
    apply: applyFilters,
    reset,
  } = useDeckFilters();

  const { data: prefs } = useUserPreferences();
  const { data: profile } = useProfile();
  const region = profile?.region ?? 'US';

  const [selMood, setSelMood] = useState<string | null>(mood);
  const [selVibes, setSelVibes] = useState<Set<string>>(new Set(vibes ?? []));
  const [selCountry, setSelCountry] = useState<string | null>(country);
  const [selForYou, setSelForYou] = useState<boolean>(forYou);
  const [types, setTypes] = useState<Set<string>>(
    new Set(
      TYPES.filter((t) => {
        if (t === 'Movies') return kinds.includes('movie');
        if (t === 'Series') return kinds.includes('tv');
        return false;
      }),
    ),
  );
  const [yearRange, setYearRange] = useState<string>(() => `${minYear ?? ''}:${maxYear ?? ''}`);
  const [selServices, setSelServices] = useState<Set<string>>(new Set());
  const [selGenres, setSelGenres] = useState<Set<string>>(new Set());
  const [selExcludedGenres, setSelExcludedGenres] = useState<Set<string>>(new Set());
  const [selLanguages, setSelLanguages] = useState<Set<string>>(new Set());
  const [selExcludedLanguages, setSelExcludedLanguages] = useState<Set<string>>(new Set());
  const [runtimeRange, setRuntimeRange] = useState<string>(
    () => `${minRuntime ?? ''}:${maxRuntime ?? ''}`,
  );
  const openHydratedRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      openHydratedRef.current = false;
      return;
    }
    if (openHydratedRef.current) return;
    if (!prefs && serviceIds == null && genres == null) return;

    setSelMood(mood);
    setSelVibes(new Set(vibes ?? []));
    setSelCountry(country);
    setSelForYou(forYou);
    setTypes(
      new Set(
        TYPES.filter((t) => {
          if (t === 'Movies') return kinds.includes('movie');
          if (t === 'Series') return kinds.includes('tv');
          return false;
        }),
      ),
    );
    setYearRange(`${minYear ?? ''}:${maxYear ?? ''}`);
    setSelServices(new Set(serviceIds ?? prefs?.selected_services ?? []));
    setSelGenres(new Set(genres ?? prefs?.selected_genres ?? []));
    setSelExcludedGenres(new Set(excludedGenres ?? prefs?.excluded_genres ?? []));
    setSelLanguages(new Set(languages ?? prefs?.preferred_languages ?? []));
    setSelExcludedLanguages(new Set(excludedLanguages ?? prefs?.excluded_languages ?? []));
    setRuntimeRange(`${minRuntime ?? ''}:${maxRuntime ?? ''}`);
    openHydratedRef.current = true;
  }, [
    kinds,
    maxYear,
    minYear,
    mood,
    vibes,
    country,
    forYou,
    serviceIds,
    genres,
    excludedGenres,
    languages,
    excludedLanguages,
    minRuntime,
    maxRuntime,
    prefs,
    visible,
  ]);

  const toggleType = (t: string) => {
    const next = new Set(types);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setTypes(next);
    setSelForYou(false);
  };

  const toggleService = (id: string) => {
    const next = new Set(selServices);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelServices(next);
    setSelForYou(false);
  };

  const toggleGenre = (id: string) => {
    const next = new Set(selGenres);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelGenres(next);
    setSelExcludedGenres((current) => {
      const blocked = new Set(current);
      blocked.delete(id);
      return blocked;
    });
    setSelForYou(false);
  };

  const toggleExcludedGenre = (id: string) => {
    const next = new Set(selExcludedGenres);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelExcludedGenres(next);
    setSelGenres((current) => {
      const allowed = new Set(current);
      allowed.delete(id);
      return allowed;
    });
  };

  const toggleLanguage = (id: string, blocked: boolean) => {
    const setter = blocked ? setSelExcludedLanguages : setSelLanguages;
    const next = new Set(blocked ? selExcludedLanguages : selLanguages);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
    const oppositeSetter = blocked ? setSelLanguages : setSelExcludedLanguages;
    oppositeSetter((current) => {
      const opposite = new Set(current);
      opposite.delete(id);
      return opposite;
    });
  };

  const toggleVibe = (id: string) => {
    if (!advancedAllowed) {
      onAdvancedBlocked?.();
      return;
    }
    const next = new Set(selVibes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelVibes(next);
    setSelForYou(false);
  };

  const selectCountry = (id: string) => {
    if (!advancedAllowed) {
      onAdvancedBlocked?.();
      return;
    }
    setSelCountry((prev) => (prev === id ? null : id));
    setSelForYou(false);
  };

  const apply = () => {
    const moodMatch = MOODS.find((m) => m.id === selMood);
    const nextMood: MoodPreset | null = moodMatch ? moodMatch.id : null;
    const knownVibes = VIBES.filter((v) => selVibes.has(v.id)).map((v) => v.id);

    const wantsMovies = types.has('Movies');
    const wantsSeries = types.has('Series');

    const selectedYear = YEAR_RANGES.find(
      (range) => `${range.min ?? ''}:${range.max ?? ''}` === yearRange,
    );
    const selectedRuntime = RUNTIME_RANGES.find(
      (range) => `${range.min ?? ''}:${range.max ?? ''}` === runtimeRange,
    );
    applyFilters({
      forYou: selForYou,
      mood: nextMood,
      vibes: knownVibes.length > 0 ? knownVibes : null,
      country: selCountry,
      kinds: [
        ...(wantsMovies ? (['movie'] as const) : []),
        ...(wantsSeries ? (['tv'] as const) : []),
      ],
      minYear: selectedYear?.min ?? null,
      maxYear: selectedYear?.max ?? null,
      serviceIds: Array.from(selServices),
      genres: Array.from(selGenres),
      excludedGenres: Array.from(selExcludedGenres),
      languages: Array.from(selLanguages),
      excludedLanguages: Array.from(selExcludedLanguages),
      minRuntime: selectedRuntime?.min ?? null,
      maxRuntime: selectedRuntime?.max ?? null,
      blindDate,
    });

    events.filterApplied({
      forYou: selForYou,
      mood: nextMood,
      vibes: selVibes.size > 0 ? Array.from(selVibes) : null,
      country: selCountry,
      kinds: [...(wantsMovies ? ['movie'] : []), ...(wantsSeries ? ['tv'] : [])],
      minYear: selectedYear?.min ?? null,
      maxYear: selectedYear?.max ?? null,
    });

    onClose();
  };

  const resetFilters = () => {
    reset();
    setSelForYou(true);
    setSelMood(null);
    setSelVibes(new Set());
    setSelCountry(null);
    setTypes(new Set(TYPES));
    setYearRange(':');
    setSelServices(new Set(prefs?.selected_services ?? []));
    setSelGenres(new Set(prefs?.selected_genres ?? []));
    setSelExcludedGenres(new Set(prefs?.excluded_genres ?? []));
    setSelLanguages(new Set(prefs?.preferred_languages ?? []));
    setSelExcludedLanguages(new Set(prefs?.excluded_languages ?? []));
    setRuntimeRange(':');
    events.filterApplied({
      forYou: true,
      mood: null,
      vibes: null,
      country: null,
      kinds: ['movie', 'tv'],
      minYear: null,
      maxYear: null,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }} />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#101010',
          borderWidth: 1,
          borderColor: 'rgba(255,77,28,0.12)',
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          paddingHorizontal: 16,
          paddingBottom: 34,
          maxHeight: '85%',
        }}
      >
        {/* Handle */}
        <View
          style={{
            alignSelf: 'center',
            width: 34,
            height: 4,
            borderRadius: 2,
            backgroundColor: 'rgba(255,255,255,0.18)',
            marginTop: 10,
            marginBottom: 0,
          }}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 21,
              color: colors.text,
              paddingTop: 18,
              paddingBottom: 14,
            }}
          >
            {t('filters.sheetTitle', 'What are you in the mood for?')}
          </Text>

          <SectionLabel>{t('filters.sectionForYou', 'For you')}</SectionLabel>
          <Pressable
            testID="filter-for-you"
            accessibilityRole="button"
            accessibilityState={{ selected: selForYou }}
            onPress={() => setSelForYou(!selForYou)}
            style={{
              width: '100%',
              minHeight: 48,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: selForYou ? colors.accentBorder : colors.border,
              backgroundColor: selForYou ? 'rgba(255,77,28,0.14)' : 'rgba(245,245,240,0.035)',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 9,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 18,
            }}
          >
            <Sparkles
              size={18}
              strokeWidth={2.2}
              color={selForYou ? colors.accent : 'rgba(245,245,240,0.55)'}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: fonts.bodySemi,
                  color: selForYou ? colors.text : colors.textMuted,
                }}
              >
                {t('filters.forYouLabel', 'For You')}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: fonts.body,
                  color: colors.textMuted,
                }}
              >
                {t('filters.forYouHint', 'Uses your swipes, saves, and taste to pick for you.')}
              </Text>
            </View>
          </Pressable>

          <SectionLabel>{t('filters.sectionMood', 'Mood presets')}</SectionLabel>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 18,
            }}
          >
            {MOODS.map((m) => {
              const isOn = selMood === m.id;
              const Icon = m.Icon;
              return (
                <Pressable
                  key={m.id}
                  testID={`filter-mood-${m.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isOn }}
                  onPress={() => {
                    if (!advancedAllowed) {
                      onAdvancedBlocked?.();
                      return;
                    }
                    setSelMood(isOn ? null : m.id);
                    setSelForYou(false);
                  }}
                  style={{
                    width: '48%',
                    height: 44,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: isOn ? colors.accentBorder : colors.border,
                    backgroundColor: isOn ? 'rgba(255,77,28,0.14)' : 'rgba(245,245,240,0.035)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 7,
                    paddingHorizontal: 11,
                  }}
                >
                  <Icon
                    size={16}
                    strokeWidth={2.2}
                    color={isOn ? colors.accent : 'rgba(245,245,240,0.45)'}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: fonts.bodyMedium,
                      color: isOn ? colors.text : colors.textMuted,
                    }}
                  >
                    {t(`filters.moods.${m.id}`, m.label)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <SectionLabel>{t('filters.sectionVibes', 'Vibes')}</SectionLabel>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 7,
              marginBottom: 18,
            }}
          >
            {VIBES.map((v) => {
              const isOn = selVibes.has(v.id);
              const Icon = v.Icon;
              return (
                <Pressable
                  key={v.id}
                  testID={`filter-vibe-${v.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isOn }}
                  onPress={() => toggleVibe(v.id)}
                  style={{
                    height: 32,
                    paddingHorizontal: 12,
                    borderRadius: 11,
                    borderWidth: 1,
                    borderColor: isOn ? colors.accentBorder : colors.border,
                    backgroundColor: isOn ? 'rgba(255,77,28,0.14)' : 'rgba(245,245,240,0.035)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Icon
                    size={13}
                    strokeWidth={2.2}
                    color={isOn ? colors.accent : 'rgba(245,245,240,0.45)'}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: fonts.bodyMedium,
                      color: isOn ? colors.text : colors.textMuted,
                    }}
                  >
                    {t(`filters.vibes.${v.id}`, v.label)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <SectionLabel>{t('filters.sectionCountry', 'Country')}</SectionLabel>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 7,
              marginBottom: 18,
            }}
          >
            {COUNTRIES.map((c) => {
              const isOn = selCountry === c.id;
              return (
                <Pressable
                  key={c.id}
                  testID={`filter-country-${c.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isOn }}
                  onPress={() => selectCountry(c.id)}
                  style={{
                    height: 32,
                    paddingHorizontal: 13,
                    borderRadius: 11,
                    borderWidth: 1,
                    borderColor: isOn ? colors.accentBorder : colors.border,
                    backgroundColor: isOn ? 'rgba(255,77,28,0.14)' : 'rgba(245,245,240,0.035)',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: fonts.bodyMedium,
                      color: isOn ? colors.text : colors.textMuted,
                    }}
                  >
                    {t(c.label, c.id)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <SectionLabel>{t('filters.sectionType', 'Content type')}</SectionLabel>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 7,
              marginBottom: 18,
            }}
          >
            {TYPES.map((t_) => {
              const isOn = types.has(t_);
              return (
                <Pressable
                  key={t_}
                  testID={`filter-type-${t_.toLowerCase()}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isOn }}
                  onPress={() => toggleType(t_)}
                  style={{
                    height: 32,
                    paddingHorizontal: 13,
                    borderRadius: 11,
                    borderWidth: 1,
                    borderColor: isOn ? colors.accentBorder : colors.border,
                    backgroundColor: isOn ? 'rgba(255,77,28,0.14)' : 'rgba(245,245,240,0.035)',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: fonts.bodyMedium,
                      color: isOn ? colors.text : colors.textMuted,
                    }}
                  >
                    {t(TYPE_I18N[t_], t_)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <SectionLabel>{t('filters.sectionServices', 'Streaming services')}</SectionLabel>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 7,
              marginBottom: 18,
            }}
          >
            {FALLBACK_STREAMING_SERVICES.filter((s) => s.regions.includes(region)).map((s) => {
              const isOn = selServices.has(s.id);
              return (
                <Pressable
                  key={s.id}
                  testID={`filter-service-${s.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isOn }}
                  onPress={() => toggleService(s.id)}
                  style={{
                    height: 32,
                    paddingHorizontal: 12,
                    borderRadius: 11,
                    borderWidth: 1,
                    borderColor: isOn ? colors.accentBorder : colors.border,
                    backgroundColor: isOn ? 'rgba(255,77,28,0.14)' : 'rgba(245,245,240,0.035)',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: fonts.bodyMedium,
                      color: isOn ? colors.text : colors.textMuted,
                    }}
                  >
                    {s.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <SectionLabel>{t('filters.sectionGenres', 'Preferred genres')}</SectionLabel>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 7,
              marginBottom: 18,
            }}
          >
            {FALLBACK_GENRES_PARSED.map((g) => {
              const isOn = selGenres.has(g.id);
              const label = t(`genres.${g.id}`, g.id.replace(/_/g, ' '));
              return (
                <Pressable
                  key={g.id}
                  testID={`filter-genre-${g.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isOn }}
                  onPress={() => toggleGenre(g.id)}
                  style={{
                    height: 32,
                    paddingHorizontal: 12,
                    borderRadius: 11,
                    borderWidth: 1,
                    borderColor: isOn ? colors.accentBorder : colors.border,
                    backgroundColor: isOn ? 'rgba(255,77,28,0.14)' : 'rgba(245,245,240,0.035)',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: fonts.bodyMedium,
                      color: isOn ? colors.text : colors.textMuted,
                      textTransform: 'capitalize',
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <SectionLabel>{t('filters.sectionHiddenGenres', 'Never show genres')}</SectionLabel>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 7,
              marginBottom: 18,
            }}
          >
            {FALLBACK_GENRES_PARSED.map((g) => {
              const isOn = selExcludedGenres.has(g.id);
              const label = t(`genres.${g.id}`, g.id.replace(/_/g, ' '));
              return (
                <Pressable
                  key={g.id}
                  testID={`filter-excluded-genre-${g.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isOn }}
                  onPress={() => toggleExcludedGenre(g.id)}
                  style={{
                    height: 32,
                    paddingHorizontal: 12,
                    borderRadius: 11,
                    borderWidth: 1,
                    borderColor: isOn ? 'rgba(244,91,91,0.65)' : colors.border,
                    backgroundColor: isOn ? 'rgba(244,91,91,0.14)' : 'rgba(245,245,240,0.035)',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: fonts.bodyMedium,
                      color: isOn ? colors.text : colors.textMuted,
                      textTransform: 'capitalize',
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <SectionLabel>{t('filters.sectionLanguages', 'Original language')}</SectionLabel>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 7,
              marginBottom: 18,
            }}
          >
            {LANGUAGES.map((language) => {
              const isOn = selLanguages.has(language.id);
              return (
                <Pressable
                  key={language.id}
                  testID={`filter-language-${language.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isOn }}
                  onPress={() => toggleLanguage(language.id, false)}
                  style={{
                    height: 32,
                    paddingHorizontal: 12,
                    borderRadius: 11,
                    borderWidth: 1,
                    borderColor: isOn ? colors.accentBorder : colors.border,
                    backgroundColor: isOn ? 'rgba(255,77,28,0.14)' : 'rgba(245,245,240,0.035)',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: fonts.bodyMedium,
                      color: isOn ? colors.text : colors.textMuted,
                    }}
                  >
                    {language.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <SectionLabel>{t('filters.sectionHiddenLanguages', 'Never show languages')}</SectionLabel>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 7,
              marginBottom: 18,
            }}
          >
            {LANGUAGES.map((language) => {
              const isOn = selExcludedLanguages.has(language.id);
              return (
                <Pressable
                  key={language.id}
                  testID={`filter-excluded-language-${language.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isOn }}
                  onPress={() => toggleLanguage(language.id, true)}
                  style={{
                    height: 32,
                    paddingHorizontal: 12,
                    borderRadius: 11,
                    borderWidth: 1,
                    borderColor: isOn ? 'rgba(244,91,91,0.65)' : colors.border,
                    backgroundColor: isOn ? 'rgba(244,91,91,0.14)' : 'rgba(245,245,240,0.035)',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: fonts.bodyMedium,
                      color: isOn ? colors.text : colors.textMuted,
                    }}
                  >
                    {language.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <SectionLabel>{t('filters.sectionYears', 'Release window')}</SectionLabel>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 7,
              marginBottom: 18,
            }}
          >
            {YEAR_RANGES.map((range) => {
              const id = `${range.min ?? ''}:${range.max ?? ''}`;
              const isOn = yearRange === id;
              return (
                <Pressable
                  key={range.label}
                  testID={`filter-year-${range.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isOn }}
                  onPress={() => {
                    if (!advancedAllowed) {
                      onAdvancedBlocked?.();
                      return;
                    }
                    setYearRange(id);
                    setSelForYou(false);
                  }}
                  style={{
                    height: 32,
                    paddingHorizontal: 13,
                    borderRadius: 11,
                    borderWidth: 1,
                    borderColor: isOn ? colors.accentBorder : colors.border,
                    backgroundColor: isOn ? 'rgba(255,77,28,0.14)' : 'rgba(245,245,240,0.035)',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: fonts.bodyMedium,
                      color: isOn ? colors.text : colors.textMuted,
                    }}
                  >
                    {t(`filters.yearRanges.${range.key}`, range.label)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <SectionLabel>{t('filters.sectionRuntime', 'Runtime')}</SectionLabel>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 7,
              marginBottom: 18,
            }}
          >
            {RUNTIME_RANGES.map((range) => {
              const id = `${range.min ?? ''}:${range.max ?? ''}`;
              const isOn = runtimeRange === id;
              return (
                <Pressable
                  key={range.key}
                  testID={`filter-runtime-${range.key}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isOn }}
                  onPress={() => {
                    setRuntimeRange(id);
                    setSelForYou(false);
                  }}
                  style={{
                    height: 32,
                    paddingHorizontal: 13,
                    borderRadius: 11,
                    borderWidth: 1,
                    borderColor: isOn ? colors.accentBorder : colors.border,
                    backgroundColor: isOn ? 'rgba(255,77,28,0.14)' : 'rgba(245,245,240,0.035)',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: fonts.bodyMedium,
                      color: isOn ? colors.text : colors.textMuted,
                    }}
                  >
                    {range.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={apply}
            testID="filter-apply-button"
            accessibilityRole="button"
            disabled={types.size === 0}
            style={{
              width: '100%',
              height: 50,
              backgroundColor: colors.accent,
              borderRadius: 13,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: types.size === 0 ? 0.35 : 1,
            }}
          >
            <Text
              style={{
                fontFamily: fonts.bodySemi,
                fontSize: 15,
                color: colors.onAccent,
              }}
            >
              {t('filters.applyButton', 'Apply filters')}
            </Text>
          </Pressable>
          <Pressable
            onPress={resetFilters}
            testID="filter-reset-button"
            accessibilityRole="button"
            style={{
              width: '100%',
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 8,
            }}
          >
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textMuted }}>
              {t('filters.resetButton', 'Reset filters')}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontSize: 10,
        fontFamily: fonts.bodySemi,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: 'rgba(245,245,240,0.3)',
        marginBottom: 10,
      }}
    >
      {children}
    </Text>
  );
}
