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
  textMuted: 'rgba(245,245,240,0.45)',
  textDim: 'rgba(245,245,240,0.30)',

  // Brand
  accent: '#FF4D1C',
  onAccent: '#170806',
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
  wordmark: 'Damion_400Regular',
  display: 'Newsreader_800ExtraBold_Italic',
  displayBold: 'Newsreader_700Bold_Italic',
  displaySemi: 'Newsreader_600SemiBold_Italic',
  displayRegular: 'Newsreader_400Regular',
  displayMedium: 'Newsreader_500Medium',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemi: 'DMSans_600SemiBold',
  bodyBold: 'DMSans_700Bold',
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

export const layout = {
  wordmarkMinWidth: 104,
} as const;

export const typography = {
  // Display — Newsreader (italic for hero/card titles, regular for section heads)
  'display-xl': {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.4,
    fontStyle: 'italic',
  },
  'display-l': {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.3,
    fontStyle: 'italic',
  },
  'display-m': {
    fontFamily: fonts.displayMedium,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.1,
  },
  'display-s': {
    fontFamily: fonts.displayRegular,
    fontSize: 18,
    lineHeight: 24,
  },
  // Title — sans alternates kept for legacy callers
  'title-l': { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 24 },
  'title-m': { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 20 },
  // Body — Space Grotesk regular
  'body-l': { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  'body-m': { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  'body-s': { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  // Label — Space Grotesk Medium, uppercase, +0.04em ≈ 0.48px on 12px
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.48,
    textTransform: 'uppercase',
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 14,
  },
  overline: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.48,
    textTransform: 'uppercase',
  },
} as const;

export type TypographyVariant = keyof typeof typography;
