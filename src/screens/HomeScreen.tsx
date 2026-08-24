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
import { ACCENT, BORDER, CHROME, ROLE_BORDER, ROLE_SURFACE_BG, ROLE_TEXT, SURFACE, TEXT } from '../theme/tokens';
import { RAISED_ACTION_ROUTE } from '../navigation/ia';

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
