/**
 * Flixy design tokens — handed off from Claude Design (UI_UX_Claude_Design/).
 *
 * Typography pairs Newsreader (italic editorial serif) with Space Grotesk
 * (geometric sans). Palette is dark-first per FSD § 4.0 with a single brand
 * accent at #FF4D1C and four semantic swipe colors (right/left/up/down).
 *
 * Single source of truth for non-Tailwind consumers (Reanimated worklets,
 * StatusBar, navigation theme). Mirror any changes here in tailwind.config.js.
 */

export const colors = {
  // Surfaces
  bg: '#0A0A0B',
  surface: '#111113',
  surface2: '#1A1A1D',
  surface3: '#242428',

  // Strokes
  border: 'rgba(255,255,255,0.08)',
  border2: 'rgba(255,255,255,0.14)',

  // Type
  text: '#F5F5F0',
  textMuted: 'rgba(245,245,240,0.55)',
  textDim: 'rgba(245,245,240,0.30)',

  // Brand
  accent: '#FF4D1C',
  accentDim: 'rgba(255,77,28,0.18)',
  accentBorder: 'rgba(255,77,28,0.35)',

  // Swipe semantics
  right: '#3DD68C',
  rightBg: 'rgba(61,214,140,0.15)',
  left: '#E05C4B',
  leftBg: 'rgba(224,92,75,0.15)',
  up: '#F5C842',
  upBg: 'rgba(245,200,66,0.15)',
  down: '#5B8DEF',
  downBg: 'rgba(91,141,239,0.15)',

  // Status (re-exported aliases for consistency)
  success: '#3DD68C',
  warning: '#F5C842',
  danger: '#E05C4B',
  transparent: 'transparent',
} as const;

export const fonts = {
  display: 'Newsreader_700Bold_Italic',
  displaySemi: 'Newsreader_600SemiBold_Italic',
  body: 'SpaceGrotesk_400Regular',
  bodyMedium: 'SpaceGrotesk_500Medium',
  bodySemi: 'SpaceGrotesk_600SemiBold',
  bodyBold: 'SpaceGrotesk_700Bold',
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
  'display-xl': {
    fontFamily: fonts.display,
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -0.5,
    fontStyle: 'italic',
  },
  'display-l': {
    fontFamily: fonts.display,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -0.4,
    fontStyle: 'italic',
  },
  'display-m': {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.3,
    fontStyle: 'italic',
  },
  'display-s': {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.2,
    fontStyle: 'italic',
  },
  'title-l': { fontFamily: fonts.bodySemi, fontSize: 18, lineHeight: 24 },
  'title-m': { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22 },
  'body-l': { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  'body-m': { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  'body-s': { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  caption: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
  },
  overline: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.2,
  },
} as const;

export type TypographyVariant = keyof typeof typography;
