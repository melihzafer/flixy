const insert = jest.fn();
const updateEq = jest.fn();
const update = jest.fn(() => ({ eq: updateEq }));
const from = jest.fn(() => ({ insert, update }));
const insertSwipe = jest.fn();
const updateSwipe = jest.fn();

jest.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from },
}));

jest.mock('../../../lib/localDb', () => ({
  localDb: { insertSwipe, updateSwipe },
}));

jest.mock('../../../lib/logger', () => ({
  logger: { warn: jest.fn() },
}));

jest.mock('../../telemetry/events', () => ({
  events: { swipeSyncFailed: jest.fn() },
}));

import { syncSwipeEvent, syncSwipeUndo } from '../queue';

const swipe = {
  eventId: '00000000-0000-4000-a000-000000000001',
  userId: '00000000-0000-4000-a000-000000000002',
  titleId: '00000000-0000-4000-a000-000000000003',
  direction: 'right' as const,
  occurredAt: '2026-07-06T10:00:00.000Z',
  sessionId: '00000000-0000-4000-a000-000000000004',
  deckPosition: 2,
  region: 'US',
  filtersSnapshot: { genres: ['drama'] },
};

describe('remote swipe synchronization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    insert.mockResolvedValue({ error: null });
    updateEq.mockResolvedValue({ error: null });
    insertSwipe.mockResolvedValue(undefined);
    updateSwipe.mockResolvedValue(undefined);
  });

  it('writes a queued swipe remotely before recording the local projection', async () => {
    await syncSwipeEvent(swipe);

    expect(from).toHaveBeenCalledWith('swipes');
    expect(insert).toHaveBeenCalledWith({
      event_id: swipe.eventId,
      user_id: swipe.userId,
      title_id: swipe.titleId,
      direction: swipe.direction,
      occurred_at: swipe.occurredAt,
      session_id: swipe.sessionId,
      deck_position: swipe.deckPosition,
      region: swipe.region,
      filters_snapshot: swipe.filtersSnapshot,
    });
    const remoteOrder = insert.mock.invocationCallOrder[0];
    const localOrder = insertSwipe.mock.invocationCallOrder[0];
    expect(remoteOrder).toBeDefined();
    expect(localOrder).toBeDefined();
    expect(remoteOrder ?? Number.POSITIVE_INFINITY).toBeLessThan(
      localOrder ?? Number.NEGATIVE_INFINITY,
    );
  });

  it('treats a duplicate event id as an idempotent success', async () => {
    insert.mockResolvedValue({ error: { code: '23505', message: 'duplicate' } });

    await expect(syncSwipeEvent(swipe)).resolves.toBeUndefined();
    expect(insertSwipe).toHaveBeenCalledTimes(1);
  });

  it('keeps a transiently failed remote swipe out of the local committed history', async () => {
    insert.mockResolvedValue({ error: { code: '503', message: 'unavailable' } });

    await expect(syncSwipeEvent(swipe)).rejects.toMatchObject({ code: '503' });
    expect(insertSwipe).not.toHaveBeenCalled();
  });

  it('synchronizes undo remotely and locally', async () => {
    await syncSwipeUndo(swipe.eventId);

    expect(update).toHaveBeenCalledWith({ is_undone: true });
    expect(updateEq).toHaveBeenCalledWith('event_id', swipe.eventId);
    expect(updateSwipe).toHaveBeenCalledWith(swipe.eventId, { is_undone: true });
  });
});
