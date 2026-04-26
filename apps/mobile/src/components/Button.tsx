import { forwardRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  type View,
} from 'react-native';

import { colors, fonts } from '../theme/tokens';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
};

const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.accent, fg: colors.text },
  secondary: { bg: 'transparent', fg: colors.text, border: colors.border2 },
  ghost: { bg: 'transparent', fg: colors.text },
  destructive: { bg: colors.leftBg, fg: colors.left, border: colors.left },
};

export const Button = forwardRef<View, Props>(function Button(
  { label, variant = 'primary', loading, disabled, fullWidth = true, style, ...rest },
  ref,
) {
  const c = palette[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        {
          backgroundColor: c.bg,
          borderWidth: c.border ? 1.5 : 0,
          borderColor: c.border ?? 'transparent',
          opacity: isDisabled ? 0.5 : state.pressed ? 0.85 : 1,
        },
        fullWidth && styles.fullWidth,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <Text variant="body-l" style={{ color: c.fg, fontFamily: fonts.bodySemi }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
});
