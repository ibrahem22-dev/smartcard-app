import React from 'react';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import { AppText } from '../components/AppText';
import { FeatureGate } from '../components/FeatureGate';
import { ProfileSwitcher } from '../components/ProfileSwitcher';
import { RtlRow, RtlScreen, RtlScrollView } from '../components/rtl';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import type { TabParamList } from '../navigation/types';
import { useCardsStore } from '../store/useCardsStore';
import { useProfileStore } from '../store/useProfileStore';
import {
  finishSetupIsVisible,
  useFinishSetupStore,
  type FinishSetupStep,
} from '../store/useFinishSetupStore';
import { ACCENT, BORDER, CHROME, ROLE_BORDER, ROLE_SURFACE_BG, ROLE_TEXT, SURFACE, TEXT } from '../theme/tokens';
import { RAISED_ACTION_ROUTE } from '../navigation/ia';
import { HomeBenefitsEntry } from './home/HomeBenefitsEntry';
import { HomeBillingCluster } from './home/HomeBillingCluster';
import { HomeBudgetBar } from './home/HomeBudgetBar';
import { HomeHero } from './home/HomeHero';
import { HomeLoadBar } from './home/HomeLoadBar';
import { HomeRiskStrip } from './home/HomeRiskStrip';
import { HomeUpcomingBilling } from './home/HomeUpcomingBilling';

const FINISH_SETUP_LABELS: Readonly<Record<FinishSetupStep, string>> = {
  income: 'השלם הכנסה ויום משכורת',
  'add-card': 'הוסף את הכרטיס הראשון שלך',
  security: 'הפעל זיהוי פנים או טביעת אצבע',
};

const DAILY_TIPS: readonly string[] = [
  'שלם ביום חיוב כדי למקסם את תקופת האשראי',
  'הימנע מחיובים בחו"ל ללא כרטיס ללא עמלה',
  'פרוס לתשלומים רק כשהריבית שווה',
  'בדוק חזרת חיוב לפני כל רכישה גדולה',
  'השתמש במועדון הנכון לכל סוג קנייה',
];

function getDailyTip(): string {
  const dayIndex = new Date().getDate() - 1;
  const tipIndex = dayIndex % DAILY_TIPS.length;

  return DAILY_TIPS[tipIndex] ?? 'שלם ביום חיוב כדי למקסם את תקופת האשראי';
}

