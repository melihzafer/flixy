import { Text as RNText, type TextProps } from 'react-native';
import { type TypographyVariant, typography } from '../theme/tokens';

type Props = TextProps & {
  variant?: TypographyVariant;
};

export function Text({ variant = 'body-m', style, ...rest }: Props) {
  return <RNText {...rest} style={[typography[variant], { color: '#F5F5F7' }, style]} />;
}
