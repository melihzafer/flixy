import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/tokens';
import { Text } from './Text';

type Props = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  scroll?: boolean;
};

/**
 * Common screen chrome: dark canvas, optional title in Newsreader italic
 * display + Space Grotesk muted subtitle. Scrollable by default.
 */
export function Screen({ title, subtitle, children, scroll = true }: Props) {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top + 24,
    paddingBottom: insets.bottom + 24,
    paddingHorizontal: 24,
    gap: 16,
  } as const;

  const inner = (
    <>
      {title ? (
        <View style={{ gap: 6, marginBottom: 8 }}>
          <Text variant="display-m" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="body-m" tone="muted">
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </>
  );

  if (scroll) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={padding}
        keyboardShouldPersistTaps="handled"
      >
        {inner}
      </ScrollView>
    );
  }

  return <View style={[{ flex: 1, backgroundColor: colors.bg }, padding]}>{inner}</View>;
}
