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

  onboardingStepCompleted: (step: string) => track('onboarding_step_completed', { step }),
  onboardingFinished: () => track('onboarding_finished'),

  swipeCommitted: (props: {
    titleId: string;
    direction: 'left' | 'right' | 'up' | 'down';
    deckPosition: number;
    mood: string | null;
  }) => track('swipe_committed', props),
  swipeUndone: (titleId: string) => track('swipe_undone', { titleId }),

  watchlistAdded: (titleId: string) => track('watchlist_added', { titleId }),
  watchlistRemoved: (titleId: string) => track('watchlist_removed', { titleId }),
  watchlistMarkedWatched: (titleId: string) => track('watchlist_marked_watched', { titleId }),
  watchlistPriorityChanged: (titleId: string, priority: number) =>
    track('watchlist_priority_changed', { titleId, priority }),

  detailViewed: (titleId: string) => track('detail_viewed', { titleId }),
  trailerOpened: (titleId: string) => track('trailer_opened', { titleId }),
  availabilityOpened: (props: { titleId: string; serviceId: string; offerType: string }) =>
    track('availability_opened', props),

  filterApplied: (props: {
    mood: string | null;
    kinds: string[];
    minYear: number | null;
    maxYear: number | null;
  }) => track('filter_applied', props),

  searchSubmitted: (query: string, resultCount: number) =>
    track('search_submitted', { length: query.length, resultCount }),
  searchResultOpened: (titleId: string) => track('search_result_opened', { titleId }),

  notificationPermissionRequested: (granted: boolean) =>
    track('notification_permission_requested', { granted }),
  notificationOpened: (props: { category?: string; titleId?: string }) =>
    track('notification_opened', props),
};

export type EventCatalogue = typeof events;
