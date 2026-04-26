import { Pressable, StyleSheet, View } from 'react-native';

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
      <Text variant="body-m" style={{ color: selected ? '#0B0B0F' : '#F5F5F7', fontWeight: '600' }}>
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  selected: { backgroundColor: '#F5F5F7', borderColor: '#F5F5F7' },
  unselected: { backgroundColor: 'transparent', borderColor: '#3F3F46' },
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
