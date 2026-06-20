import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, fonts, radii, spacing } from '../theme/tokens';
import { Text } from './Text';

export type ListRowTone = 'default' | 'accent' | 'danger';

export type ListRowProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  value?: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  tone?: ListRowTone;
  disabled?: boolean;
  accessibilityLabel?: string;
  labelNumberOfLines?: number;
  subtitleNumberOfLines?: number;
  valueNumberOfLines?: number;
  style?: ViewStyle;
};

const toneColor: Record<ListRowTone, string> = {
  default: colors.text,
  accent: colors.accent,
  danger: colors.left,
};

/**
 * Shared row primitive for settings/profile/watchlist-style lists.
 * Handles wrapping content, optional leading/trailing slots, and 44px+ targets.
 */
export function ListRow({
  label,
  value,
  subtitle,
  leading,
  trailing,
  tone = 'default',
  disabled,
  onPress,
  accessibilityLabel,
  labelNumberOfLines = 1,
  subtitleNumberOfLines = 2,
  valueNumberOfLines = 1,
  style,
  ...rest
}: ListRowProps) {
  const isInteractive = !!onPress;
  const resolvedTrailing =
    trailing ?? (isInteractive ? <ChevronRight color={colors.textDim} size={18} /> : null);

  return (
    <Pressable
      accessibilityRole={isInteractive ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || !isInteractive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        disabled && styles.disabled,
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}
      {...rest}
    >
      <View style={styles.innerRow}>
        {leading ? <View style={styles.leading}>{leading}</View> : null}

        <View style={styles.content}>
          <Text
            numberOfLines={labelNumberOfLines}
            style={[styles.label, { color: toneColor[tone] }]}
          >
            {label}
          </Text>
          {subtitle ? (
            <Text numberOfLines={subtitleNumberOfLines} tone="muted" style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {value ? (
          <Text numberOfLines={valueNumberOfLines} tone="muted" style={styles.value}>
            {value}
          </Text>
        ) : null}

        {resolvedTrailing ? <View style={styles.trailing}>{resolvedTrailing}</View> : null}
      </View>
    </Pressable>
  );
}

export const SettingsRow = ListRow;

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    borderRadius: radii.md,
    backgroundColor: 'rgba(245,245,240,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(245,245,240,0.1)',
    overflow: 'hidden',
  },
  innerRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  pressed: {
    backgroundColor: 'rgba(255,77,28,0.1)',
    borderColor: colors.accentBorder,
  },
  disabled: {
    opacity: 0.5,
  },
  leading: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    lineHeight: 20,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
  },
  value: {
    maxWidth: '38%',
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'right',
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  trailing: {
    minWidth: 20,
    alignItems: 'flex-end',
  },
});
