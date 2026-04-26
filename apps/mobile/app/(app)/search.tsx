import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Image, Pressable, TextInput, View } from 'react-native';

import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useSearchTitles } from '../../src/features/search/hooks';
import { events } from '../../src/features/telemetry/events';

/**
 * Search screen (FSD § 3.10). Debounced ILIKE query against titles. Tap a row
 * to open the detail view.
 */
export default function SearchScreen() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const { data, isFetching, isError } = useSearchTitles(q);

  useEffect(() => {
    if (q.trim().length >= 2 && data) {
      events.searchSubmitted(q.trim(), data.length);
    }
  }, [q, data]);

  return (
    <Screen scroll={false} title={t('search.title')}>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder={t('search.placeholder')}
        placeholderTextColor="#71717A"
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel={t('search.placeholder')}
        style={{
          backgroundColor: '#1A1A22',
          color: 'white',
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 12,
          fontSize: 16,
          marginBottom: 12,
        }}
      />

      {q.trim().length < 2 ? (
        <Text variant="body-m" style={{ color: '#71717A' }}>
          {t('search.hint')}
        </Text>
      ) : isFetching && !data ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
      ) : isError ? (
        <Text variant="body-m" style={{ color: '#ff6b6b' }}>
          {t('search.error')}
        </Text>
      ) : !data || data.length === 0 ? (
        <Text variant="body-m" style={{ color: '#71717A' }}>
          {t('search.empty')}
        </Text>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingBottom: 24, gap: 8 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                events.searchResultOpened(item.id);
                router.push({ pathname: '/(app)/title/[id]', params: { id: item.id } });
              }}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              style={({ pressed }) => ({
                flexDirection: 'row',
                gap: 12,
                padding: 8,
                borderRadius: 12,
                backgroundColor: pressed ? '#1A1A22' : 'transparent',
              })}
            >
              {item.posterUrl ? (
                <Image
                  source={{ uri: item.posterUrl }}
                  style={{ width: 56, height: 84, borderRadius: 6, backgroundColor: '#222' }}
                />
              ) : (
                <View style={{ width: 56, height: 84, borderRadius: 6, backgroundColor: '#222' }} />
              )}
              <View style={{ flex: 1, justifyContent: 'center', gap: 4 }}>
                <Text variant="title-m" numberOfLines={2}>
                  {item.title}
                </Text>
                <Text variant="caption" style={{ color: '#A1A1AA' }}>
                  {[item.releaseYear, item.kind === 'tv' ? t('detail.series') : t('detail.movie')]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
