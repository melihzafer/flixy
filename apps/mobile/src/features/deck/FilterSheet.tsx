import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { type MoodPreset, MoodPresetSchema } from '@flixy/shared';

import { events } from '../telemetry/events';
import { useDeckFilters } from './filterStore';

const MOODS: MoodPreset[] = MoodPresetSchema.options;

export function FilterSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { mood, kinds, minYear, maxYear, setMood, toggleKind, setYears, reset } = useDeckFilters();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
        accessibilityLabel={t('common.back')}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#0B0B0F',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: 20,
          maxHeight: '75%',
        }}
      >
        <View
          style={{
            alignSelf: 'center',
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: '#3F3F46',
            marginBottom: 16,
          }}
        />
        <Text style={{ color: 'white', fontSize: 22, fontWeight: '700', marginBottom: 16 }}>
          {t('filters.title', 'Filters')}
        </Text>

        <ScrollView contentContainerStyle={{ gap: 20, paddingBottom: 32 }}>
          <Section label={t('filters.mood', 'Mood')}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Chip
                label={t('filters.moodAny', 'Any')}
                active={!mood}
                onPress={() => setMood(null)}
              />
              {MOODS.map((m) => (
                <Chip
                  key={m}
                  label={t(`filters.moods.${m}`, m)}
                  active={mood === m}
                  onPress={() => setMood(m)}
                />
              ))}
            </View>
          </Section>

          <Section label={t('filters.kind', 'Type')}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip
                label={t('filters.kinds.movie', 'Movies')}
                active={kinds.includes('movie')}
                onPress={() => toggleKind('movie')}
              />
              <Chip
                label={t('filters.kinds.tv', 'Series')}
                active={kinds.includes('tv')}
                onPress={() => toggleKind('tv')}
              />
            </View>
          </Section>

          <Section label={t('filters.years', 'Years')}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip
                label={t('filters.allYears', 'All')}
                active={minYear == null && maxYear == null}
                onPress={() => setYears(null, null)}
              />
              <Chip
                label={t('filters.lastYears', 'Last 10y')}
                active={minYear === new Date().getFullYear() - 10}
                onPress={() => setYears(new Date().getFullYear() - 10, null)}
              />
              <Chip
                label={t('filters.classics', 'Pre-2000')}
                active={maxYear === 1999}
                onPress={() => setYears(null, 1999)}
              />
            </View>
          </Section>
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <Pressable
            onPress={reset}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 12,
              backgroundColor: '#15151B',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#A1A1AA', fontWeight: '600' }}>
              {t('filters.reset', 'Reset')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              events.filterApplied({ mood, kinds, minYear, maxYear });
              onClose();
            }}
            style={{
              flex: 2,
              padding: 14,
              borderRadius: 12,
              backgroundColor: '#fff',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#0B0B0F', fontWeight: '700' }}>
              {t('filters.apply', 'Apply')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={{ color: '#A1A1AA', marginBottom: 8, fontWeight: '600' }}>{label}</Text>
      {children}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? '#fff' : '#15151B',
      }}
    >
      <Text style={{ color: active ? '#0B0B0F' : '#A1A1AA', fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
