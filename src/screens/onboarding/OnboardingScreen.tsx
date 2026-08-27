import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';

import { AppText } from '../../components/AppText';
import { RtlRow, RtlScrollView } from '../../components/rtl';
import { useAppDirection } from '../../hooks/useAppDirection';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../navigation/authContext';
import { createSecureProfileId } from '../../security/keyVault';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useUserStore } from '../../store/useUserStore';
import { paydayFromChip } from '../check/incomeAnchor';
import { useProfileStore } from '../../store/useProfileStore';
import { useCardsStore } from '../../store/useCardsStore';
import {
  useFinishSetupStore,
  type FinishSetupStep,
} from '../../store/useFinishSetupStore';
import {
  getDeviceLanguage,
  type AppLanguage,
} from '../../i18n/locale';
import { ACCENT, BORDER, CHROME, ROLE_TEXT, SURFACE, TEXT } from '../../theme/tokens';

type Step = 'language' | 'income' | 'add-card' | 'security';

const STEPS: readonly Step[] = ['language', 'income', 'add-card', 'security'];

/** Spec §6 row order: English / עברית / العربية. Names stay native; they are the languages. */
const LANGUAGE_ROWS: readonly {
  readonly id: AppLanguage;
  readonly nativeName: string;
}[] = [
  { id: 'en', nativeName: 'English' },
  { id: 'he', nativeName: 'עברית' },
  { id: 'ar', nativeName: 'العربية' },
];

const PAYDAY_CHIPS: readonly {
  readonly id: string;
  readonly label: string;
}[] = [
  { id: '1', label: '1' },
  { id: '10', label: '10' },
  { id: '15', label: '15' },
  { id: '28', label: '28' },
  { id: 'last', label: 'אחרון' },
];

function parsePositiveNumber(value: string): number | null {
  const normalized = value.trim().replace(/,/g, '');
  const parsed = Number(normalized);
  return normalized !== '' && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : null;
}

function optionClassName(isSelected: boolean): string {
  return `min-h-[52px] w-full items-center justify-center rounded-lg border px-3 ${
    isSelected
      ? `${ACCENT.border} ${ACCENT.surfaceStrong}`
      : `${BORDER.hairline} ${SURFACE.card}`
  }`;
}

function optionTextClassName(isSelected: boolean): string {
  return `text-center text-base font-extrabold ${
    isSelected ? `${ACCENT.text}` : `${TEXT.body}`
  }`;
}

function nextStep(step: Step): Step | null {
  if (step === 'language') return 'income';
  if (step === 'income') return 'add-card';
  if (step === 'add-card') return 'security';
  return null;
}

