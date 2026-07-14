import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Clapperboard, Link2, Share2, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import type { TitleDisplay } from '../features/catalogue/display';
import { buildShareMessage, copyText, shareTitleMessage } from '../lib/share';
import { colors, fonts, radii, spacing } from '../theme/tokens';
import { Text } from './Text';

type ShareCardModalProps = {
  visible: boolean;
  onClose: () => void;
  display: TitleDisplay | null;
  /** Primary link — the Flixy web page for this title. */
  shareUrl: string | null;
  /** Optional secondary YouTube trailer link, appended to the message. */
  trailerUrl?: string | null;
  onShared?: () => void;
};

export function ShareCardModal({
  visible,
  onClose,
  display,
  shareUrl,
  trailerUrl = null,
  onShared,
}: ShareCardModalProps) {
  const { t } = useTranslation();
  const [shared, setShared] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShared(false);
      setCopied(false);
    }
  }, [visible]);

  if (!display) return null;

  const message = buildShareMessage(display.title, display.year, {
    webUrl: shareUrl ?? '',
    trailerUrl,
  });

  const handleShare = async () => {
    const outcome = await shareTitleMessage({
      title: `Flixy: ${display.title}`,
      message,
      url: shareUrl ?? '',
    });
    if (outcome === 'shared') {
      setShared(true);
      onShared?.();
    } else if (outcome === 'copied') {
      // Desktop web without navigator.share: the message went to the
      // clipboard instead — surface that on the copy row.
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    const ok = await copyText(shareUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Close handle */}
          <View style={styles.handleBar} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close share card"
            hitSlop={12}
            onPress={onClose}
            style={styles.closeButton}
          >
            <X size={18} color={colors.textMuted} strokeWidth={2.2} />
          </Pressable>

          {/* Share card preview */}
          <View style={styles.card}>
            {display.posterUrl ? (
              <Image
                source={{ uri: display.posterUrl }}
                style={styles.poster}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <LinearGradient
                colors={display.gradient as unknown as readonly [string, string, string, string]}
                style={styles.posterFallback}
              >
                <Text style={styles.posterFallbackText}>
                  {display.title.charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            )}
            <LinearGradient
              colors={['transparent', 'rgba(10,10,11,0.95)']}
              style={styles.posterOverlay}
            />

            <View style={styles.cardContent}>
              <Text style={styles.flixyBadge}>FLIXY</Text>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {display.title}
              </Text>
              <View style={styles.metaRow}>
                {display.year ? <Text style={styles.metaText}>{display.year}</Text> : null}
                {display.rating ? (
                  <>
                    {display.year ? <Text style={styles.metaDot}>·</Text> : null}
                    <Text style={styles.metaText}>{display.rating}</Text>
                  </>
                ) : null}
                {display.runtime ? (
                  <>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.metaText}>{display.runtime}</Text>
                  </>
                ) : null}
                {display.score ? (
                  <>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.metaText}>★ {display.score.toFixed(1)}</Text>
                  </>
                ) : null}
              </View>
              {display.hook ? (
                <Text style={styles.cardHook} numberOfLines={2}>
                  {display.hook}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Link preview */}
          {shareUrl ? (
            <View style={styles.linkBox}>
              <Link2 size={14} color={colors.textMuted} strokeWidth={2} />
              <Text style={styles.linkText} numberOfLines={1}>
                {shareUrl.replace(/^https?:\/\//, '')}
              </Text>
            </View>
          ) : null}
          {trailerUrl ? (
            <View style={styles.linkBox}>
              <Clapperboard size={14} color={colors.textMuted} strokeWidth={2} />
              <Text style={styles.linkText} numberOfLines={1}>
                {t('share.watchTrailer', 'Watch trailer')} ·{' '}
                {trailerUrl.replace(/^https?:\/\//, '')}
              </Text>
            </View>
          ) : null}

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('share.viaApps', 'Share via apps')}
              onPress={handleShare}
              style={({ pressed }) => [styles.primaryAction, pressed && styles.actionPressed]}
            >
              <Share2 size={18} color={colors.onAccent} strokeWidth={2.3} />
              <Text style={styles.primaryActionText}>
                {shared ? t('share.shared', 'Shared!') : t('share.viaApps', 'Share via apps')}
              </Text>
            </Pressable>

            {shareUrl ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('share.copyLink', 'Copy link')}
                onPress={handleCopyLink}
                style={({ pressed }) => [styles.secondaryAction, pressed && styles.actionPressed]}
              >
                {copied ? (
                  <Check size={16} color={colors.accent} strokeWidth={2.5} />
                ) : (
                  <Link2 size={16} color={colors.text} strokeWidth={2.2} />
                )}
                <Text style={styles.secondaryActionText}>
                  {copied ? t('share.copied', 'Copied!') : t('share.copyLink', 'Copy link')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[8],
    gap: spacing[4],
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(245,245,240,0.2)',
    alignSelf: 'center',
    marginBottom: spacing[1],
  },
  closeButton: {
    position: 'absolute',
    top: spacing[4],
    right: spacing[4],
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245,245,240,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  card: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  poster: {
    width: '100%',
    height: 180,
  },
  posterFallback: {
    width: '100%',
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterFallbackText: {
    fontFamily: fonts.display,
    fontSize: 56,
    color: colors.text,
  },
  posterOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },
  cardContent: {
    padding: spacing[4],
    gap: spacing[2],
    marginTop: -48,
  },
  flixyBadge: {
    color: colors.accent,
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 1.4,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 27,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  metaDot: {
    color: colors.textDim,
    fontSize: 10,
  },
  cardHook: {
    color: 'rgba(245,245,240,0.55)',
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radii.md,
    backgroundColor: 'rgba(245,245,240,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },
  actions: {
    gap: spacing[3],
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 54,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
  },
  primaryActionText: {
    color: colors.onAccent,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: 'rgba(245,245,240,0.05)',
    borderWidth: 1,
    borderColor: colors.border2,
  },
  secondaryActionText: {
    color: colors.text,
    fontFamily: fonts.bodySemi,
    fontSize: 14,
  },
  actionPressed: {
    opacity: 0.82,
  },
});
