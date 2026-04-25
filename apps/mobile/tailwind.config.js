/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Neutral placeholder palette — dark-first per FSD § 4.0.
        // Will be replaced one-file when Claude Design ships final tokens.
        bg: {
          DEFAULT: '#0B0B0F',
          elevated: '#15151B',
          subtle: '#1E1E25',
        },
        fg: {
          DEFAULT: '#F5F5F7',
          muted: '#A1A1AA',
          subtle: '#71717A',
        },
        accent: {
          DEFAULT: '#E11D48',
          muted: '#9F1239',
        },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      fontFamily: {
        // Per FSD § 4.0.2; using Fraunces + Inter as Grilli Type fallback (SRS NFR-BRAND-004).
        display: ['Fraunces_700Bold', 'serif'],
        'display-italic': ['Fraunces_400Regular_Italic', 'serif'],
        body: ['Inter_400Regular', 'sans-serif'],
        'body-medium': ['Inter_500Medium', 'sans-serif'],
        'body-semibold': ['Inter_600SemiBold', 'sans-serif'],
      },
      fontSize: {
        // Typography tokens from FSD § 4.0.2
        'display-xl': ['56px', { lineHeight: '60px', letterSpacing: '-0.02em' }],
        'display-l': ['44px', { lineHeight: '48px', letterSpacing: '-0.02em' }],
        'display-m': ['32px', { lineHeight: '38px', letterSpacing: '-0.01em' }],
        'title-l': ['24px', { lineHeight: '30px' }],
        'title-m': ['20px', { lineHeight: '26px' }],
        'body-l': ['17px', { lineHeight: '24px' }],
        'body-m': ['15px', { lineHeight: '22px' }],
        'body-s': ['13px', { lineHeight: '18px' }],
        caption: ['11px', { lineHeight: '14px', letterSpacing: '0.04em' }],
      },
    },
  },
  plugins: [],
};
