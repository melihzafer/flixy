import type { ReactNode } from 'react';
import { Platform, ScrollView, type StyleProp, View, type ViewStyle } from 'react-native';
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
 *
 * `paddingTop` floors at 16px so devices with no status-bar inset
 * (many Androids, older iPhones) still get breathing room from the
 * top edge — a raw 0 inset puts content under the glass with no gap.
 */
export function Screen({ children, scroll = true, style }: Props) {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: Math.max(insets.top, 16),
    paddingBottom: insets.bottom,
    flexGrow: 1,
  } as const;
  const webContentWidth: ViewStyle | null =
    Platform.OS === 'web' ? { alignSelf: 'center', maxWidth: 720, width: '100%' as const } : null;

  if (scroll) {
    return (
      <ScrollView
        style={[{ flex: 1, backgroundColor: colors.bg }, webContentWidth, style]}
        contentContainerStyle={padding}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[{ flex: 1, backgroundColor: colors.bg }, webContentWidth, padding, style]}>
      {children}
    </View>
  );
}
