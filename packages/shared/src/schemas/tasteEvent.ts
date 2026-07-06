import { z } from 'zod';

export const TasteEventTypeSchema = z.enum([
  'open_details',
  'watch_trailer',
  'share',
  'search_match_open',
]);
export type TasteEventType = z.infer<typeof TasteEventTypeSchema>;

export const TasteEventSchema = z.object({
  eventId: z.string(),
  itemId: z.string(),
  itemType: z.enum(['movie', 'tv']),
  genres: z.array(z.string()),
  occurredAt: z.string(),
  eventType: TasteEventTypeSchema,
});
export type TasteEvent = z.infer<typeof TasteEventSchema>;
