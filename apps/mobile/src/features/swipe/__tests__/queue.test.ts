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

import { SwipeEventSchema } from '@flixy/shared';

import { isPermanentSwipeSyncError, syncSwipeEvent, syncSwipeUndo } from '../queue';

const swipe = {
  eventId: '00000000-0000-4000-a000-000000000001',
  userId: '00000000-0000-4000-a000-000000000002',
  titleId: '00000000-0000-4000-a000-000000000003',
  direction: 'right' as const,
  occurredAt: '2026-07-06T10:00:00.000Z',
  sessionId: '00000000-0000-4000-a000-000000000004',
  discoverySessionId: '00000000-0000-4000-a000-000000000005',
  deckPosition: 2,
  region: 'US',
  filtersSnapshot: { genres: ['drama'] },
  genres: ['drama'],
  titleSnapshot: { genres: ['drama'], language: 'en', kind: 'movie' as const },
};

describe('remote swipe synchronization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    insert.mockResolvedValue({ error: null });
    updateEq.mockResolvedValue({ error: null });
    insertSwipe.mockResolvedValue(undefined);
    updateSwipe.mockResolvedValue(undefined);
  });

  it('records the local projection before it synchronizes remotely', async () => {
    await syncSwipeEvent(swipe);

    expect(from).toHaveBeenCalledWith('swipes');
    expect(insertSwipe).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: swipe.eventId,
        user_id: swipe.userId,
        title_id: swipe.titleId,
        direction: swipe.direction,
        genres: ['drama'],
        title_snapshot: swipe.titleSnapshot,
      }),
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: swipe.discoverySessionId,
        title_snapshot: swipe.titleSnapshot,
      }),
    );
    const localOrder = insertSwipe.mock.invocationCallOrder[0];
    const remoteOrder = insert.mock.invocationCallOrder[0];
    expect(localOrder).toBeDefined();
    expect(remoteOrder).toBeDefined();
    expect(localOrder ?? Number.POSITIVE_INFINITY).toBeLessThan(
      remoteOrder ?? Number.NEGATIVE_INFINITY,
    );
  });

  it('syncs the discovery session id — never the app-launch session id — to swipes.session_id', async () => {
    await syncSwipeEvent(swipe);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: swipe.discoverySessionId }),
    );

    insert.mockClear();
    await syncSwipeEvent({
      ...swipe,
      eventId: '00000000-0000-4000-a000-00000000000a',
      discoverySessionId: null,
    });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ session_id: null }));

    insert.mockClear();
    const { discoverySessionId: _omitted, ...legacyEvent } = swipe;
    await syncSwipeEvent({ ...legacyEvent, eventId: '00000000-0000-4000-a000-00000000000b' });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ session_id: null }));
  });

  it('treats a duplicate event id as an idempotent success', async () => {
    insert.mockResolvedValue({ error: { code: '23505', message: 'duplicate' } });

    await expect(syncSwipeEvent(swipe)).resolves.toBeUndefined();
    expect(insertSwipe).toHaveBeenCalledTimes(1);
  });

  it('keeps the local record and resolves on permanently rejected rows (no queue wedge)', async () => {
    // FK violation (e.g. session_id not in discovery_sessions) can never
    // succeed on retry. It used to throw, which blocked the FIFO queue head
    // forever: no later swipe synced OR reached localDb, so passed titles
    // kept reappearing in the deck.
    insert.mockResolvedValue({ error: { code: '23503', message: 'fk violation' } });

    await expect(syncSwipeEvent(swipe)).resolves.toBeUndefined();
    expect(insertSwipe).toHaveBeenCalledTimes(1);
  });

  it('keeps a transiently failed remote swipe in the local history for retry', async () => {
    insert.mockResolvedValue({ error: { code: '503', message: 'unavailable' } });

    await expect(syncSwipeEvent(swipe)).rejects.toMatchObject({ code: '503' });
    expect(insertSwipe).toHaveBeenCalledTimes(1);
  });

  it('classifies permanent vs transient sync errors', () => {
    for (const code of ['23502', '23503', '23514', '22P02', '42501', '42703']) {
      expect(isPermanentSwipeSyncError({ code })).toBe(true);
    }
    for (const value of [{ code: '503' }, { code: '23505' }, {}, null, 'oops']) {
      expect(isPermanentSwipeSyncError(value)).toBe(false);
    }
  });

  it('keeps genres and discoverySessionId through queue hydration (schema round-trip)', () => {
    const parsed = SwipeEventSchema.safeParse(swipe);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.genres).toEqual(['drama']);
      expect(parsed.data.titleSnapshot).toEqual(swipe.titleSnapshot);
      expect(parsed.data.discoverySessionId).toBe(swipe.discoverySessionId);
    }
  });

  it('synchronizes undo remotely and locally', async () => {
    await syncSwipeUndo(swipe.eventId);

    expect(update).toHaveBeenCalledWith({ is_undone: true });
    expect(updateEq).toHaveBeenCalledWith('event_id', swipe.eventId);
    expect(updateSwipe).toHaveBeenCalledWith(swipe.eventId, { is_undone: true });
  });
});
