import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts } from '../theme/tokens';
import { Button } from './Button';
import { Text } from './Text';

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

/**
 * Catches uncaught render-tree errors anywhere under the root layout and shows
 * a friendly retry screen instead of a red dev overlay. Keeps the app from
 * looking broken to a non-technical user when something unexpected throws.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary] Uncaught render error', error, info);
    }
  }

  reset = () => this.setState({ error: null });

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 14, alignItems: 'center' }}>
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 24,
              backgroundColor: 'rgba(224,92,75,0.12)',
              borderWidth: 1,
              borderColor: 'rgba(224,92,75,0.28)',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 32,
            }}
          >
            <Text
              allowFontScaling={false}
              style={{
                fontFamily: fonts.display,
                fontSize: 40,
                lineHeight: 46,
                color: colors.left,
                textAlign: 'center',
              }}
            >
              !
            </Text>
          </View>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 28,
              color: colors.text,
              textAlign: 'center',
              letterSpacing: -0.3,
            }}
          >
            Something went wrong
          </Text>
          <Text
            style={{
              fontSize: 13,
              lineHeight: 20,
              color: colors.textMuted,
              textAlign: 'center',
              maxWidth: 320,
            }}
          >
            The app hit an unexpected problem. Your data is safe on this device. Try again, or
            relaunch Flixy if the issue persists.
          </Text>
          <View style={{ width: '100%', maxWidth: 320, gap: 10, marginTop: 8 }}>
            <Button label="Try again" onPress={this.reset} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show error details"
              onPress={() => {
                if (typeof __DEV__ !== 'undefined' && __DEV__) {
                  // eslint-disable-next-line no-console
                  console.error(this.state.error);
                }
              }}
              style={({ pressed }) => ({
                paddingVertical: 10,
                alignItems: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {__DEV__ ? 'Log details to console' : 'Available in dev builds'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }
}
