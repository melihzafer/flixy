import { useRouter } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, fonts, radii, spacing } from '../theme/tokens';
import { Screen } from './Screen';
import { SectionLabel } from './SectionLabel';
import { Text } from './Text';

type SettingsPageProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  showBack?: boolean;
  bodyInset?: boolean;
};

export function SettingsPage({
  title,
  subtitle,
  children,
  showBack = true,
  bodyInset = true,
}: SettingsPageProps) {
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/(tabs)/profile');
    }
  };

  return (
    <Screen scroll={true}>
      <View style={styles.header}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            onPress={goBack}
            testID="settings-back-button"
            style={({ pressed }) => [styles.backButton, pressed ? styles.backButtonPressed : null]}
          >
            <View style={styles.backInner}>
              <ChevronLeft size={20} color={colors.text} strokeWidth={2.2} />
              <Text style={styles.backLabel}>Back</Text>
            </View>
          </Pressable>
        ) : null}
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.body, bodyInset ? styles.bodyInset : null]}>{children}</View>
    </Screen>
  );
}

export function SelectOption({
  label,
  description,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  description?: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && !disabled ? styles.optionPressed : null,
        disabled ? styles.optionDisabled : null,
      ]}
    >
      <View style={styles.optionText}>
        <Text style={styles.optionLabel}>{label}</Text>
        {description ? <Text style={styles.optionDescription}>{description}</Text> : null}
      </View>
      {selected ? (
        <View style={styles.checkShell}>
          <Check size={18} color={colors.accent} strokeWidth={2.6} />
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Grouped settings card with an optional overline title. Shared by the Profile
 * tab and the Settings hub so every list surface uses one rhythm + spacing.
 */
export function SettingsGroup({
  title,
  children,
  topInset = true,
}: {
  title?: string;
  children: ReactNode;
  topInset?: boolean;
}) {
  return (
    <View style={[styles.group, topInset && styles.groupTop]}>
      {title ? (
        <View style={styles.groupTitle}>
          <SectionLabel>{title}</SectionLabel>
        </View>
      ) : null}
      <View style={styles.groupCard}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(245,245,240,0.045)',
    paddingLeft: spacing[3],
    paddingRight: spacing[4],
    marginBottom: spacing[2],
  },
  backInner: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  backButtonPressed: {
    backgroundColor: 'rgba(255,77,28,0.1)',
    borderColor: colors.accentBorder,
  },
  backLabel: {
    color: colors.text,
    fontFamily: fonts.bodySemi,
    fontSize: 14,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 34,
    letterSpacing: -0.7,
    lineHeight: 38,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
  },
  body: {
    gap: spacing[5],
    paddingBottom: spacing[8],
  },
  bodyInset: {
    paddingHorizontal: spacing[4],
  },
  option: {
    minHeight: 56,
    alignItems: 'center',
    backgroundColor: 'rgba(245,245,240,0.035)',
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  optionSelected: {
    backgroundColor: 'rgba(255,77,28,0.12)',
    borderColor: colors.accentBorder,
  },
  optionPressed: {
    backgroundColor: 'rgba(255,77,28,0.08)',
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionText: {
    flex: 1,
    minWidth: 0,
  },
  optionLabel: {
    color: colors.text,
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    lineHeight: 19,
  },
  optionDescription: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  checkShell: {
    minWidth: 24,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  group: {
    gap: spacing[2],
    paddingHorizontal: spacing[4],
  },
  groupTop: {
    marginTop: spacing[1],
  },
  groupTitle: {
    paddingHorizontal: spacing[1],
  },
  groupCard: {
    gap: spacing[2],
  },
});
