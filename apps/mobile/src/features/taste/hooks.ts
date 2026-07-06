import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { TasteEventType, Title } from '@flixy/shared';

import { localDb } from '../../lib/localDb';
import { useSession } from '../auth/useSession';

export function useRecordTasteEvent() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user?.id ?? null;

  return useCallback(
    async (eventType: TasteEventType, title: Title): Promise<void> => {
      if (!userId) return;
      const recorded = await localDb.recordTasteEvent({
        userId,
        itemId: title.id,
        itemType: title.kind,
        genres: title.genres,
        eventType,
      });
      if (recorded) {
        await queryClient.invalidateQueries({ queryKey: ['taste_signal', userId] });
      }
    },
    [queryClient, userId],
  );
}
