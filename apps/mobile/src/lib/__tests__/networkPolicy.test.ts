import { shouldRetryQuery } from '../networkPolicy';

describe('shouldRetryQuery', () => {
  it.each([408, 425, 429, 500, 502, 503, 504])('retries transient HTTP %i', (status) => {
    expect(shouldRetryQuery(0, { status })).toBe(true);
  });

  it.each([400, 401, 403, 404, 409, 422])('does not retry permanent HTTP %i', (status) => {
    expect(shouldRetryQuery(0, { status })).toBe(false);
  });

  it('caps transient retries at two attempts', () => {
    expect(shouldRetryQuery(1, { name: 'TimeoutError' })).toBe(true);
    expect(shouldRetryQuery(2, { name: 'TimeoutError' })).toBe(false);
  });

  it('does not retry unclassified failures', () => {
    expect(shouldRetryQuery(0, new Error('invalid response'))).toBe(false);
  });
});
