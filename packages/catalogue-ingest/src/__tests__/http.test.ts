import { fetchWithTimeout } from '../http';

describe('fetchWithTimeout', () => {
  it('passes an abort signal to the underlying request', async () => {
    const fetchImpl = jest.fn(async (_input, init) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;

    await fetchWithTimeout(fetchImpl, 'https://example.test');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('aborts a request that exceeds its deadline', async () => {
    const fetchImpl = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        }),
    ) as unknown as typeof fetch;

    await expect(fetchWithTimeout(fetchImpl, 'https://example.test', {}, 1)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
