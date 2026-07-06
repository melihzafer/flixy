import { Smartphone, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePwaInstallPrompt } from '../hooks/usePwaInstallPrompt';
import { colors, fonts, radii, spacing } from '../theme/tokens';
import { Text } from './Text';

/**
 * Web-only "Add to Home Screen" prompt. Renders nothing on the native APK
 * builds (Platform.OS !== 'web') and nothing until `usePwaInstallPrompt`
 * decides it's an eligible, non-cooldown moment to ask.
 */
export function PwaInstallModal() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { visible, platform, install, dismiss } = usePwaInstallPrompt();

  if (Platform.OS !== 'web' || !platform) return null;

  const isIos = platform === 'ios';
  const steps = isIos
    ? [
        t('pwaInstall.iosStep1'),
        t('pwaInstall.iosStep2'),
        t('pwaInstall.iosStep3'),
        t('pwaInstall.iosStep4'),
      ]
    : [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[6]) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handleBar} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('pwaInstall.close')}
            hitSlop={12}
            onPress={dismiss}
            style={styles.closeButton}
          >
            <X size={18} color={colors.textMuted} strokeWidth={2.2} />
          </Pressable>

          <View style={styles.iconBadge}>
            <Smartphone size={22} color={colors.accent} strokeWidth={2} />
          </View>

          <Text style={styles.title}>
            {isIos ? t('pwaInstall.iosTitle') : t('pwaInstall.genericTitle')}
          </Text>
          <Text style={styles.description}>
            {isIos ? t('pwaInstall.iosDescription') : t('pwaInstall.genericDescription')}
          </Text>

          {isIos ? (
            <View style={styles.steps}>
              {steps.map((step, index) => (
                <View key={step} style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isIos ? t('pwaInstall.iosCta') : t('pwaInstall.installCta')}
              onPress={isIos ? dismiss : install}
              style={({ pressed }) => [styles.primaryAction, pressed && styles.actionPressed]}
            >
              <Text style={styles.primaryActionText}>
                {isIos ? t('pwaInstall.iosCta') : t('pwaInstall.installCta')}
              </Text>
            </Pressable>

            {isIos ? null : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('pwaInstall.laterCta')}
                onPress={dismiss}
                style={({ pressed }) => [styles.secondaryAction, pressed && styles.actionPressed]}
              >
                <Text style={styles.secondaryActionText}>{t('pwaInstall.laterCta')}</Text>
              </Pressable>
            )}
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
    gap: spacing[3],
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
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[2],
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 27,
    color: colors.text,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  steps: {
    gap: spacing[2],
    paddingVertical: spacing[2],
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(245,245,240,0.06)',
    borderWidth: 1,
    borderColor: colors.border2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: colors.text,
  },
  stepText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  actions: {
    gap: spacing[3],
    marginTop: spacing[2],
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
