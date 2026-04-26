import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors } from '../theme/tokens';

type Props = {
  onPress: () => void;
  children: ReactNode;
  size?: 'md' | 'lg';
  variant?: 'default' | 'accent';
  borderColor?: string;
  accessibilityLabel: string;
  disabled?: boolean;
};

/**
 * Circular action button used by the deck action bar and the title-detail
 * sheet. `lg` + `accent` variant matches the prototype's central
 * watchlist button.
 */
export function ActionButton({
  onPress,
  children,
  size = 'md',
  variant = 'default',
  borderColor,
  accessibilityLabel,
  disabled,
}: Props) {
  const dim = size === 'lg' ? 58 : 50;
  const isAccent = variant === 'accent';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: isAccent ? colors.accent : colors.surface2,
          borderWidth: borderColor ? 1.5 : isAccent ? 0 : 1,
          borderColor: borderColor ?? colors.border2,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
