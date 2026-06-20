const READ_ONLY_REFRESH_TOKEN_PATTERN =
  /error finding refresh token for update|SELECT FOR UPDATE in a read-only transaction|SQLSTATE 25006/i;
const FLOW_STATE_PATTERN = /Error creating flow state|unexpected_failure/i;

export function getAuthErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(error);
}

export function isReadOnlyRefreshTokenError(error: unknown) {
  return READ_ONLY_REFRESH_TOKEN_PATTERN.test(getAuthErrorMessage(error));
}

export function isOAuthFlowStateError(error: unknown) {
  return FLOW_STATE_PATTERN.test(getAuthErrorMessage(error));
}
