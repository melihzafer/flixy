import { SettingsPage } from '../../src/components/SettingsPage';
import { Text } from '../../src/components/Text';
import { colors, fonts } from '../../src/theme/tokens';

export default function TermsOfService() {
  return (
    <SettingsPage title="Terms of Service" subtitle="Launch summary for Flixy preview users.">
      <Text style={{ color: colors.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 22 }}>
        Flixy helps you discover movies and shows. Catalogue, availability, and trailer data can
        change, so verify final availability with the streaming provider before watching.
      </Text>
      <Text
        style={{ color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 }}
      >
        Do not misuse the service, attempt to scrape private data, or interfere with other users.
        Continued use means you accept these launch terms.
      </Text>
    </SettingsPage>
  );
}
