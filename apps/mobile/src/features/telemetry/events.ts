import { track } from '../../lib/analytics';

/**
 * Centralised event catalogue (FSD § 3.14). Every product event flows through
 * one of the helpers below so prop names stay in sync with the dbt model and
 * the dashboards in PostHog.
 */

export const events = {
  appOpened: () => track('app_opened'),
  screenViewed: (screen: string) => track('screen_viewed', { screen }),

  signedUp: (method: 'email' | 'apple' | 'google' | 'anonymous') => track('signed_up', { method }),
  signedIn: (method: 'email' | 'apple' | 'google' | 'anonymous') => track('signed_in', { method }),
  signedOut: () => track('signed_out'),
  authCreateAccountTapped: (surface: string) => track('auth_create_account_tapped', { surface }),
  oauthStarted: (provider: 'google') => track('auth_oauth_started', { provider }),
  oauthCompleted: (props: {
    provider: 'google';
    handledBy: 'web_browser' | 'deep_link';
    flow: 'pkce' | 'fragment' | 'session';
    duration_ms: number;
  }) => track('auth_oauth_completed', props),
  oauthFailed: (props: { provider: 'google'; reason: string }) => track('oauth_failed', props),

  onboardingStepCompleted: (step: string) => track('onboarding_step_completed', { step }),
  onboardingFinished: () => track('onboarding_finished'),

  swipeCommitted: (props: {
    titleId: string;
    direction: 'left' | 'right' | 'up' | 'down';
    deckPosition: number;
    mood: string | null;
  }) => track('swipe_committed', props),
  swipeSave: (titleId: string) => track('swipe_save', { titleId }),
  swipePass: (titleId: string) => track('swipe_pass', { titleId }),
  swipeUndone: (titleId: string) => track('swipe_undone', { titleId }),
  swipeSyncFailed: (props: { reason: string; queued: number }) => track('swipe_sync_failed', props),

  watchlistAdded: (titleId: string) => track('watchlist_added', { titleId }),
  watchlistRemoved: (titleId: string) => track('watchlist_removed', { titleId }),
  watchlistMarkedWatched: (titleId: string) => track('watchlist_marked_watched', { titleId }),
  watchlistPriorityChanged: (titleId: string, priority: number) =>
    track('watchlist_priority_changed', { titleId, priority }),

  detailViewed: (titleId: string) => track('detail_viewed', { titleId }),
  titleShared: (props: { titleId: string; hasImage: boolean }) => track('title_shared', props),
  detailTrailerMissing: (props: { titleId: string; tmdbId: number; kind: string }) =>
    track('detail_trailer_missing', props),
  trailerOpened: (titleId: string) => track('trailer_opened', { titleId }),
  availabilityOpened: (props: { titleId: string; serviceId: string; offerType: string }) =>
    track('availability_opened', props),

  catalogueFallbackUsed: (props: { reason: string; surface: string }) =>
    track('catalogue_fallback_used', props),
  deckDiagnosticsCaptured: (props: {
    liveCandidateCount: number | null;
    candidateCount: number;
    eligibleCount: number;
    finalCardsCount: number;
    fallbackReason: string | null;
    emptyReason: string | null;
    isFallback: boolean;
    isNarrow: boolean;
    isRelaxed: boolean;
  }) => track('deck_diagnostics_captured', props),

  filterApplied: (props: {
    mood: string | null;
    kinds: string[];
    minYear: number | null;
    maxYear: number | null;
  }) => track('filter_applied', props),

  searchSubmitted: (query: string, resultCount: number) =>
    track('search_query_submitted', { length: query.length, resultCount }),
  searchQuery: (props: { queryLength: number; resultCount: number; isFallback: boolean }) =>
    track('search_query', props),
  searchNoResult: (props: { queryLength: number; isFallback: boolean }) =>
    track('search_no_result', props),
  searchResultOpened: (titleId: string) => track('search_result_opened', { titleId }),

  profileRowTapped: (row: string) => track('profile_row_tapped', { row }),
  settingsDetailOpened: (detail: string) => track('settings_detail_opened', { detail }),
  anonymousUpgradeShown: (props: { surface: string; swipeCount: number }) =>
    track('anonymous_upgrade_shown', props),
  anonymousUpgradeDismissed: (surface: string) => track('anonymous_upgrade_dismissed', { surface }),
  anonymousUpgradeCompleted: (surface: string) => track('anonymous_upgrade_completed', { surface }),

  notificationPermissionRequested: (granted: boolean) =>
    track('notification_permission_requested', { granted }),
  notificationOpened: (props: { category?: string; titleId?: string }) =>
    track('notification_opened', props),
};

export type EventCatalogue = typeof events;
