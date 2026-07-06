import { z } from 'zod';

import { UserIdSchema } from './user';

export const SwipeDirectionSchema = z.enum(['left', 'right', 'up', 'down']);
export type SwipeDirection = z.infer<typeof SwipeDirectionSchema>;

/**
 * Client-emitted swipe event. The `eventId` is a client UUID used for
 * idempotency (FSD section 3.6.3): re-delivery of the same id is a no-op.
 */
export const SwipeEventSchema = z.object({
  eventId: z.string().uuid(),
  userId: UserIdSchema,
  titleId: z.string().uuid(),
  direction: SwipeDirectionSchema,
  occurredAt: z.string(),
  sessionId: z.string().uuid(),
  /**
   * Server-created discovery session id, when the swipe happened inside one
   * (deck swipes). Swipes from other surfaces (title detail, search) carry
   * null. This — never the app-launch `sessionId` — is what syncs to
   * `swipes.session_id`, which has an FK to `discovery_sessions`.
   */
  discoverySessionId: z.string().uuid().nullable().optional(),
  deckPosition: z.number().int().nonnegative(),
  region: z.string().length(2),
  filtersSnapshot: z.record(z.unknown()).default({}),
  /** Title genres at swipe time; feeds the local taste signal. Must survive queue hydration. */
  genres: z.array(z.string()).optional(),
});
export type SwipeEvent = z.infer<typeof SwipeEventSchema>;

/**
 * Aggregated taste signal derived from prior swipes. Used by the deck composer
 * to score candidates. Built by `buildTasteSignal` (see ../taste.ts): values
 * are weighted, time-decayed sums — up/right/down contribute positively
 * (Top Pick > Save > Seen), left contributes negatively.
 */
export const TasteSignalSchema = z.object({
  positiveGenres: z.record(z.number()),
  negativeGenres: z.record(z.number()),
  totalSwipes: z.number().int().nonnegative(),
});
export type TasteSignal = z.infer<typeof TasteSignalSchema>;
