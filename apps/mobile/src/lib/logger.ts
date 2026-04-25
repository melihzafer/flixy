/**
 * Structured logger. Use this instead of `console.log` in committed code.
 * In dev, prints to console; in production, breadcrumbs to Sentry only.
 */
import { Sentry } from './sentry';

type Level = 'debug' | 'info' | 'warn' | 'error';

function log(level: Level, message: string, context?: Record<string, unknown>) {
  if (__DEV__) {
    const fn = level === 'error' ? console.error : console.warn;
    fn(`[${level}] ${message}`, context ?? '');
  }
  const sentryLevel = level === 'debug' ? 'info' : level === 'warn' ? 'warning' : level;
  Sentry.addBreadcrumb({ category: 'app', level: sentryLevel, message, data: context });
}

export const logger = {
  debug: (m: string, c?: Record<string, unknown>) => log('debug', m, c),
  info: (m: string, c?: Record<string, unknown>) => log('info', m, c),
  warn: (m: string, c?: Record<string, unknown>) => log('warn', m, c),
  error: (m: string, c?: Record<string, unknown>) => {
    log('error', m, c);
    Sentry.captureMessage(m, 'error');
  },
};
