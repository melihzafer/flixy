import { Platform } from 'react-native';

/**
 * Flixy ships as a native APK (Platform.OS === 'ios' | 'android') and as a
 * deployed web build (Platform.OS === 'web'). Only the web build can ever be
 * installed as a PWA — `isWebPlatform` is the first gate every caller must
 * check before touching anything else here. Within the web build, the
 * underlying OS still matters: Chromium browsers support the
 * `beforeinstallprompt` native install flow, while iOS/Safari has no such
 * API and needs manual "Share -> Add to Home Screen" instructions instead.
 */
export function isWebPlatform(): boolean {
  return Platform.OS === 'web';
}

/** True once the app is already running as an installed/standalone PWA. */
export function isStandaloneDisplayMode(): boolean {
  if (!isWebPlatform() || typeof window === 'undefined') return false;
  const matchesStandaloneMedia =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const nav =
    typeof navigator === 'undefined'
      ? undefined
      : (navigator as Navigator & { standalone?: boolean });
  return Boolean(matchesStandaloneMedia) || nav?.standalone === true;
}

/** iPhone/iPad Safari (and other iOS browsers, which all run on WebKit). */
export function isIosWebBrowser(): boolean {
  if (!isWebPlatform() || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent ?? '';
  const isIphoneOrIpad = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ reports as "Macintosh" in the UA string; multi-touch is the
  // tell that distinguishes it from an actual Mac.
  const isIpadMasqueradingAsMac =
    navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1;
  return isIphoneOrIpad || isIpadMasqueradingAsMac;
}
