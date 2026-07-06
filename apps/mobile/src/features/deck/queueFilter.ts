import type { DeckCard } from '@flixy/shared';

/**
 * Live filter for the deck screen's append-only card queue.
 *
 * The queue deliberately never re-orders or drops cards on recomposition
 * (deck stability invariant), which means it also can't self-heal when a
 * queued title becomes hard-excluded mid-session — e.g. the user saves it to
 * the watchlist from search or the title-detail screen. This filter closes
 * that gap at render time:
 *
 * - `swipedIds` — titles swiped in this deck session; always hidden.
 * - `excludeIds` — the live hard-exclusion set (all swiped + watchlist ids).
 * - `touchedIds` — every title swiped this session, INCLUDING undone ones.
 *   Exclusions are skipped for touched titles so an Undo brings the card back
 *   instantly instead of waiting for the exclusion query's refetch to settle.
 */
export function filterRemainingCards(
  queuedCards: readonly DeckCard[],
  swipedIds: ReadonlySet<string>,
  excludeIds: ReadonlySet<string>,
  touchedIds: ReadonlySet<string>,
): DeckCard[] {
  return queuedCards.filter((card) => {
    const id = card.title.id;
    if (swipedIds.has(id)) return false;
    if (excludeIds.has(id) && !touchedIds.has(id)) return false;
    return true;
  });
}
