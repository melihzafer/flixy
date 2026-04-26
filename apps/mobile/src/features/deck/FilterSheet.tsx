import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { type MoodPreset, MoodPresetSchema } from '@flixy/shared';

import { Button } from '../../components/Button';
import { Chip, ChipGroup } from '../../components/Chip';
import { SectionLabel } from '../../components/SectionLabel';
import { Text } from '../../components/Text';
import { colors, fonts } from '../../theme/tokens';
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
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }}
        accessibilityLabel={t('common.back')}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.surface,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          padding: 24,
          paddingTop: 16,
          maxHeight: '80%',
          borderTopWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View
          style={{
            alignSelf: 'center',
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border2,
            marginBottom: 20,
          }}
        />
        <Text
          style={{
            color: colors.text,
            fontFamily: fonts.display,
            fontSize: 28,
            marginBottom: 20,
          }}
        >
          {t('filters.title', 'Filters')}
        </Text>

        <ScrollView
          contentContainerStyle={{ gap: 22, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: 10 }}>
            <SectionLabel>{t('filters.mood', 'Mood')}</SectionLabel>
            <ChipGroup>
              <Chip
                label={t('filters.moodAny', 'Any')}
                selected={!mood}
                onPress={() => setMood(null)}
              />
              {MOODS.map((m) => (
                <Chip
                  key={m}
                  label={t(`filters.moods.${m}`, m)}
                  selected={mood === m}
                  onPress={() => setMood(m)}
                />
              ))}
            </ChipGroup>
          </View>

          <View style={{ gap: 10 }}>
            <SectionLabel>{t('filters.kind', 'Type')}</SectionLabel>
            <ChipGroup>
              <Chip
                label={t('filters.kinds.movie', 'Movies')}
                selected={kinds.includes('movie')}
                onPress={() => toggleKind('movie')}
              />
              <Chip
                label={t('filters.kinds.tv', 'Series')}
                selected={kinds.includes('tv')}
                onPress={() => toggleKind('tv')}
              />
            </ChipGroup>
          </View>

          <View style={{ gap: 10 }}>
            <SectionLabel>{t('filters.years', 'Years')}</SectionLabel>
            <ChipGroup>
              <Chip
                label={t('filters.allYears', 'All')}
                selected={minYear == null && maxYear == null}
                onPress={() => setYears(null, null)}
              />
              <Chip
                label={t('filters.lastYears', 'Last 10y')}
                selected={minYear === new Date().getFullYear() - 10}
                onPress={() => setYears(new Date().getFullYear() - 10, null)}
              />
              <Chip
                label={t('filters.classics', 'Pre-2000')}
                selected={maxYear === 1999}
                onPress={() => setYears(null, 1999)}
              />
            </ChipGroup>
          </View>
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Button label={t('filters.reset', 'Reset')} variant="ghost" onPress={reset} />
          </View>
          <View style={{ flex: 2 }}>
            <Button
              label={t('filters.apply', 'Apply')}
              onPress={() => {
                events.filterApplied({ mood, kinds, minYear, maxYear });
                onClose();
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
