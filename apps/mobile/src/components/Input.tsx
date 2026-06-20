import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { colors, fonts, radii, spacing } from '../theme/tokens';
import { Text } from './Text';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  helperText?: string | null;
  showPasswordLabel?: string;
  hidePasswordLabel?: string;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  {
    label,
    error,
    helperText,
    style,
    onFocus,
    onBlur,
    secureTextEntry,
    accessibilityLabel,
    placeholderTextColor,
    selectionColor,
    showPasswordLabel = 'Show password',
    hidePasswordLabel = 'Hide password',
    editable = true,
    ...rest
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const hasSecureToggle = !!secureTextEntry;
  const help = error ?? helperText;

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="overline" style={styles.label} accessibilityRole="text">
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          !!error && styles.fieldError,
          !editable && styles.fieldDisabled,
        ]}
      >
        <TextInput
          ref={ref}
          placeholderTextColor={placeholderTextColor ?? 'rgba(245,245,240,0.42)'}
          selectionColor={selectionColor ?? colors.accent}
          cursorColor={colors.accent}
          style={[styles.input, hasSecureToggle && styles.inputWithToggle, style]}
          accessibilityLabel={accessibilityLabel ?? label}
          secureTextEntry={hasSecureToggle && !passwordVisible}
          editable={editable}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {hasSecureToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${passwordVisible ? hidePasswordLabel : showPasswordLabel} ${
              label ?? 'password'
            }`}
            accessibilityState={{ expanded: passwordVisible }}
            hitSlop={8}
            onPress={() => setPasswordVisible((value) => !value)}
            style={({ pressed }) => [styles.toggleShell, pressed && styles.togglePressed]}
          >
            <View style={styles.toggleInner}>
              <Text style={styles.toggleText}>
                {passwordVisible ? hidePasswordLabel : showPasswordLabel}
              </Text>
            </View>
          </Pressable>
        ) : null}
      </View>
      {help ? (
        <Text
          variant="caption"
          style={[styles.helpText, error ? styles.errorText : styles.helperText]}
          accessibilityLiveRegion={error ? 'polite' : 'none'}
        >
          {help}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing[2] },
  label: {
    color: 'rgba(245,245,240,0.62)',
    textTransform: 'uppercase',
  },
  field: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderColor: 'rgba(245,245,240,0.13)',
    borderRadius: radii.md + 2,
    borderWidth: 1.5,
    flexDirection: 'row',
    minHeight: 54,
  },
  fieldFocused: {
    backgroundColor: 'rgba(255,255,255,0.075)',
    borderColor: colors.accentBorder,
  },
  fieldError: {
    borderColor: 'rgba(224,92,75,0.78)',
  },
  fieldDisabled: {
    opacity: 0.55,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    minHeight: 54,
    paddingHorizontal: spacing[4],
    paddingVertical: 0,
  },
  inputWithToggle: {
    paddingRight: spacing[2],
  },
  toggleShell: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  toggleInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  togglePressed: {
    opacity: 0.58,
  },
  toggleText: {
    color: colors.accent,
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  helpText: {
    lineHeight: 16,
  },
  helperText: {
    color: colors.textDim,
  },
  errorText: {
    color: colors.left,
  },
});
