import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, layout, spacing } from '../theme/tokens';
import { Text } from './Text';

type Props = {
  title?: string;
  subtitle?: string;
  status?: string;
  right?: ReactNode;
};

export function AppHeader({ title, subtitle, status, right }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingRight: insets.right + spacing[4],
        },
      ]}
    >
      <View
        style={[
          styles.titleBlock,
          {
            paddingLeft: insets.left + spacing[4],
          },
        ]}
      >
        {title ? (
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={title === 'Flixy' ? styles.wordmarkTitle : styles.title}
          >
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
        {status ? (
          <Text numberOfLines={1} style={styles.status}>
            {status}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing[2],
    paddingTop: spacing[3],
  },
  titleBlock: {
    flex: 1,
    minHeight: 36,
    paddingRight: spacing[2],
  },
  title: {
    color: colors.text,
    fontFamily: fonts.displayMedium,
    fontSize: 22,
    letterSpacing: -0.1,
    lineHeight: 28,
  },
  wordmarkTitle: {
    color: colors.accent,
    fontFamily: fonts.wordmark,
    fontSize: 28,
    lineHeight: 34,
    paddingLeft: 8,
    minWidth: layout.wordmarkMinWidth,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
  status: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
  right: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
});
