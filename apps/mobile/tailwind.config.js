/** @type {import('tailwindcss').Config} */
// Mirror src/theme/tokens.ts — keep the two in sync.
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0A0A0B',
          surface: '#111113',
          surface2: '#1A1A1D',
          surface3: '#242428',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.08)',
          strong: 'rgba(255,255,255,0.14)',
        },
        text: {
          DEFAULT: '#F5F5F0',
          muted: 'rgba(245,245,240,0.55)',
          dim: 'rgba(245,245,240,0.30)',
        },
        accent: {
          DEFAULT: '#FF4D1C',
          dim: 'rgba(255,77,28,0.18)',
        },
        swipe: {
          right: '#3DD68C',
          left: '#E05C4B',
          up: '#F5C842',
          down: '#5B8DEF',
        },
        success: '#3DD68C',
        warning: '#F5C842',
        danger: '#E05C4B',
      },
      fontFamily: {
        display: ['Newsreader_700Italic', 'serif'],
        body: ['SpaceGrotesk_400Regular', 'sans-serif'],
        'body-medium': ['SpaceGrotesk_500Medium', 'sans-serif'],
        'body-semibold': ['SpaceGrotesk_600SemiBold', 'sans-serif'],
        'body-bold': ['SpaceGrotesk_700Bold', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['48px', { lineHeight: '52px', letterSpacing: '-0.02em' }],
        'display-l': ['38px', { lineHeight: '42px', letterSpacing: '-0.02em' }],
        'display-m': ['28px', { lineHeight: '32px', letterSpacing: '-0.01em' }],
        'display-s': ['22px', { lineHeight: '26px', letterSpacing: '-0.01em' }],
        'title-l': ['18px', { lineHeight: '24px' }],
        'title-m': ['16px', { lineHeight: '22px' }],
        'body-l': ['15px', { lineHeight: '22px' }],
        'body-m': ['14px', { lineHeight: '20px' }],
        'body-s': ['13px', { lineHeight: '18px' }],
        caption: ['11px', { lineHeight: '14px', letterSpacing: '0.05em' }],
        overline: ['10px', { lineHeight: '12px', letterSpacing: '0.12em' }],
      },
    },
  },
  plugins: [],
};
