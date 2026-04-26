import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';

import { Screen } from '../../../src/components/Screen';
import { useTitle } from '../../../src/features/catalogue/hooks';

/**
 * Detail view stub (FSD section 3.8). Full hero + trailer + cast + ratings
 * lands in Phase 3.5; this stub exists so the deck can deep-link without a
 * broken route under typed-routes.
 */
export default function TitleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: title, isLoading } = useTitle(id ?? null);
  if (isLoading)
    return (
      <Screen title="Loading\u2026">
        <Text style={{ color: 'white' }} />
      </Screen>
    );
  if (!title)
    return (
      <Screen title="Not found">
        <Text style={{ color: 'white' }} />
      </Screen>
    );
  return (
    <Screen title={title.title}>
      <Text style={{ color: '#A1A1AA', marginBottom: 8 }}>
        {[title.releaseYear, title.runtimeMinutes ? `${title.runtimeMinutes}m` : null]
          .filter(Boolean)
          .join(' • ')}
      </Text>
      <Text style={{ color: 'white' }}>{title.overview ?? ''}</Text>
    </Screen>
  );
}
