import type { ReactNode } from 'react';
import { ScrollView, type StyleProp, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/tokens';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Common screen chrome: dark canvas only. No built-in title.
 * Each screen manages its own header to match the prototype exactly.
 */
export function Screen({ children, scroll = true, style }: Props) {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
    flexGrow: 1,
  } as const;

  if (scroll) {
    return (
      <ScrollView
        style={[{ flex: 1, backgroundColor: colors.bg }, style]}
        contentContainerStyle={padding}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={[{ flex: 1, backgroundColor: colors.bg }, padding, style]}>{children}</View>;
}
