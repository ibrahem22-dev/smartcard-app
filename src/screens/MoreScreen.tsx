import React from 'react';
import { Pressable, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScreen, RtlScrollView } from '../components/rtl';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import type { MoreStackParamList } from '../navigation/types';
import { ACCENT, BORDER, SURFACE, TEXT } from '../theme/tokens';

/**
 * MORE — the product's tools, and nothing that is a preference.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT MOVED OUT AND WHY
 *
 * `MoreRoot` used to mount `SettingsScreen`, so this tab WAS the settings screen and the product
 * had one place for two different kinds of thing. The Owner's directive separates them: *"Move
 * SETTINGS-LIKE items out of More. Keep actual features/tools in More."*
 *
 * So language, the profile, the budget target, the data controls and the account name are now in
 * Settings, reached by the gear on Home. What stays here is what a person comes looking for:
 * things to READ (Learn, the glossary), a thing to DO (import existing installments), and a way to
 * reach the issuer.
 *
 * THE INTEREST CALCULATOR IS NOT HERE ANY MORE. It is a fact about one card's rate and it now
 * opens from that card, in Wallet, carrying the card's id.
 *
 * SETTINGS IS STILL REACHABLE FROM HERE. The directive says do not HIDE settings under More; it
 * does not say make it unreachable from a screen a person is already looking at for something
 * else. The gear on Home is the primary entry and this is the second one.
 */

type MoreScreenProps = NativeStackScreenProps<MoreStackParamList, 'MoreRoot'>;

interface MoreEntry {
  readonly testID: string;
  readonly route: 'Settings' | 'Learn' | 'Glossary' | 'InstallmentImport' | 'Contact';
}

const ENTRIES: readonly MoreEntry[] = [
  { testID: 'more-entry-settings', route: 'Settings' },
  { testID: 'more-entry-learn', route: 'Learn' },
  { testID: 'more-entry-glossary', route: 'Glossary' },
  { testID: 'more-entry-installments', route: 'InstallmentImport' },
  { testID: 'more-entry-contact', route: 'Contact' },
];

export function MoreScreen({ navigation }: MoreScreenProps): React.ReactElement {
  const { t } = useTranslation();
  const theme = useTheme();

  /* Each label is a literal `t()` call. A lookup table feeding `t(variable)` would be invisible to
     the i18n coverage suite and would fall back to Hebrew in Arabic and English. */
  const label = (route: MoreEntry['route']): string => {
    switch (route) {
      case 'Settings':
        return t('הגדרות');
      case 'Learn':
        return t('לומדים: מילון, זכויות ואנשי קשר');
      case 'Glossary':
        return t('מילון פיננסי');
      case 'InstallmentImport':
        return t('הוסף תשלומים קיימים');
      case 'Contact':
        return t('צור קשר עם חברת האשראי');
    }
  };

  return (
    <RtlScreen className={SURFACE.page} safe testID="more-screen">
      <RtlScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}>
        <View className="w-full p-4">
          <AppText
            className={`mb-4 text-2xl font-extrabold ${TEXT.heading}`}
            style={{ borderBottomColor: theme.bankColor, borderBottomWidth: 1 }}
          >
            {t('עוד')}
          </AppText>

          {ENTRIES.map((entry) => (
            <Pressable
              accessibilityLabel={label(entry.route)}
              accessibilityRole="button"
              className={`mb-3 min-h-[50px] justify-center rounded-lg border px-4 ${ACCENT.borderSubtle} ${ACCENT.surface}`}
              key={entry.route}
              onPress={(): void => navigation.navigate(entry.route)}
              testID={entry.testID}
            >
              <RtlRow className="items-center justify-between">
                <AppText className={`text-base font-extrabold ${ACCENT.text}`}>
                  {label(entry.route)}
                </AppText>
                <AppText className={`text-xl ${TEXT.secondary}`}>›</AppText>
              </RtlRow>
            </Pressable>
          ))}

          {__DEV__ ? (
            <Pressable
              accessibilityLabel="ENGINE PROBE (dev)"
              accessibilityRole="button"
              className={`mb-3 min-h-[50px] items-center justify-center rounded-lg border px-4 ${BORDER.hairline} ${SURFACE.card}`}
              onPress={(): void => navigation.navigate('EngineProbe')}
              testID="dev-engine-probe-entry"
            >
              <AppText className={`text-center text-base font-extrabold ${TEXT.body}`}>
                ENGINE PROBE (dev)
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </RtlScrollView>
    </RtlScreen>
  );
}
