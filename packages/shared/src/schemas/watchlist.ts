import { z } from 'zod';

import { UserIdSchema } from './user';

/** Priority bucket for a watchlist row (FSD section 3.7). */
export const WatchlistPrioritySchema = z.enum(['top', 'normal']);
export type WatchlistPriority = z.infer<typeof WatchlistPrioritySchema>;

/** Server row in watchlist_items. */
export const WatchlistItemSchema = z.object({
  id: z.string().uuid(),
  userId: UserIdSchema,
  titleId: z.string().uuid(),
  priority: WatchlistPrioritySchema,
  position: z.number().int(),
  addedAt: z.string(),
  watchedAt: z.string().nullable().optional(),
  removedAt: z.string().nullable().optional(),
});
export type WatchlistItem = z.infer<typeof WatchlistItemSchema>;
