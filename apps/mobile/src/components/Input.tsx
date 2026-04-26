import { forwardRef } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { Text } from './Text';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, style, ...rest },
  ref,
) {
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="caption" style={styles.label} accessibilityRole="text">
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor="#71717A"
        style={[styles.input, !!error && styles.inputError, style]}
        accessibilityLabel={label}
        {...rest}
      />
      {error ? (
        <Text variant="caption" style={styles.errorText} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: '#16161A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#F5F5F7',
    borderWidth: 1,
    borderColor: '#26262B',
  },
  inputError: { borderColor: '#F87171' },
  errorText: { color: '#F87171' },
});
