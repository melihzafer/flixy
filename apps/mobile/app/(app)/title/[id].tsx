import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { Heart, Play, Star } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Linking, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { Screen } from '../../../src/components/Screen';
import { SectionLabel } from '../../../src/components/SectionLabel';
import { ServiceBadge } from '../../../src/components/ServiceBadge';
import { Text } from '../../../src/components/Text';
import { useTitle } from '../../../src/features/catalogue/hooks';
import { useRecordSwipe } from '../../../src/features/swipe/hooks';
import { events } from '../../../src/features/telemetry/events';
import { colors, fonts } from '../../../src/theme/tokens';

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
        <Text tone="muted">{t('common.loading')}</Text>
      </Screen>
    );
  }
  if (isError || !title) {
    return (
      <Screen title={t('detail.notFound', 'Not found')}>
        <Pressable onPress={() => refetch()}>
          <Text tone="accent">{t('common.retry')}</Text>
        </Pressable>
      </Screen>
    );
  }

  const meta = [
    title.releaseYear,
    title.runtimeMinutes ? `${title.runtimeMinutes}m` : null,
    title.kind === 'tv' ? t('detail.series', 'Series') : t('detail.movie', 'Movie'),
  ]
    .filter(Boolean)
    .join('  \u00b7  ');

  const onAction = (dir: 'right' | 'up' | 'down') => {
    recordSwipe.mutate({ titleId: title.id, direction: dir, deckPosition: 0 });
  };

  const openTrailer = () => {
    if (!title.trailerKey) return;
    events.trailerOpened(title.id);
    Linking.openURL(`https://www.youtube.com/watch?v=${title.trailerKey}`);
  };

  return (
    <Screen scroll={false}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: heroH, marginHorizontal: -24, marginTop: -24 }}>
          {title.backdropUrl || title.posterUrl ? (
            <Image
              source={{ uri: title.backdropUrl ?? title.posterUrl ?? undefined }}
              style={{ width: '100%', height: '100%' }}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: colors.surface3 }} />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(10,10,11,0.85)', colors.bg]}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 240 }}
          />
          <View style={{ position: 'absolute', left: 24, right: 24, bottom: 20, gap: 6 }}>
            {title.genres[0] ? (
              <Text variant="overline" tone="accent" style={{ textTransform: 'uppercase' }}>
                {title.genres[0]}
              </Text>
            ) : null}
            <Text
              style={{
                color: colors.text,
                fontFamily: fonts.display,
                fontSize: 36,
                lineHeight: 38,
                letterSpacing: -0.5,
              }}
              numberOfLines={2}
            >
              {title.title}
            </Text>
            <Text variant="body-s" tone="muted">
              {meta}
            </Text>
            {title.imdbRating ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Star size={14} color={colors.up} fill={colors.up} />
                <Text variant="body-s" style={{ color: colors.up, fontFamily: fonts.bodySemi }}>
                  {title.imdbRating.toFixed(1)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
          <ActionPill
            icon={<Heart size={16} color={colors.text} fill={colors.text} />}
            label={t('deck.actionAdd', 'Add')}
            primary
            onPress={() => onAction('right')}
          />
          <ActionPill
            icon={<Star size={16} color={colors.up} fill={colors.up} />}
            label={t('deck.actionTop', 'Top')}
            color={colors.up}
            onPress={() => onAction('up')}
          />
          {title.trailerKey ? (
            <ActionPill
              icon={<Play size={14} color={colors.text} fill={colors.text} />}
              label={t('detail.trailer', 'Trailer')}
              color={colors.text}
              onPress={openTrailer}
            />
          ) : null}
        </View>

        {title.overview ? (
          <View style={{ marginTop: 28, gap: 8 }}>
            <SectionLabel>{t('detail.overview', 'Overview')}</SectionLabel>
            <Text variant="body-l" tone="muted" style={{ lineHeight: 22 }}>
              {title.overview}
            </Text>
          </View>
        ) : null}

        {title.genres.length > 0 ? (
          <View style={{ marginTop: 24, gap: 10 }}>
            <SectionLabel>{t('detail.genres', 'Genres')}</SectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {title.genres.map((g) => (
                <View
                  key={g}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor: colors.surface2,
                  }}
                >
                  <Text variant="caption" tone="muted">
                    {g}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {title.availability.length > 0 ? (
          <View style={{ marginTop: 24, gap: 10 }}>
            <SectionLabel>{t('detail.availability', 'Where to watch')}</SectionLabel>
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
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 14,
                  backgroundColor: pressed ? colors.surface2 : colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <ServiceBadge serviceId={a.serviceId} size="md" />
                  <Text variant="body-m" style={{ fontFamily: fonts.bodySemi }}>
                    {a.serviceId}
                  </Text>
                </View>
                <Text variant="caption" tone="muted">
                  {`${t(`detail.offer.${a.offerType}`, a.offerType)} \u00b7 ${a.region}`}
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
  icon,
  label,
  color,
  primary,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  color?: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: primary ? colors.accent : colors.surface2,
        borderWidth: primary ? 0 : 1.5,
        borderColor: color ?? colors.border2,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {icon}
      <Text
        variant="body-s"
        style={{
          color: primary ? colors.text : (color ?? colors.text),
          fontFamily: fonts.bodySemi,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
