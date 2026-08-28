import React from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import { AppText } from '../components/AppText';
import { FeatureGate } from '../components/FeatureGate';
import { ProfileSwitcher } from '../components/ProfileSwitcher';
import { RtlScreen, RtlScrollView } from '../components/rtl';
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
import { HomeHero } from './home/HomeHero';
import { HomeLoadBar } from './home/HomeLoadBar';
import { HomeRiskStrip } from './home/HomeRiskStrip';

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
  const upcomingObligationsCount = cards.length;

  function handleCheckPurchase(): void {
    navigation.getParent()?.navigate(RAISED_ACTION_ROUTE);
  }

  return (
    <RtlScreen safe className={`${SURFACE.page}`}>
      <RtlScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="min-h-full w-full px-5 pb-28 pt-5">
          <HomeHero />
          <HomeLoadBar />
          <HomeRiskStrip />

          <View
            className="mb-5 w-full"
            style={{ backgroundColor: theme.bankColor }}
          >
            <ProfileSwitcher
              activeBorderColor={theme.bankColor}
              mode="compact"
            />
            <AppText
              className="mt-2 text-base font-extrabold"
              style={{ color: CHROME.white }}
            >
              {activeProfile?.displayName === 'פרופיל מקומי' ||
              activeProfile?.displayName === 'Local profile'
                ? t('פרופיל מקומי')
                : (activeProfile?.displayName ?? '')}
            </AppText>
          </View>

          {showFinishSetup ? (
            <View
              className={`mb-4 rounded-lg border p-[18px] ${ACCENT.borderSubtle} ${ACCENT.surface}`}
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
                className={`mt-4 min-h-[44px] items-center justify-center rounded-lg border ${BORDER.hairline} ${SURFACE.card}`}
                onPress={dismissFinishSetup}
                testID="home-finish-setup-dismiss"
              >
                <AppText className={`text-center text-base font-extrabold ${TEXT.body}`}>
                  {t('הסתר')}
                </AppText>
              </Pressable>
            </View>
          ) : null}

          <View className={`rounded-lg border p-[18px] ${BORDER.hairline} ${SURFACE.card}`}>
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

          <View className={`mt-4 rounded-lg border p-[18px] ${ACCENT.borderSubtle} ${ACCENT.surface}`}>
            <AppText
              className={`text-lg font-extrabold ${TEXT.heading}`}
            >
              {t('חיובים קרובים')}
            </AppText>
            <AppText
              className={`mt-2 text-base font-bold ${ACCENT.text}`}
            >
              {upcomingObligationsCount === 0
                ? t('אין חיובים קרובים 📅')
                : t('יש {{count}} חיובים קרובים', {
                    count: upcomingObligationsCount,
                  })}
            </AppText>
          </View>

          <FeatureGate feature="InternationalTravel">
            <View className={`mt-4 rounded-lg border p-[18px] opacity-45 ${ROLE_BORDER.advisory} ${ROLE_SURFACE_BG.advisory}`}>
              <AppText
                className={`text-lg font-extrabold ${ROLE_TEXT.advisory}`}
              >
                {t('נוסעים לחו"ל? ✈️')}
              </AppText>
              <AppText
                className={`mt-2 text-[15px] leading-[22px] ${ROLE_TEXT.advisory}`}
              >
                {t(
                  'בקרוב תוכלו לבדוק מראש איזה כרטיס עדיף לנסיעות ולחיובים במט"ח.',
                )}
              </AppText>
          </View>
        </FeatureGate>
        </View>
      </RtlScrollView>

      {/* rtl-ok: full-width footer dock spans both edges intentionally */}
      <View className={`absolute bottom-0 left-0 right-0 border-t p-4 ${BORDER.subtle} ${SURFACE.card}`}>
        <Pressable
          accessibilityRole="button"
          className={`min-h-[50px] items-center justify-center rounded-lg ${ACCENT.solid}`}
          onPress={handleCheckPurchase}
        >
          <AppText className={`text-center text-base font-extrabold ${TEXT.onAccent}`}>
            {t('בדוק רכישה')}
          </AppText>
        </Pressable>
      </View>
    </RtlScreen>
  );
}
