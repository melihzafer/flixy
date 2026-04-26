import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Image, Pressable, Text, View } from 'react-native';

import { Screen } from '../../src/components/Screen';
import {
  type WatchlistFilter,
  useMarkWatched,
  useRemoveFromWatchlist,
  useSetPriority,
  useUnmarkWatched,
  useWatchlist,
} from '../../src/features/watchlist/hooks';

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
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            accessibilityRole="button"
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: filter === f ? '#fff' : '#15151B',
            }}
          >
            <Text style={{ color: filter === f ? '#0B0B0F' : '#A1A1AA', fontWeight: '600' }}>
              {t(`watchlist.filter.${f}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <Text style={{ color: '#A1A1AA' }}>{t('common.loading')}</Text>
      ) : isError ? (
        <Pressable onPress={() => refetch()}>
          <Text style={{ color: 'white' }}>{t('common.retry')}</Text>
        </Pressable>
      ) : entries.length === 0 ? (
        <Text style={{ color: '#A1A1AA' }}>
          {t('watchlist.empty', 'Your watchlist is empty. Swipe right to add titles.')}
        </Text>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.item.id}
          contentContainerStyle={{ paddingBottom: 32, gap: 12 }}
          renderItem={({ item: entry }) => {
            if (!entry.title) return null;
            const title = entry.title;
            const isWatched = !!entry.item.watchedAt;
            const isTop = entry.item.priority === 'top';
            return (
              <View
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  padding: 8,
                  borderRadius: 16,
                  backgroundColor: '#15151B',
                }}
              >
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/(app)/title/[id]', params: { id: title.id } })
                  }
                  accessibilityLabel={title.title}
                  style={{ flexDirection: 'row', flex: 1, gap: 12 }}
                >
                  {title.posterUrl ? (
                    <Image
                      source={{ uri: title.posterUrl }}
                      style={{ width: 64, height: 96, borderRadius: 8 }}
                    />
                  ) : (
                    <View
                      style={{ width: 64, height: 96, borderRadius: 8, backgroundColor: '#222' }}
                    />
                  )}
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text
                      style={{ color: 'white', fontSize: 16, fontWeight: '600' }}
                      numberOfLines={2}
                    >
                      {title.title}
                    </Text>
                    <Text style={{ color: '#A1A1AA', marginTop: 4 }}>
                      {[title.releaseYear, title.kind === 'tv' ? 'Series' : 'Movie']
                        .filter(Boolean)
                        .join(' \u2022 ')}
                    </Text>
                    {isTop ? (
                      <Text style={{ color: '#ffd166', marginTop: 4, fontSize: 12 }}>
                        {t('watchlist.topBadge', 'TOP')}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
                <View style={{ justifyContent: 'space-around', paddingRight: 4 }}>
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
      <Text style={{ color: danger ? '#ff5252' : '#A1A1AA', fontSize: 12, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}
