import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronLeft, Heart, Play, Star, X } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton } from '../../../src/components/ActionButton';
import { Text } from '../../../src/components/Text';
import { toTitleDisplay } from '../../../src/features/catalogue/display';
import { useTitle } from '../../../src/features/catalogue/hooks';
import { useProfile } from '../../../src/features/profile/hooks';
import { useRecordSwipe } from '../../../src/features/swipe/hooks';
import { events } from '../../../src/features/telemetry/events';
import { FALLBACK_STREAMING_SERVICES } from '../../../src/lib/fallbackCatalogue';
import { colors, fonts } from '../../../src/theme/tokens';

export default function TitleDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: title, isLoading, isError, refetch } = useTitle(id ?? null);
  const recordSwipe = useRecordSwipe();
  const { data: profile } = useProfile();

  useEffect(() => {
    if (id) events.detailViewed(id);
  }, [id]);

  useEffect(() => {
    if (title && !title.trailerKey) {
      events.detailTrailerMissing({ titleId: title.id, tmdbId: title.tmdbId, kind: title.kind });
    }
  }, [title]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0A0A0B',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text tone="muted" style={{ fontFamily: fonts.bodyMedium, fontSize: 14 }}>
          {t('common.loading')}
        </Text>
      </View>
    );
  }

  if (isError || !title) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0A0A0B',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
        }}
      >
        <Text
          style={{
            color: colors.textMuted,
            fontFamily: fonts.bodyMedium,
            fontSize: 14,
            textAlign: 'center',
          }}
        >
          {t('deck.errorTitle', 'Connection failed')}
        </Text>
        <Pressable
          onPress={() => refetch()}
          style={({ pressed }) => ({
            paddingVertical: 10,
            paddingHorizontal: 20,
            backgroundColor: pressed ? colors.surface3 : colors.surface2,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border2,
          })}
        >
          <Text style={{ color: colors.text, fontFamily: fonts.bodySemi, fontSize: 13 }}>
            {t('common.retry')}
          </Text>
        </Pressable>
      </View>
    );
  }

  const display = toTitleDisplay(title);
  const creditNames =
    title.kind === 'tv' ? display.creators : display.director ? [display.director] : [];
  const creditLabel =
    creditNames.length > 0
      ? `${title.kind === 'tv' ? 'Created by' : 'Dir.'} ${creditNames.join(', ')}`
      : null;
  const metaParts = [display.year?.toString(), display.runtime, display.rating, creditLabel].filter(
    (part): part is string => !!part,
  );
  const serviceNameById = new Map(
    FALLBACK_STREAMING_SERVICES.map((service) => [service.id, service.name]),
  );

  const userRegion = profile?.region?.toUpperCase() ?? 'US';

  // Filter to user's region first
  let filteredAvailability = title.availability.filter(
    (a) => a.region.toUpperCase() === userRegion,
  );

  // If nothing is found for the user's region, fallback to the entire list
  if (filteredAvailability.length === 0) {
    filteredAvailability = title.availability;
  }

  // Deduplicate by serviceId + offerType
  const availability: typeof title.availability = [];
  const seenKeys = new Set<string>();
  for (const offer of filteredAvailability) {
    const key = `${offer.serviceId}-${offer.offerType}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      availability.push(offer);
    }
  }

  const onAction = (dir: 'left' | 'right' | 'up' | 'down') => {
    recordSwipe.mutate({ titleId: title.id, direction: dir, deckPosition: 0 });
  };

  const handleBack = () => {
    // router.back() is a no-op when there is no history (e.g. opened from a
    // notification deep link or as the first route), which would strand the
    // user on this screen. Fall back to the deck in that case.
    if (router.canGoBack()) router.back();
    else router.replace('/(app)');
  };

  const openTrailer = async () => {
    if (!title.trailerKey) return;
    events.trailerOpened(title.id);
    await Linking.openURL(`https://www.youtube.com/watch?v=${title.trailerKey}`);
  };

  const openAvailability = async (offer: (typeof title.availability)[number]) => {
    if (!offer.deepLink) return;
    events.availabilityOpened({
      titleId: title.id,
      serviceId: offer.serviceId,
      offerType: offer.offerType,
    });
    await Linking.openURL(offer.deepLink);
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#0A0A0B',
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* Hero */}
        <View style={{ height: 280, position: 'relative' }}>
          <LinearGradient
            colors={display.gradient as unknown as readonly [string, string, string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          {display.posterUrl ? (
            <Image
              source={{ uri: display.posterUrl }}
              contentFit="cover"
              transition={180}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                opacity: 0.72,
              }}
            />
          ) : null}
          <LinearGradient
            colors={['transparent', 'rgba(10,10,11,0.6)', '#0A0A0B']}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '100%' }}
          />
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14, gap: 3 }}>
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: 24,
                color: colors.text,
                lineHeight: 26,
              }}
              numberOfLines={2}
            >
              {display.title}
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: 'rgba(245,245,240,0.45)',
              }}
            >
              {metaParts.join(' · ')}
            </Text>
          </View>
        </View>

        {/* Action row */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            paddingHorizontal: 14,
            paddingTop: 12,
            paddingBottom: 8,
          }}
        >
          <ActionButton
            Icon={X}
            label="Pass"
            accessibilityLabel="Pass this title"
            tone="pass"
            size={48}
            iconSize={20}
            testID="detail-pass-button"
            onPress={() => onAction('left')}
            disabled={recordSwipe.isPending}
            showLabel
          />
          <ActionButton
            Icon={Heart}
            label="Save"
            accessibilityLabel="Save this title"
            tone="save"
            size={54}
            iconSize={23}
            testID="detail-save-button"
            onPress={() => onAction('right')}
            disabled={recordSwipe.isPending}
            showLabel
          />
          <ActionButton
            Icon={Star}
            label="Top"
            accessibilityLabel="Mark this title as a top pick"
            tone="top"
            size={48}
            iconSize={20}
            testID="detail-top-button"
            onPress={() => onAction('up')}
            disabled={recordSwipe.isPending}
            showLabel
          />
          <ActionButton
            Icon={Check}
            label="Seen"
            accessibilityLabel="Mark this title as seen"
            tone="seen"
            size={48}
            iconSize={20}
            testID="detail-seen-button"
            onPress={() => onAction('down')}
            disabled={recordSwipe.isPending}
            showLabel
          />
        </View>

        {/* Body */}
        <View style={{ paddingHorizontal: 14 }}>
          {/* Scores */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <ScorePill
              value={display.score?.toFixed(1) ?? '—'}
              label="IMDb"
              color={colors.accent}
            />
            <ScorePill
              value={display.rt ? `${display.rt}%` : '—'}
              label="RT Score"
              color="#fa4a2c"
            />
            <ScorePill value={display.genres[0] ?? '—'} label="Genre" color={colors.text} small />
          </View>

          {/* Synopsis */}
          <SectionLabel>Synopsis</SectionLabel>
          <Text
            style={{
              fontSize: 13,
              color: 'rgba(245,245,240,0.65)',
              lineHeight: 20,
              fontFamily: fonts.body,
            }}
          >
            {display.synopsis ?? 'No synopsis available.'}
          </Text>

          <SectionLabel>Trailer</SectionLabel>
          <Pressable
            onPress={openTrailer}
            disabled={!title.trailerKey}
            testID="detail-trailer-button"
            accessibilityRole="button"
            accessibilityState={{ disabled: !title.trailerKey }}
            style={{
              minHeight: 42,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: title.trailerKey ? colors.accentBorder : colors.border,
              backgroundColor: title.trailerKey ? colors.accentDim : 'rgba(255,255,255,0.035)',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 8,
            }}
          >
            <Text
              style={{
                fontFamily: fonts.bodySemi,
                fontSize: 13,
                color: title.trailerKey ? colors.text : colors.textMuted,
              }}
            >
              {title.trailerKey ? 'Watch trailer' : 'Trailer not available yet'}
            </Text>
          </Pressable>

          {/* Cast */}
          <SectionLabel>Cast</SectionLabel>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 7, paddingBottom: 2 }}
          >
            {display.cast.length > 0 ? (
              display.cast.map((c) => (
                <View
                  key={c}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: 7,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      color: 'rgba(245,245,240,0.6)',
                      fontFamily: fonts.body,
                    }}
                  >
                    {c}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                Cast details are not available yet.
              </Text>
            )}
          </ScrollView>

          {/* Availability */}
          <SectionLabel>Where to Watch</SectionLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {availability.length > 0 ? (
              availability.map((offer) => {
                const disabled = !offer.deepLink;
                return (
                  <Pressable
                    key={`${offer.serviceId}-${offer.offerType}-${offer.region}`}
                    onPress={() => openAvailability(offer)}
                    disabled={disabled}
                    testID={`detail-availability-${offer.serviceId}`}
                    accessibilityRole="button"
                    accessibilityState={{ disabled }}
                    style={{
                      paddingHorizontal: 11,
                      paddingVertical: 7,
                      borderRadius: 9,
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderWidth: 1,
                      borderColor: disabled ? 'rgba(255,255,255,0.09)' : colors.accentBorder,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Play
                      size={12}
                      color={disabled ? colors.textMuted : colors.accent}
                      strokeWidth={2.2}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: fonts.bodyMedium,
                        color: disabled ? colors.textMuted : colors.text,
                      }}
                    >
                      {serviceNameById.get(offer.serviceId) ?? offer.serviceId} · {offer.offerType}
                    </Text>
                  </Pressable>
                );
              })
            ) : (
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                No availability for your region yet.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Floating Back Button */}
      <Pressable
        onPress={handleBack}
        style={({ pressed }) => ({
          position: 'absolute',
          top: Math.max(16, insets.top, StatusBar.currentHeight ?? 0) + 12,
          left: 16,
          zIndex: 99,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: pressed ? 'rgba(10,10,11,0.85)' : 'rgba(10,10,11,0.6)',
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.25)',
          alignItems: 'center',
          justifyContent: 'center',
        })}
        accessibilityRole="button"
        accessibilityLabel={t('common.back', 'Back')}
      >
        <ChevronLeft size={20} color={colors.text} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

function ScorePill({
  value,
  label,
  color,
  small,
}: {
  value: string;
  label: string;
  color: string;
  small?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 10,
        padding: 9,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontSize: small ? 12 : 18,
          fontFamily: fonts.bodyBold,
          color,
          paddingTop: small ? 3 : 0,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 9,
          color: 'rgba(245,245,240,0.35)',
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
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
        marginTop: 14,
        marginBottom: 7,
      }}
    >
      {children}
    </Text>
  );
}
