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
        pressed && { opacity: 0.86, transform: [{ scale: 0.985 }] },
      ]}
    >
      <Text
        variant="body-s"
        style={{
          color: selected ? colors.text : colors.textMuted,
          fontFamily: fonts.bodySemi,
          letterSpacing: 0.15,
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
    minHeight: 34,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  selected: { backgroundColor: 'rgba(255,77,28,0.16)', borderColor: colors.accentBorder },
  unselected: { backgroundColor: 'rgba(245,245,240,0.035)', borderColor: colors.border },
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
});