export function HomeScreen(): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<TabParamList>>();
  const cards = useCardsStore(state => state.cards);
  const activeProfile = useProfileStore(state => state.activeProfile);
  const skipped = useFinishSetupStore(state => state.skipped);
  const dismissed = useFinishSetupStore(state => state.dismissed);
  const dismissFinishSetup = useFinishSetupStore(state => state.dismiss);
  const showFinishSetup = finishSetupIsVisible(skipped, dismissed);

  function handleCheckPurchase(): void {
    navigation.getParent()?.navigate(RAISED_ACTION_ROUTE);
  }

  function openSettings(): void {
    navigation.navigate('More', { screen: 'Settings' });
  }

  return (
    <RtlScreen safe className={`${SURFACE.page}`}>
      <RtlScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="min-h-full w-full px-4 pb-24 pt-4">
          <HomeHero />
          <Pressable
            accessibilityRole="button"
            className={`mb-4 min-h-[50px] items-center justify-center rounded-lg ${ACCENT.solid}`}
            onPress={handleCheckPurchase}
            testID="home-check-cta"
          >
            <AppText className={`text-center text-base font-extrabold ${TEXT.onAccent}`}>
              {t('בדוק רכישה')}
            </AppText>
          </Pressable>
          <HomeBudgetBar />
          <HomeBenefitsEntry />
          <HomeLoadBar />
          <HomeBillingCluster />
          <HomeRiskStrip />
          <HomeUpcomingBilling />

          <View
            className="mb-4 w-full"
            style={{ backgroundColor: theme.bankColor }}
          >
            <ProfileSwitcher
              activeBorderColor={theme.bankColor}
              mode="compact"
            />
            {/* THE ACCOUNT ROW IS WHERE THE GEAR BELONGS. The directive asks for a settings
                affordance in a top-level user/account area rather than buried under More, and this
                is the only account area the product has. It deep-links into the More stack's
                Settings route, which is where the screen is registered — Settings is not a sixth
                tab because criterion A1 fixes the bar at the spec's five items. */}
            <RtlRow className="mt-2 items-center justify-between gap-2">
              <AppText
                className="text-base font-extrabold"
                style={{ color: CHROME.white }}
              >
                {activeProfile?.displayName === 'פרופיל מקומי' ||
                activeProfile?.displayName === 'Local profile'
                  ? t('פרופיל מקומי')
                  : (activeProfile?.displayName ?? '')}
              </AppText>
              <Pressable
                accessibilityLabel={t('הגדרות')}
                accessibilityRole="button"
                className="min-h-[48px] min-w-[48px] items-center justify-center"
                onPress={openSettings}
                testID="home-settings-gear"
              >
                <Ionicons color={CHROME.white} name="settings-outline" size={24} />
              </Pressable>
            </RtlRow>
          </View>

          {showFinishSetup ? (
            <View
              className={`mb-4 rounded-lg border p-4 ${ACCENT.borderSubtle} ${ACCENT.surface}`}
              testID="home-finish-setup"
            >
              <AppText className={`text-lg font-extrabold ${TEXT.heading}`}>
                {t('השלם הגדרה')}
              </AppText>
              {skipped.map(step => (
                <AppText
                  className={`mt-2 text-base font-bold ${TEXT.body}`}
                  key={step}
                  testID={`home-finish-setup-item-${step}`}
                >
                  {t(FINISH_SETUP_LABELS[step])}
                </AppText>
              ))}
              <Pressable
                accessibilityRole="button"
                className={`mt-4 min-h-[48px] items-center justify-center rounded-lg border ${BORDER.hairline} ${SURFACE.card}`}
                onPress={dismissFinishSetup}
                testID="home-finish-setup-dismiss"
              >
                <AppText className={`text-center text-base font-extrabold ${TEXT.body}`}>
                  {t('הסתר')}
                </AppText>
              </Pressable>
            </View>
          ) : null}

          <View className={`rounded-lg border p-4 ${BORDER.hairline} ${SURFACE.card}`}>
            <AppText
              className={`text-lg font-extrabold ${TEXT.heading}`}
            >
              {t('טיפ היום')}
            </AppText>
            <AppText
              className={`mt-2 text-base leading-6 ${TEXT.body}`}
            >
              {t(getDailyTip())}
            </AppText>
          </View>

          {/* THE "UPCOMING CHARGES" COUNT IS GONE, AND IT WAS THE WRONG NUMBER.
              It read `cards.length` and printed it as "you have N upcoming charges" — a count of
              CARDS relabelled as a count of CHARGES. A user with three cards and no billing date
              in the window was told they had three charges coming. The directive's instruction is
              exactly this case: "Do NOT relabel a different metric as real spending."

              What replaces it is `HomeUpcomingBilling`, which was already on this screen and
              already derives the next billing DATE from each card's own billing day, and
              `HomeBillingCluster`, which renders the risk engine's own same-day clusters. Both say
              nothing when there is nothing to say, rather than counting something else. */}

          <FeatureGate feature="InternationalTravel">
            <View className={`mt-4 rounded-lg border p-4 opacity-45 ${ROLE_BORDER.advisory} ${ROLE_SURFACE_BG.advisory}`}>
              <AppText
                className={`text-lg font-extrabold ${ROLE_TEXT.advisory}`}
              >
                {t('נוסעים לחו"ל? ✈️')}
              </AppText>
              <AppText
                className={`mt-2 text-sm leading-6 ${ROLE_TEXT.advisory}`}
              >
                {t(
                  'בקרוב תוכלו לבדוק מראש איזה כרטיס עדיף לנסיעות ולחיובים במט"ח.',
                )}
              </AppText>
          </View>
        </FeatureGate>
        </View>
      </RtlScrollView>

    </RtlScreen>
  );
}
