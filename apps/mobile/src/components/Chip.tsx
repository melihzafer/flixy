import { Pressable, StyleSheet, View } from 'react-native';

import { colors, fonts } from '../theme/tokens';
import { Text } from './Text';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function Chip({ label, selected, onPress, accessibilityLabel }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.unselected,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text
        variant="body-s"
        style={{
          color: selected ? colors.accent : colors.text,
          fontFamily: fonts.bodySemi,
          letterSpacing: 0.2,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipGroup({ children }: { children: React.ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  selected: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  unselected: { backgroundColor: 'transparent', borderColor: colors.border2 },
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
