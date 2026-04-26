import { StyleSheet, View } from 'react-native';

import { colors } from '../theme/tokens';
import { Text } from './Text';

/**
 * Per-service squircle badge. Brand color background with a single white
 * letter, dimmed when the user does not own the service.
 */

const BRAND: Record<string, { bg: string; letter: string }> = {
  netflix: { bg: '#E50914', letter: 'N' },
  prime: { bg: '#00A8E1', letter: 'P' },
  disney: { bg: '#0E2A65', letter: 'D' },
  hbo: { bg: '#5C2D91', letter: 'H' },
  appletv: { bg: '#000000', letter: 'A' },
  hulu: { bg: '#1CE783', letter: 'H' },
  paramount: { bg: '#0064FF', letter: 'P' },
  peacock: { bg: '#000000', letter: 'P' },
};

type Size = 'sm' | 'md' | 'lg';

const dim = { sm: 22, md: 28, lg: 36 } as const;

export function ServiceBadge({
  serviceId,
  size = 'md',
  owned = true,
}: {
  serviceId: string;
  size?: Size;
  owned?: boolean;
}) {
  const sz = dim[size];
  const brand = BRAND[serviceId.toLowerCase()] ?? {
    bg: colors.surface3,
    letter: serviceId.charAt(0).toUpperCase(),
  };
  return (
    <View
      style={[
        styles.base,
        {
          width: sz,
          height: sz,
          borderRadius: sz * 0.28,
          backgroundColor: owned ? brand.bg : colors.surface3,
          opacity: owned ? 1 : 0.45,
        },
      ]}
    >
      <Text style={{ color: colors.text, fontSize: sz * 0.45, fontWeight: '700' }}>
        {brand.letter}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
