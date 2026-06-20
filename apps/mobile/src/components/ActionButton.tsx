import type { ComponentType, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  StyleSheet,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import { colors, fonts } from '../theme/tokens';
import { Text } from './Text';

type ActionButtonIcon = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

type ActionTone = 'neutral' | 'pass' | 'save' | 'top' | 'seen' | 'info' | 'danger';

type Props = {
  onPress: () => void;
  Icon?: ActionButtonIcon;
  children?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | number;
  iconSize?: number;
  tone?: ActionTone;
  variant?: 'default' | 'accent';
  borderColor?: string;
  label?: string;
  accessibilityLabel: string;
  testID?: string;
  disabled?: boolean;
  loading?: boolean;
  selected?: boolean;
  showLabel?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

export function ActionButton({
  onPress,
  Icon,
  children,
  size = 'md',
  iconSize,
  tone = 'neutral',
  variant = 'default',
  borderColor,
  label,
  accessibilityLabel,
  testID,
  disabled,
  loading,
  selected,
  showLabel = false,
  containerStyle,
  labelStyle,
}: Props) {
  const dim = resolveSize(size);
  const resolvedIconSize = iconSize ?? (dim >= 56 ? 24 : dim <= 44 ? 18 : 20);
  const isPrimary = variant === 'accent';
  const isDisabled = disabled || loading;
  const toneStyle = getToneStyle(tone);
  const visibleLabel = label ?? accessibilityLabel;

  return (
    <View style={[styles.wrapper, { width: Math.max(dim, showLabel ? 52 : dim) }, containerStyle]}>
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: isDisabled, busy: loading, selected }}
        hitSlop={4}
        style={({ pressed }) => [
          styles.base,
          {
            width: dim,
            height: dim,
            minWidth: 44,
            minHeight: 44,
            borderRadius: dim / 2,
            borderWidth: 1.5,
            borderColor: resolveBorderColor({
              isPrimary,
              isDisabled,
              pressed,
              selected,
              toneBorder: borderColor ?? toneStyle.border,
            }),
            backgroundColor: resolveBackgroundColor({
              isPrimary,
              isDisabled,
              pressed,
              selected,
              toneBg: toneStyle.bg,
              tonePressedBg: toneStyle.pressedBg,
            }),
            transform: [{ scale: pressed && !isDisabled ? 0.97 : 1 }],
            opacity: isDisabled ? 0.58 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={isPrimary ? colors.bg : toneStyle.icon} />
        ) : Icon ? (
          <Icon
            size={resolvedIconSize}
            color={isDisabled ? colors.textDim : isPrimary ? colors.bg : toneStyle.icon}
            strokeWidth={isPrimary ? 2.45 : 2.2}
          />
        ) : (
          children
        )}
      </Pressable>
      {showLabel ? (
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            { color: isPrimary ? 'rgba(255,77,28,0.86)' : toneStyle.label },
            isDisabled && styles.disabledLabel,
            labelStyle,
          ]}
        >
          {visibleLabel}
        </Text>
      ) : null}
    </View>
  );
}

function resolveSize(size: Props['size']) {
  if (typeof size === 'number') return Math.max(44, size);
  if (size === 'sm') return 44;
  if (size === 'lg') return 58;
  return 50;
}

function getToneStyle(tone: ActionTone) {
  switch (tone) {
    case 'pass':
    case 'danger':
      return {
        icon: colors.left,
        label: 'rgba(224,92,75,0.82)',
        bg: 'rgba(245,245,240,0.045)',
        pressedBg: colors.leftBg,
        border: 'rgba(224,92,75,0.34)',
      };
    case 'save':
      return {
        icon: colors.accent,
        label: 'rgba(255,77,28,0.86)',
        bg: colors.accentDim,
        pressedBg: 'rgba(255,77,28,0.26)',
        border: colors.accentBorder,
      };
    case 'top':
      return {
        icon: colors.up,
        label: 'rgba(245,200,66,0.78)',
        bg: 'rgba(245,245,240,0.045)',
        pressedBg: colors.upBg,
        border: 'rgba(245,200,66,0.36)',
      };
    case 'seen':
      return {
        icon: colors.down,
        label: 'rgba(91,141,239,0.82)',
        bg: 'rgba(245,245,240,0.045)',
        pressedBg: colors.downBg,
        border: 'rgba(91,141,239,0.34)',
      };
    case 'info':
      return {
        icon: 'rgba(245,245,240,0.58)',
        label: 'rgba(245,245,240,0.42)',
        bg: 'rgba(245,245,240,0.045)',
        pressedBg: 'rgba(255,77,28,0.08)',
        border: colors.accentBorder,
      };
    default:
      return {
        icon: 'rgba(245,245,240,0.68)',
        label: 'rgba(245,245,240,0.46)',
        bg: 'rgba(245,245,240,0.045)',
        pressedBg: 'rgba(245,245,240,0.09)',
        border: colors.border2,
      };
  }
}

function resolveBorderColor({
  isPrimary,
  isDisabled,
  pressed,
  selected,
  toneBorder,
}: {
  isPrimary: boolean;
  isDisabled?: boolean;
  pressed: boolean;
  selected?: boolean;
  toneBorder: string;
}) {
  if (isDisabled) return colors.border;
  if (isPrimary) return colors.accent;
  if (pressed || selected) return toneBorder;
  return 'rgba(245,245,240,0.09)';
}

function resolveBackgroundColor({
  isPrimary,
  isDisabled,
  pressed,
  selected,
  toneBg,
  tonePressedBg,
}: {
  isPrimary: boolean;
  isDisabled?: boolean;
  pressed: boolean;
  selected?: boolean;
  toneBg: string;
  tonePressedBg: string;
}) {
  if (isDisabled) return 'rgba(245,245,240,0.025)';
  if (isPrimary) return pressed ? '#E84618' : colors.accent;
  if (pressed || selected) return tonePressedBg;
  return toneBg;
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 5 },
  base: { alignItems: 'center', justifyContent: 'center' },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.7,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  disabledLabel: { color: colors.textDim },
});
