import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { Screen } from '../../../src/components/Screen';
import { useTitle } from '../../../src/features/catalogue/hooks';
import { useRecordSwipe } from '../../../src/features/swipe/hooks';
import { events } from '../../../src/features/telemetry/events';

/**
 * Title detail view (FSD section 3.8). Hero artwork + meta + overview +
 * availability + quick actions (add/top/seen). Trailer playback uses the
 * YouTube watch URL via Linking until expo-av is wired in Phase 4.
 */
export default function TitleDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: title, isLoading, isError, refetch } = useTitle(id ?? null);
  const recordSwipe = useRecordSwipe();
  const { width } = useWindowDimensions();
  const heroH = Math.min(width * 1.0, 460);

  useEffect(() => {
    if (id) events.detailViewed(id);
  }, [id]);

  if (isLoading) {
    return (
      <Screen title={t('common.loading')}>
        <Text style={{ color: '#A1A1AA' }}>{t('common.loading')}</Text>
      </Screen>
    );
  }
  if (isError || !title) {
    return (
      <Screen title={t('detail.notFound', 'Not found')}>
        <Pressable onPress={() => refetch()}>
          <Text style={{ color: 'white' }}>{t('common.retry')}</Text>
        </Pressable>
      </Screen>
    );
  }

  const meta = [
    title.releaseYear,
    title.runtimeMinutes ? `${title.runtimeMinutes}m` : null,
    title.kind === 'tv' ? t('detail.series', 'Series') : t('detail.movie', 'Movie'),
    title.imdbRating ? `${title.imdbRating.toFixed(1)} \u2605` : null,
  ]
    .filter(Boolean)
    .join('  \u2022  ');

  const onAction = (dir: 'right' | 'up' | 'down') => {
    recordSwipe.mutate({ titleId: title.id, direction: dir, deckPosition: 0 });
  };

  const openTrailer = () => {
    if (!title.trailerKey) return;
    events.trailerOpened(title.id);
    Linking.openURL(`https://www.youtube.com/watch?v=${title.trailerKey}`);
  };

  return (
    <Screen title={title.title} scroll={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ height: heroH, marginHorizontal: -16, marginTop: -8 }}>
          {title.backdropUrl || title.posterUrl ? (
            <Image
              source={{ uri: title.backdropUrl ?? title.posterUrl ?? undefined }}
              style={{ width: '100%', height: '100%' }}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: '#222' }} />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(11,11,15,0.9)', '#0B0B0F']}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 200 }}
          />
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
            <Text style={{ color: 'white', fontSize: 28, fontWeight: '800' }} numberOfLines={2}>
              {title.title}
            </Text>
            <Text style={{ color: '#A1A1AA', marginTop: 4 }}>{meta}</Text>
            {title.genres.length > 0 ? (
              <Text style={{ color: '#71717A', marginTop: 4 }} numberOfLines={1}>
                {title.genres.join(' \u2022 ')}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <ActionPill
            label={t('deck.actionAdd')}
            color="#3ddc84"
            onPress={() => onAction('right')}
          />
          <ActionPill label={t('deck.actionTop')} color="#ffd166" onPress={() => onAction('up')} />
          <ActionPill
            label={t('deck.actionSeen')}
            color="#4dabf7"
            onPress={() => onAction('down')}
          />
          {title.trailerKey ? (
            <ActionPill
              label={t('detail.trailer', 'Trailer')}
              color="#ff5252"
              onPress={openTrailer}
            />
          ) : null}
        </View>

        {title.overview ? (
          <View style={{ marginTop: 24 }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
              {t('detail.overview', 'Overview')}
            </Text>
            <Text style={{ color: '#D4D4D8', lineHeight: 22 }}>{title.overview}</Text>
          </View>
        ) : null}

        {title.availability.length > 0 ? (
          <View style={{ marginTop: 24 }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
              {t('detail.availability', 'Where to watch')}
            </Text>
            {title.availability.map((a) => (
              <Pressable
                key={`${a.serviceId}-${a.region}-${a.offerType}`}
                onPress={() => {
                  if (!a.deepLink) return;
                  events.availabilityOpened({
                    titleId: title.id,
                    serviceId: a.serviceId,
                    offerType: a.offerType,
                  });
                  Linking.openURL(a.deepLink);
                }}
                disabled={!a.deepLink}
                accessibilityRole="link"
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: '#15151B',
                }}
              >
                <Text style={{ color: 'white' }}>{a.serviceId}</Text>
                <Text style={{ color: '#A1A1AA' }}>
                  {t(`detail.offer.${a.offerType}`, a.offerType)} · {a.region}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function ActionPill({
  label,
  color,
  onPress,
}: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 2,
        borderColor: color,
      }}
    >
      <Text style={{ color, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
