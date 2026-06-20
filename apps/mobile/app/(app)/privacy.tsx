import { SettingsPage } from '../../src/components/SettingsPage';
import { Text } from '../../src/components/Text';
import { colors, fonts } from '../../src/theme/tokens';

export default function PrivacyPolicy() {
  return (
    <SettingsPage title="Privacy Policy" subtitle="Plain-language launch summary.">
      <Text style={{ color: colors.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 22 }}>
        Flixy uses your account, region, services, genres, watchlist, and swipe history to recommend
        movies and shows. We do not sell your personal data. Analytics are used to understand
        product reliability and improve discovery.
      </Text>
      <Text
        style={{ color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 }}
      >
        For export or deletion requests, contact support@flixy.app until self-serve account deletion
        is available in the app.
      </Text>
    </SettingsPage>
  );
}
