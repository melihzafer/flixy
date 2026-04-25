/**
 * Design tokens — single source of truth for non-Tailwind consumers (Reanimated,
 * native modal backdrops, status bar, etc.). When Claude Design hands off the
 * final palette, swap the values here AND in tailwind.config.js. That's the
 * "one-file change" the build prompt references — keep them aligned.
 *
 * Typography scale mirrors FSD § 4.0.2.
 */

export const colors = {
  bg: '#0B0B0F',
  bgElevated: '#15151B',
  bgSubtle: '#1E1E25',
  fg: '#F5F5F7',
  fgMuted: '#A1A1AA',
  fgSubtle: '#71717A',
  accent: '#E11D48',
  accentMuted: '#9F1239',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  transparent: 'transparent',
} as const;

export const radii = {
  none: 0,
  sm: 6,
  md: 12,
  lg: 20,
  xl: 28,
  full: 9999,
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const typography = {
  'display-xl': { fontFamily: 'Fraunces_700Bold', fontSize: 56, lineHeight: 60 },
  'display-l': { fontFamily: 'Fraunces_700Bold', fontSize: 44, lineHeight: 48 },
  'display-m': { fontFamily: 'Fraunces_700Bold', fontSize: 32, lineHeight: 38 },
  'title-l': { fontFamily: 'Inter_600SemiBold', fontSize: 24, lineHeight: 30 },
  'title-m': { fontFamily: 'Inter_600SemiBold', fontSize: 20, lineHeight: 26 },
  'body-l': { fontFamily: 'Inter_400Regular', fontSize: 17, lineHeight: 24 },
  'body-m': { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
  'body-s': { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 14 },
} as const;

export type TypographyVariant = keyof typeof typography;
