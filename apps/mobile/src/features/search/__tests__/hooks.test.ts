jest.mock('../../../lib/analytics', () => ({ posthog: null, track: jest.fn() }));
jest.mock('../../../lib/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: { from: jest.fn() },
}));

import type { SearchTitlesResult } from '../hooks';
import { getSearchUiState } from '../hooks';

const baseResult: SearchTitlesResult = {
  titles: [],
  catalogueV2Enabled: true,
  diagnostics: {
    liveCandidateCount: 0,
    candidateCount: 0,
    afterServiceFilterCount: null,
    fallbackReason: null,
    isFallback: false,
    isNarrow: true,
    emptyReason: null,
  },
};

describe('getSearchUiState', () => {
  it('models idle, searching, results, empty, and offline fallback states', () => {
    expect(getSearchUiState({ query: '', isFetching: false })).toBe('idle');
    expect(getSearchUiState({ query: 's', isFetching: false })).toBe('idle');
    expect(getSearchUiState({ query: 'sherlock', isFetching: true })).toBe('searching');
    expect(
      getSearchUiState({
        query: 'sherlock',
        isFetching: false,
        result: { ...baseResult, titles: [{ id: '1' } as SearchTitlesResult['titles'][number]] },
      }),
    ).toBe('results');
    expect(getSearchUiState({ query: 'sherlock', isFetching: false, result: baseResult })).toBe(
      'empty',
    );
    expect(
      getSearchUiState({
        query: 'sherlock',
        isFetching: false,
        result: {
          ...baseResult,
          diagnostics: { ...baseResult.diagnostics, fallbackReason: 'query_failed' },
        },
      }),
    ).toBe('offline_fallback');
  });
});
