import { useTranslation } from 'react-i18next';

import { SettingsRow } from '../../src/components/ListRow';
import { SettingsPage } from '../../src/components/SettingsPage';

export default function SettingsHelp() {
  const { t } = useTranslation();
  return (
    <SettingsPage
      title={t('settingsPages.help.title', 'Help & support')}
      subtitle={t('settingsPages.help.subtitle', 'Fast answers for the current launch build.')}
    >
      <SettingsRow
        label={t('settingsPages.help.recs', 'How recommendations work')}
        value={t('settingsPages.help.recsValue', 'Swipe signal')}
        subtitle={t(
          'settingsPages.help.recsSub',
          'Pass, save, top, and seen actions tune the next deck.',
        )}
      />
      <SettingsRow
        label={t('settingsPages.help.catalogue', 'Catalogue issues')}
        value={t('settingsPages.help.catalogueValue', 'Report')}
        subtitle={t(
          'settingsPages.help.catalogueSub',
          'If a title is missing or wrong, send the title name and region to support.',
        )}
      />
      <SettingsRow
        label={t('settingsPages.help.support', 'Support')}
        value="support@flixy.app"
        valueNumberOfLines={1}
      />
    </SettingsPage>
  );
}
