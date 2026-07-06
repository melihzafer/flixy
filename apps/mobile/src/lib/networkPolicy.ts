const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

type HttpLikeError = {
  status?: unknown;
  code?: unknown;
  name?: unknown;
};

/**
 * Queries may retry only failures that are likely to recover. Mutations never
 * use this policy because an ambiguous write response cannot safely be replayed
 * without operation-specific idempotency.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;

  const candidate = error as HttpLikeError | null;
  const status = typeof candidate?.status === 'number' ? candidate.status : null;
  if (status !== null) return TRANSIENT_HTTP_STATUSES.has(status);

  const name = typeof candidate?.name === 'string' ? candidate.name : '';
  if (name === 'AbortError' || name === 'TimeoutError') return true;

  const code = typeof candidate?.code === 'string' ? candidate.code : '';
  return ['ECONNRESET', 'ECONNREFUSED', 'ENETUNREACH', 'ETIMEDOUT'].includes(code);
}
