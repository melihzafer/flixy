import { Chrome } from 'lucide-react-native';
import { ActivityIndicator, Pressable, type PressableProps, StyleSheet, View } from 'react-native';

import { colors, fonts, radii, spacing } from '../theme/tokens';
import { Text } from './Text';

type Provider = 'google';

type Props = Omit<PressableProps, 'children'> & {
  provider: Provider;
  label: string;
  loading?: boolean;
};

const palette: Record<
  Provider,
  { bg: string; fg: string; border: string; markBg: string; markFg: string }
> = {
  google: {
    bg: 'rgba(255,255,255,0.058)',
    fg: colors.text,
    border: 'rgba(245,245,240,0.13)',
    markBg: '#F5F5F0',
    markFg: '#4285F4',
  },
};

export function SocialButton({ provider, label, disabled, loading, style, ...rest }: Props) {
  const c = palette[provider];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        {
          backgroundColor: c.bg,
          borderColor: c.border,
          opacity: isDisabled ? 0.55 : state.pressed ? 0.85 : 1,
          transform: [{ scale: state.pressed && !isDisabled ? 0.985 : 1 }],
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      <ProviderMark backgroundColor={c.markBg} color={c.markFg} />
      <Text numberOfLines={1} style={[styles.label, { color: c.fg }]}>
        {label}
      </Text>
      {loading ? <ActivityIndicator color={c.fg} size="small" style={styles.loader} /> : null}
    </Pressable>
  );
}

function ProviderMark({
  backgroundColor,
  color,
}: {
  backgroundColor: string;
  color: string;
}) {
  return (
    <View style={[styles.mark, { backgroundColor }]}>
      <Chrome size={16} color={color} strokeWidth={2.2} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: radii.md + 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: spacing[12],
    position: 'relative',
  },
  mark: {
    position: 'absolute',
    left: spacing[4],
    width: 26,
    height: 26,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flexShrink: 1,
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  loader: {
    position: 'absolute',
    right: spacing[4],
  },
});
