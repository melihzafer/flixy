import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from './Text';

type Props = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  scroll?: boolean;
};

/**
 * Common screen chrome: respects safe-area, dark background, optional title +
 * subtitle in display typography. Scrollable by default for forms / long pages.
 */
export function Screen({ title, subtitle, children, scroll = true }: Props) {
  const insets = useSafeAreaInsets();
  const Container = scroll ? ScrollView : View;

  return (
    <Container
      style={{ flex: 1, backgroundColor: '#0B0B0F' }}
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 24,
        gap: 16,
      }}
      keyboardShouldPersistTaps={scroll ? 'handled' : undefined}
    >
      {title ? (
        <View style={{ gap: 4, marginBottom: 8 }}>
          <Text variant="display-m" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="body-m" style={{ color: '#A1A1AA' }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </Container>
  );
}
