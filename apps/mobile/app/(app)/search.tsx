import { router } from 'expo-router';
import { Search as SearchIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Image, Pressable, TextInput, View } from 'react-native';

import { Screen } from '../../src/components/Screen';
import { ServiceBadge } from '../../src/components/ServiceBadge';
import { Text } from '../../src/components/Text';
import { useSearchTitles } from '../../src/features/search/hooks';
import { events } from '../../src/features/telemetry/events';
import { colors, fonts } from '../../src/theme/tokens';

export default function SearchScreen() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  const { data, isFetching, isError } = useSearchTitles(q);

  useEffect(() => {
    if (q.trim().length >= 2 && data) {
      events.searchSubmitted(q.trim(), data.length);
    }
  }, [q, data]);

  return (
    <Screen scroll={false} title={t('search.title')}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderWidth: 1.5,
          borderColor: focused ? 'rgba(255,77,28,0.5)' : colors.border2,
          borderRadius: 999,
          paddingHorizontal: 16,
          paddingVertical: 12,
          marginBottom: 12,
        }}
      >
        <SearchIcon size={18} color={colors.textMuted} strokeWidth={2.5} />
        <TextInput
          value={q}
          onChangeText={setQ}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={t('search.placeholder')}
          placeholderTextColor={colors.textDim}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel={t('search.placeholder')}
          style={{
            flex: 1,
            color: colors.text,
            fontFamily: fonts.body,
            fontSize: 15,
            padding: 0,
          }}
        />
      </View>

      {q.trim().length < 2 ? (
        <Text variant="body-m" tone="dim">
          {t('search.hint')}
        </Text>
      ) : isFetching && !data ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : isError ? (
        <Text variant="body-m" style={{ color: colors.left }}>
          {t('search.error')}
        </Text>
      ) : !data || data.length === 0 ? (
        <Text variant="body-m" tone="dim">
          {t('search.empty')}
        </Text>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingBottom: 24, gap: 6 }}
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
                backgroundColor: pressed ? colors.surface2 : 'transparent',
              })}
            >
              {item.posterUrl ? (
                <Image
                  source={{ uri: item.posterUrl }}
                  style={{
                    width: 44,
                    height: 62,
                    borderRadius: 6,
                    backgroundColor: colors.surface3,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 44,
                    height: 62,
                    borderRadius: 6,
                    backgroundColor: colors.surface3,
                  }}
                />
              )}
              <View style={{ flex: 1, justifyContent: 'center', gap: 4 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontFamily: fonts.display,
                    fontSize: 17,
                    lineHeight: 20,
                  }}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text variant="caption" tone="muted">
                  {[item.releaseYear, item.kind === 'tv' ? t('detail.series') : t('detail.movie')]
                    .filter(Boolean)
                    .join(' \u00b7 ')}
                </Text>
              </View>
              {item.availability[0] ? (
                <ServiceBadge serviceId={item.availability[0].serviceId} size="sm" />
              ) : null}
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
