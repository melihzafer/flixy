import { Text as RNText, type TextProps } from 'react-native';
import { type TypographyVariant, colors, typography } from '../theme/tokens';

type Props = TextProps & {
  variant?: TypographyVariant;
  /** Optional shorthand to switch to muted/dim text colors. */
  tone?: 'default' | 'muted' | 'dim' | 'accent';
};

const toneColor = {
  default: colors.text,
  muted: colors.textMuted,
  dim: colors.textDim,
  accent: colors.accent,
} as const;

export function Text({ variant = 'body-m', tone = 'default', style, ...rest }: Props) {
  return <RNText {...rest} style={[typography[variant], { color: toneColor[tone] }, style]} />;
}
