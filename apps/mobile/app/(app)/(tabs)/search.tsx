import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Search as SearchIcon, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, TextInput, View } from 'react-native';

import type { Title } from '@flixy/shared';

import { AppHeader } from '../../../src/components/AppHeader';
import { Screen } from '../../../src/components/Screen';
import { Text } from '../../../src/components/Text';
import { toTitleDisplay } from '../../../src/features/catalogue/display';
import { useTitlesQuery } from '../../../src/features/catalogue/hooks';
import { getSearchUiState, useSearchTitles } from '../../../src/features/search/hooks';
import { events } from '../../../src/features/telemetry/events';
import { colors, fonts } from '../../../src/theme/tokens';

export default function SearchScreen() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const { data, isFetching, isError, refetch } = useSearchTitles(q);
  const { data: trending, refetch: refetchTrending } = useTitlesQuery({ limit: 12 });

  useEffect(() => {
    if (q.trim().length >= 2 && data && !isFetching) {
      events.searchSubmitted(q.trim(), data.titles.length);
      events.searchQuery({
        queryLength: q.trim().length,
        resultCount: data.titles.length,
        isFallback: data.diagnostics.isFallback,
      });
      if (data.titles.length === 0) {
        events.searchNoResult({
          queryLength: q.trim().length,
          isFallback: data.diagnostics.isFallback,
        });
      }
    }
  }, [q, data, isFetching]);

  const showTrending = q.trim().length < 2;
  const searchState = getSearchUiState({ query: q, isFetching, result: data });
  const activeDiagnostics = showTrending ? trending?.diagnostics : data?.diagnostics;
  const results = showTrending ? (trending?.titles ?? []) : (data?.titles ?? []);
  // D4: only surface degraded copy when offline (unconfigured) or query failed.
  // `live_empty` is a clean miss — show the "no results" empty state instead.
  const degradedLabel =
    activeDiagnostics?.fallbackReason === 'supabase_unconfigured'
      ? t('search.offlineCatalogue', 'Limited offline results')
      : activeDiagnostics?.fallbackReason === 'query_failed'
        ? t('search.catalogueFallback', 'Searching a smaller set')
        : null;

  return (
    <Screen scroll={false}>
      <AppHeader title={t('search.title')} />
      <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
        {/* Search bar */}
        <View
          style={{
            height: 48,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 9,
            paddingHorizontal: 13,
            marginBottom: 22,
          }}
        >
          <SearchIcon size={17} color="rgba(245,245,240,0.38)" strokeWidth={2.1} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t('search.placeholderLong', 'Titles, genres, directors…')}
            accessibilityLabel={t('search.inputLabel', 'Search titles, genres, or directors')}
            placeholderTextColor="rgba(245,245,240,0.28)"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={{
              flex: 1,
              color: colors.text,
              fontFamily: fonts.body,
              fontSize: 14,
              padding: 0,
            }}
          />
          {q.length > 0 && (
            <Pressable
              testID="search-clear-button"
              accessibilityRole="button"
              accessibilityLabel={t('search.clear', 'Clear search')}
              onPress={() => setQ('')}
              hitSlop={8}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={16} color="rgba(245,245,240,0.44)" strokeWidth={2.2} />
            </Pressable>
          )}
        </View>
      </View>

      {isError ? (
        <View style={{ padding: 24, alignItems: 'center', gap: 10 }}>
          <Text style={{ color: colors.left, textAlign: 'center' }}>{t('search.error')}</Text>
          <Text style={{ color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
            {t(
              'search.errorHint',
              'Check your connection, then retry. If live search is unavailable, a smaller offline set may still appear.',
            )}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('search.retry', 'Retry search')}
            onPress={() => {
              void refetch();
              void refetchTrending();
            }}
            style={({ pressed }) => ({
              minHeight: 40,
              paddingHorizontal: 18,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.surface3 : colors.surface2,
              borderWidth: 1,
              borderColor: colors.border2,
            })}
          >
            <Text style={{ fontFamily: fonts.bodySemi, color: colors.text }}>
              {t('common.retry')}
            </Text>
          </Pressable>
        </View>
      ) : searchState === 'searching' ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : showTrending ? (
        <FlatList
          data={results.slice(0, 12)}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            <SearchListHeader
              title={t('search.trendingNow', 'Trending now')}
              degradedLabel={degradedLabel}
            />
          }
          renderItem={({ item }) => <SearchRow title={item} />}
        />
      ) : searchState === 'empty' || results.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 40, gap: 10 }}>
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(245,245,240,0.045)',
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <SearchIcon size={27} color="rgba(245,245,240,0.34)" strokeWidth={1.9} />
          </View>
          {degradedLabel && (
            <Text style={{ fontSize: 11, color: colors.accent }}>{degradedLabel}</Text>
          )}
          <Text
            style={{
              fontSize: 13,
              color: 'rgba(245,245,240,0.38)',
            }}
          >
            {t('search.noResultsFor', 'No results for "{{query}}"', { query: q })}
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            degradedLabel ? (
              <SearchListHeader
                title={t('search.resultsTitle', 'Search results')}
                degradedLabel={degradedLabel}
              />
            ) : null
          }
          renderItem={({ item }) => <SearchRow title={item} />}
        />
      )}
    </Screen>
  );
}

function SearchListHeader({
  title,
  degradedLabel,
}: {
  title: string;
  degradedLabel: string | null;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 10,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontFamily: fonts.bodySemi,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: 'rgba(245,245,240,0.3)',
        }}
      >
        {title}
      </Text>
      {degradedLabel && <Text style={{ fontSize: 10, color: colors.accent }}>{degradedLabel}</Text>}
    </View>
  );
}

function SearchRow({ title }: { title: Title }) {
  const display = toTitleDisplay(title);
  return (
    <Pressable
      testID="search-result-row"
      accessibilityRole="button"
      accessibilityLabel={`Open ${display.title} details${display.year ? `, ${display.year}` : ''}`}
      onPress={() => {
        events.searchResultOpened(title.id);
        router.push({ pathname: '/(app)/title/[id]', params: { id: title.id } });
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        paddingVertical: 7,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.04)',
      }}
    >
      {display.posterUrl ? (
        <Image
          source={{ uri: display.posterUrl }}
          style={{ width: 36, height: 50, borderRadius: 6, backgroundColor: display.gradient[0] }}
        />
      ) : (
        <View
          style={{
            width: 36,
            height: 50,
            borderRadius: 6,
            overflow: 'hidden',
            backgroundColor: display.gradient[0],
          }}
        />
      )}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: fonts.bodyMedium,
            fontSize: 14,
            color: colors.text,
          }}
          numberOfLines={1}
        >
          {display.title}
        </Text>
        <Text
          style={{
            fontSize: 10,
            color: 'rgba(245,245,240,0.38)',
            marginTop: 1,
          }}
        >
          {display.year} · {display.genres[0] ?? display.kind}
        </Text>
      </View>
    </Pressable>
  );
}
