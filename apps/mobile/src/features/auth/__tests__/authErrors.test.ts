import {
  getAuthErrorMessage,
  isOAuthFlowStateError,
  isReadOnlyRefreshTokenError,
} from '../authErrors';

describe('authErrors', () => {
  it('classifies Supabase read-only refresh-token failures', () => {
    const error = new Error(
      'error finding refresh token for update: ERROR: cannot execute SELECT FOR UPDATE in a read-only transaction (SQLSTATE 25006)',
    );

    expect(isReadOnlyRefreshTokenError(error)).toBe(true);
  });

  it('reads message-like auth errors without leaking object formatting', () => {
    expect(getAuthErrorMessage({ message: 'Auth failed' })).toBe('Auth failed');
    expect(isReadOnlyRefreshTokenError(new Error('Invalid login credentials'))).toBe(false);
  });

  it('classifies hosted Supabase OAuth flow-state failures', () => {
    expect(isOAuthFlowStateError({ message: 'Error creating flow state' })).toBe(true);
    expect(isOAuthFlowStateError({ message: 'Invalid login credentials' })).toBe(false);
  });
});
