import { forwardRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  type View,
} from 'react-native';

import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
};

const palette = {
  primary: { bg: '#F5F5F7', fg: '#0B0B0F' },
  secondary: { bg: '#1F1F23', fg: '#F5F5F7' },
  ghost: { bg: 'transparent', fg: '#F5F5F7' },
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
        { backgroundColor: c.bg, opacity: isDisabled ? 0.5 : state.pressed ? 0.85 : 1 },
        fullWidth && styles.fullWidth,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <Text variant="body-l" style={{ color: c.fg, fontWeight: '600' }}>
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
