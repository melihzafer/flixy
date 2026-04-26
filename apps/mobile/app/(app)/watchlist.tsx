import { router } from 'expo-router';
import { Play } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Image, Pressable, View } from 'react-native';

import { Chip, ChipGroup } from '../../src/components/Chip';
import { Screen } from '../../src/components/Screen';
import { ServiceBadge } from '../../src/components/ServiceBadge';
import { Text } from '../../src/components/Text';
import {
  type WatchlistFilter,
  useMarkWatched,
  useRemoveFromWatchlist,
  useSetPriority,
  useUnmarkWatched,
  useWatchlist,
} from '../../src/features/watchlist/hooks';
import { colors, fonts } from '../../src/theme/tokens';

const FILTERS: WatchlistFilter[] = ['all', 'top', 'watched'];

export default function WatchlistScreen() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<WatchlistFilter>('all');
  const { entries, isLoading, isError, refetch } = useWatchlist(filter);
  const markWatched = useMarkWatched();
  const unmarkWatched = useUnmarkWatched();
  const remove = useRemoveFromWatchlist();
  const setPriority = useSetPriority();

  return (
    <Screen title={t('watchlist.title', 'Watchlist')}>
      <ChipGroup>
        {FILTERS.map((f) => (
          <Chip
            key={f}
            label={t(`watchlist.filter.${f}`)}
            selected={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </ChipGroup>

      {isLoading ? (
        <Text tone="muted">{t('common.loading')}</Text>
      ) : isError ? (
        <Pressable onPress={() => refetch()}>
          <Text tone="accent">{t('common.retry')}</Text>
        </Pressable>
      ) : entries.length === 0 ? (
        <Text tone="muted">
          {t('watchlist.empty', 'Your watchlist is empty. Swipe right to add titles.')}
        </Text>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.item.id}
          contentContainerStyle={{ paddingBottom: 32, gap: 10 }}
          renderItem={({ item: entry }) => {
            if (!entry.title) return null;
            const title = entry.title;
            const isWatched = !!entry.item.watchedAt;
            const isTop = entry.item.priority === 'top';
            const firstService = title.availability[0]?.serviceId;
            return (
              <View
                testID="watchlist-row"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 10,
                  borderRadius: 16,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/(app)/title/[id]', params: { id: title.id } })
                  }
                  accessibilityLabel={title.title}
                  style={{ flexDirection: 'row', flex: 1, gap: 12, alignItems: 'center' }}
                >
                  {title.posterUrl ? (
                    <Image
                      source={{ uri: title.posterUrl }}
                      style={{ width: 48, height: 68, borderRadius: 6 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 48,
                        height: 68,
                        borderRadius: 6,
                        backgroundColor: colors.surface3,
                      }}
                    />
                  )}
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontFamily: fonts.display,
                        fontSize: 19,
                        lineHeight: 22,
                      }}
                      numberOfLines={1}
                    >
                      {title.title}
                    </Text>
                    <Text variant="body-s" tone="muted" numberOfLines={1}>
                      {[title.releaseYear, title.kind === 'tv' ? 'Series' : 'Movie']
                        .filter(Boolean)
                        .join(' \u00b7 ')}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                      {firstService ? <ServiceBadge serviceId={firstService} size="sm" /> : null}
                      {isTop ? (
                        <Text
                          variant="overline"
                          style={{
                            color: colors.up,
                            textTransform: 'uppercase',
                            alignSelf: 'center',
                          }}
                        >
                          {t('watchlist.topBadge', 'Top')}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/(app)/title/[id]', params: { id: title.id } })
                    }
                    accessibilityLabel={t('watchlist.play', 'Play')}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Play size={16} color={colors.text} fill={colors.text} />
                  </Pressable>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <ActionMini
                      label={isTop ? t('watchlist.unpin', 'Unpin') : t('watchlist.pin', 'Top')}
                      onPress={() =>
                        setPriority.mutate({
                          id: entry.item.id,
                          priority: isTop ? 'normal' : 'top',
                        })
                      }
                    />
                    <ActionMini
                      label={
                        isWatched
                          ? t('watchlist.unwatch', 'Unwatch')
                          : t('watchlist.markWatched', 'Watched')
                      }
                      onPress={() =>
                        isWatched
                          ? unmarkWatched.mutate(entry.item.id)
                          : markWatched.mutate(entry.item.id)
                      }
                    />
                    <ActionMini
                      label={t('watchlist.remove', 'Remove')}
                      onPress={() => remove.mutate(entry.item.id)}
                      danger
                    />
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}

function ActionMini({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Text
        variant="caption"
        style={{
          color: danger ? colors.left : colors.textMuted,
          fontFamily: fonts.bodySemi,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
