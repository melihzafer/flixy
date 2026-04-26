import { Text } from './Text';

/**
 * 10px overline caption with wide tracking — used as section headers throughout
 * the design (e.g. "AVAILABLE ON", "GENRES", "TONIGHT'S DECK").
 */
export function SectionLabel({ children }: { children: string }) {
  return (
    <Text variant="overline" tone="muted" style={{ textTransform: 'uppercase' }}>
      {children}
    </Text>
  );
}
