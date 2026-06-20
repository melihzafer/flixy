import { forwardRef } from 'react';
import { ActivityIndicator, Pressable, type PressableProps, StyleSheet, View } from 'react-native';

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
  primary: { bg: colors.accent, fg: colors.onAccent },
  secondary: { bg: 'transparent', fg: colors.text, border: colors.border2 },
  ghost: { bg: 'transparent', fg: colors.text },
  destructive: { bg: colors.leftBg, fg: colors.left, border: colors.left },
};

// On Android, Pressable with accessibilityRole="button" maps to a native
// android.widget.Button which ignores backgroundColor + flexDirection on its
// children. We render the chrome on an inner View and keep the Pressable as a
// transparent touch shell (see cerebrum entry 2026-05-02 + 2026-05-07).
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
        fullWidth && styles.fullWidth,
        {
          opacity: isDisabled ? 0.5 : state.pressed ? 0.85 : 1,
          transform: [{ scale: state.pressed && !isDisabled ? 0.985 : 1 }],
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      <View
        style={[
          styles.base,
          {
            backgroundColor: c.bg,
            borderWidth: c.border ? 1.5 : 0,
            borderColor: c.border ?? 'transparent',
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={c.fg} />
        ) : (
          <Text variant="body-l" style={{ color: c.fg, fontFamily: fonts.bodyBold }}>
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
});
