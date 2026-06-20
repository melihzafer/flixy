const DEPRECATION_PATTERN = /(?:read|write)AsStringAsync.*expo-file-system.*deprecated/i;
const AUTH_REFRESH_READONLY_PATTERN =
  /error finding refresh token for update|SELECT FOR UPDATE in a read-only transaction|SQLSTATE 25006/i;

const consoleWithPatch = console as typeof console & {
  __flixySilenceWarningsPatched?: boolean;
};

function getWarningText(args: unknown[]) {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.message;
      return '';
    })
    .join(' ');
}

if (!consoleWithPatch.__flixySilenceWarningsPatched) {
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);
  console.warn = (...args: unknown[]) => {
    if (DEPRECATION_PATTERN.test(getWarningText(args))) return;
    originalWarn(...args);
  };
  console.error = (...args: unknown[]) => {
    if (AUTH_REFRESH_READONLY_PATTERN.test(getWarningText(args))) {
      originalWarn('[auth] Stored session could not be refreshed; please sign in again.');
      return;
    }
    originalError(...args);
  };
  consoleWithPatch.__flixySilenceWarningsPatched = true;
}