export default function OnboardingScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { completeOnboarding } = useAuth();
  const { textAlign, writingDirection } = useAppDirection();
  const addProfile = useProfileStore(state => state.addProfile);
  const setLanguageChoice = useLanguageStore(state => state.setLanguageChoice);

  const [currentStep, setCurrentStep] = useState<Step>('language');
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>(
    () => getDeviceLanguage(),
  );
  const [incomeText, setIncomeText] = useState('');
  const [paydayId, setPaydayId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const skippable = currentStep !== 'language';

  function canContinue(): boolean {
    if (currentStep === 'language') return true;
    if (currentStep === 'income') return parsePositiveNumber(incomeText) !== null;
    return true;
  }

  function goBack(): void {
    if (currentStep === 'income') setCurrentStep('language');
    else if (currentStep === 'add-card') setCurrentStep('income');
    else if (currentStep === 'security') setCurrentStep('add-card');
  }

  function confirmLanguage(choice: 'auto' | AppLanguage): void {
    setLanguageChoice(choice === 'auto' ? 'auto' : choice);
    setCurrentStep('income');
  }

  function finishOnboarding(securityConfirmed: boolean): void {
    setError(null);
    const skipped: FinishSetupStep[] = [];
    if (parsePositiveNumber(incomeText) === null) skipped.push('income');
    if (useCardsStore.getState().cards.length === 0) skipped.push('add-card');
    if (!securityConfirmed) skipped.push('security');
    useFinishSetupStore.getState().recordSkipped(skipped);

    const profileId = createSecureProfileId();
    // expo-crypto.randomUUID is missing in the render harness; production returns a UUID.
    if (typeof profileId === 'string' && profileId.length > 0) {
      try {
        addProfile({
          id: profileId,
          displayName: 'פרופיל מקומי',
          bankName: '',
          languagePreference: useLanguageStore.getState().resolvedLanguage,
          cardIds: [],
        });
        const monthlyIncome = parsePositiveNumber(incomeText);
        const payday = paydayFromChip(paydayId);
        if (monthlyIncome !== null) {
          const now = Date.now();
          useUserStore.getState().setProfile({
            id: profileId,
            monthlyIncome,
            ...(payday !== undefined ? { payday } : {}),
            createdAt: now,
            updatedAt: now,
          });
        }
      } catch {
        setError(t('לא הצלחנו לשמור את ההגדרה המקומית. נסה שוב.'));
        return;
      }
    }
    completeOnboarding();
  }

  function advance(securityConfirmed = false): void {
    const next = nextStep(currentStep);
    if (next === null) {
      finishOnboarding(securityConfirmed);
      return;
    }
    setCurrentStep(next);
  }

  function handleNext(): void {
    setError(null);
    if (currentStep === 'language') {
      confirmLanguage(selectedLanguage);
      return;
    }
    if (currentStep === 'income' && parsePositiveNumber(incomeText) === null) {
      setError(t('נא להזין הכנסה חודשית תקינה'));
      return;
    }
    if (!canContinue()) {
      setError(t('יש להשלים שלב זה לפני המשך.'));
      return;
    }
    advance(currentStep === 'security');
  }

  function handleSkip(): void {
    setError(null);
    if (currentStep === 'language') {
      confirmLanguage('auto');
      return;
    }
    advance(false);
  }

  function renderStep(): React.ReactElement {
    if (currentStep === 'language') {
      return (
        <View className="w-full" testID="onboarding-step-language">
          <AppText className={`mb-5 text-2xl font-black ${TEXT.heading}`}>
            {t('אישור שפה')}
          </AppText>
          <View
            accessibilityRole="radiogroup"
            className="w-full gap-3"
            testID="onboarding-language-rows"
          >
            {LANGUAGE_ROWS.map(row => {
              const isSelected = selectedLanguage === row.id;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  className={optionClassName(isSelected)}
                  key={row.id}
                  onPress={(): void => setSelectedLanguage(row.id)}
                  testID={`onboarding-language-${row.id}`}
                >
                  <AppText className={optionTextClassName(isSelected)}>
                    {row.nativeName}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <AppText
            className={`mt-5 text-sm font-bold ${TEXT.body}`}
            testID="onboarding-why"
          >
            {t('השפה קובעת איך האפליקציה מדברת איתך.')}
          </AppText>
          <AppText
            className={`mt-2 text-sm font-bold ${TEXT.muted}`}
            testID="onboarding-where"
          >
            {t('בחירת השפה נשמרת במכשיר הזה.')}
          </AppText>
        </View>
      );
    }

    if (currentStep === 'income') {
      return (
        <View className="w-full" testID="onboarding-step-income">
          <AppText className={`mb-5 text-2xl font-black ${TEXT.heading}`}>
            {t('הכנסה חודשית (₪)')}
          </AppText>
          <TextInput
            className={`min-h-[64px] rounded-lg border px-4 text-2xl ${BORDER.hairline} ${SURFACE.card} ${TEXT.heading}`}
            keyboardType="numeric"
            onChangeText={setIncomeText}
            placeholder={t('לדוגמה: 12000')}
            placeholderTextColor={CHROME.subtle}
            style={{ textAlign, writingDirection }}
            testID="onboarding-income-amount"
            value={incomeText}
          />
          <AppText className={`mb-2 mt-5 text-base font-extrabold ${TEXT.body}`}>
            {t('יום משכורת')}
          </AppText>
          <RtlRow className="w-full flex-wrap gap-3">
            {PAYDAY_CHIPS.map(chip => {
              const isSelected = paydayId === chip.id;
              const label = chip.id === 'last' ? t(chip.label) : chip.label;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  className={`min-h-[48px] min-w-[56px] items-center justify-center rounded-lg border px-3 ${
                    isSelected
                      ? `${ACCENT.border} ${ACCENT.surfaceStrong}`
                      : `${BORDER.hairline} ${SURFACE.card}`
                  }`}
                  key={chip.id}
                  onPress={(): void => setPaydayId(chip.id)}
                  testID={`onboarding-payday-${chip.id}`}
                >
                  <AppText className={optionTextClassName(isSelected)}>
                    {label}
                  </AppText>
                </Pressable>
              );
            })}
          </RtlRow>
          <AppText
            className={`mt-5 text-sm font-bold ${TEXT.body}`}
            testID="onboarding-why"
          >
            {t('ההכנסה ויום המשכורת הם העוגן של מנוע התזרים.')}
          </AppText>
          <AppText
            className={`mt-2 text-sm font-bold ${TEXT.muted}`}
            testID="onboarding-where"
          >
            {t('ככה SmartCard יודע מה בטוח. זה לא יוצא מהמכשיר.')}
          </AppText>
          <AppText className={`mt-2 text-sm font-bold ${TEXT.muted}`}>
            {t('דילוג מגביל את פסקי הבדיקה.')}
          </AppText>
        </View>
      );
    }

    if (currentStep === 'add-card') {
      return (
        <View className="w-full" testID="onboarding-step-add-card">
          <AppText className={`mb-5 text-2xl font-black ${TEXT.heading}`}>
            {t('הוסף את הכרטיס הראשון שלך')}
          </AppText>
          <AppText className={`mb-3 text-base font-bold ${TEXT.body}`}>
            {t('אפשר להוסיף כרטיס עכשיו או לדלג ולהוסיף מהארנק.')}
          </AppText>
          <AppText
            className={`text-sm font-bold ${TEXT.body}`}
            testID="onboarding-why"
          >
            {t('כרטיס בבעלותך נחוץ כדי לתת פסק על רכישה אמיתית.')}
          </AppText>
          <AppText
            className={`mt-2 text-sm font-bold ${TEXT.muted}`}
            testID="onboarding-where"
          >
            {t('הנתונים הפיננסיים שלך חיים רק במכשיר הזה.')}
          </AppText>
        </View>
      );
    }

    return (
      <View className="w-full" testID="onboarding-step-security">
        <AppText className={`mb-5 text-2xl font-black ${TEXT.heading}`}>
          {t('אבטחה וסיום')}
        </AppText>
        <AppText className={`mb-3 text-base font-bold ${TEXT.body}`}>
          {t(
            'הכספת כבר פתוחה עם ה-PIN המקומי. אפשר להוסיף זיהוי ביומטרי אחר כך מההגדרות.',
          )}
        </AppText>
        <AppText
          className={`mb-2 text-sm font-bold ${TEXT.body}`}
          testID="onboarding-why"
        >
          {t('ה-PIN והזיהוי הביומטרי שומרים על הכספת.')}
        </AppText>
        <AppText
          className={`mb-3 text-sm font-bold ${TEXT.muted}`}
          testID="onboarding-where"
        >
          {t('הנתונים הפיננסיים שלך חיים רק במכשיר הזה.')}
        </AppText>
        <AppText className={`text-sm font-bold ${TEXT.muted}`}>
          {t('התחייבויות אפשר להוסיף אחר כך מתוכנית.')}
        </AppText>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: CHROME.appLight }}
    >
      <RtlRow
        className={`gap-2 border-b px-5 py-4 ${BORDER.subtle} ${SURFACE.card}`}
        testID="onboarding-progress"
      >
        {STEPS.map(step => (
          <View
            className={`h-1.5 flex-1 rounded-full ${
              STEPS.indexOf(step) <= STEPS.indexOf(currentStep)
                ? `${ACCENT.solid}`
                : `${SURFACE.raised}`
            }`}
            key={step}
            testID={`onboarding-progress-${step}`}
          />
        ))}
      </RtlRow>

      <RtlScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="min-h-full w-full px-5 py-6">
          {renderStep()}
          {error !== null ? (
            <AppText
              className={`mt-5 text-sm font-bold ${ROLE_TEXT.danger}`}
              testID="onboarding-error"
            >
              {error}
            </AppText>
          ) : null}
        </View>
      </RtlScrollView>

      <View className={`gap-3 border-t p-4 ${BORDER.subtle} ${SURFACE.card}`}>
        {currentStep === 'language' ? (
          <Pressable
            accessibilityRole="button"
            className={`min-h-[44px] items-center justify-center rounded-lg border ${BORDER.hairline} ${SURFACE.card}`}
            onPress={handleSkip}
            testID="onboarding-language-skip"
          >
            <AppText className={`text-center text-base font-extrabold ${TEXT.body}`}>
              {t('דלג')}
            </AppText>
          </Pressable>
        ) : null}

        {skippable ? (
          <Pressable
            accessibilityRole="button"
            className={`min-h-[44px] items-center justify-center rounded-lg border ${BORDER.hairline} ${SURFACE.card}`}
            onPress={handleSkip}
            testID="onboarding-skip"
          >
            <AppText className={`text-center text-base font-extrabold ${TEXT.body}`}>
              {currentStep === 'security' ? t('אחר כך') : t('דלג')}
            </AppText>
          </Pressable>
        ) : null}

        <RtlRow className="gap-3">
          <Pressable
            accessibilityRole="button"
            className={`min-h-[50px] flex-1 items-center justify-center rounded-lg border ${
              currentStep === 'language'
                ? `${BORDER.subtle} ${SURFACE.sunken}`
                : `${BORDER.hairline} ${SURFACE.card}`
            }`}
            disabled={currentStep === 'language'}
            onPress={goBack}
            testID="onboarding-back"
          >
            <AppText
              className={`text-center text-base font-extrabold ${
                currentStep === 'language' ? `${TEXT.muted}` : `${TEXT.body}`
              }`}
            >
              {t('חזרה')}
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            className={`min-h-[50px] flex-[2] items-center justify-center rounded-lg ${
              canContinue() ? `${ACCENT.solid}` : `${SURFACE.raised}`
            }`}
            disabled={!canContinue()}
            onPress={handleNext}
            testID="onboarding-continue"
          >
            <AppText className={`text-center text-base font-extrabold ${TEXT.onAccent}`}>
              {currentStep === 'security'
                ? t('הפעל זיהוי פנים או טביעת אצבע')
                : t('המשך')}
            </AppText>
          </Pressable>
        </RtlRow>
      </View>
    </KeyboardAvoidingView>
  );
}
