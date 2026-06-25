import { Laugh, Search, Sofa } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { Text } from '../../components/Text';
import { useDeckFilters } from '../../features/deck/filterStore';
import { events } from '../../features/telemetry/events';
import { FALLBACK_GENRES_PARSED, FALLBACK_STREAMING_SERVICES } from '../../lib/fallbackCatalogue';
import { colors, fonts } from '../../theme/tokens';
import { useUserPreferences } from '../onboarding/hooks';
import { useProfile } from '../profile/hooks';

const MOODS = [
  { id: 'feel_good', label: 'Quick laugh', Icon: Laugh },
  { id: 'edge_of_seat', label: 'Edge of seat', Icon: Search },
  { id: 'cozy', label: 'Comfort watch', Icon: Sofa },
] as const;

const TYPES = ['Movies', 'Series'] as const;
const TYPE_I18N: Record<(typeof TYPES)[number], string> = {
  Movies: 'filters.kinds.movie',
  Series: 'filters.kinds.tv',
};
const YEAR_RANGES = [
  { key: 'any', label: 'Any year', min: null, max: null },
  { key: 'y2020s', label: '2020s', min: 2020, max: null },
  { key: 'y2010s', label: '2010s', min: 2010, max: 2019 },
  { key: 'classics', label: 'Classics', min: null, max: 1999 },
] as const;

export function FilterSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const {
    mood,
    kinds,
    minYear,
    maxYear,
    serviceIds,
    genres,
    setMood,
    toggleKind,
    setYears,
    setServices,
    setGenres,
    reset,
  } = useDeckFilters();

  const { data: prefs } = useUserPreferences();
  const { data: profile } = useProfile();
  const region = profile?.region ?? 'US';

  const [selMood, setSelMood] = useState<string | null>(mood);
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
  const openHydratedRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      openHydratedRef.current = false;
      return;
    }
    if (openHydratedRef.current) return;
    if (!prefs && serviceIds == null && genres == null) return;

    setSelMood(mood);
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
    openHydratedRef.current = true;
  }, [kinds, maxYear, minYear, mood, serviceIds, genres, prefs, visible]);

  const toggleType = (t: string) => {
    const next = new Set(types);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setTypes(next);
  };

  const toggleService = (id: string) => {
    const next = new Set(selServices);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelServices(next);
  };

  const toggleGenre = (id: string) => {
    const next = new Set(selGenres);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelGenres(next);
  };

  const apply = () => {
    const nextMood =
      selMood === 'feel_good' || selMood === 'edge_of_seat' || selMood === 'cozy' ? selMood : null;
    setMood(nextMood);

    const wantsMovies = types.has('Movies');
    const wantsSeries = types.has('Series');
    if (wantsMovies && !kinds.includes('movie')) toggleKind('movie');
    if (!wantsMovies && kinds.includes('movie')) toggleKind('movie');
    if (wantsSeries && !kinds.includes('tv')) toggleKind('tv');
    if (!wantsSeries && kinds.includes('tv')) toggleKind('tv');

    const selectedYear = YEAR_RANGES.find(
      (range) => `${range.min ?? ''}:${range.max ?? ''}` === yearRange,
    );
    setYears(selectedYear?.min ?? null, selectedYear?.max ?? null);
    setServices(Array.from(selServices));
    setGenres(Array.from(selGenres));

    events.filterApplied({
      mood: nextMood,
      kinds: [...(wantsMovies ? ['movie'] : []), ...(wantsSeries ? ['tv'] : [])],
      minYear: selectedYear?.min ?? null,
      maxYear: selectedYear?.max ?? null,
    });

    onClose();
  };

  const resetFilters = () => {
    reset();
    setSelMood(null);
    setTypes(new Set(TYPES));
    setYearRange(':');
    setSelServices(new Set(prefs?.selected_services ?? []));
    setSelGenres(new Set(prefs?.selected_genres ?? []));
    events.filterApplied({ mood: null, kinds: ['movie', 'tv'], minYear: null, maxYear: null });
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
                  onPress={() => setSelMood(isOn ? null : m.id)}
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
                  onPress={() => setYearRange(id)}
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
