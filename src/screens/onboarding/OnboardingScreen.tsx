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
import { useProfileStore } from '../../store/useProfileStore';
import { useUserStore } from '../../store/useUserStore';
import { CardIssuer } from '../../types/card.types';
import type { AppProfile } from '../../types/profile.types';
import type { UserProfile } from '../../types/user.types';

type Step = 1 | 2 | 3 | 4;

const STEPS: readonly Step[] = [1, 2, 3, 4];

/** Stored bank values stay English identifiers; labels are localized. */
const BANK_OPTIONS: readonly {
  readonly value: string;
  readonly labelKey: string;
}[] = [
  { value: 'Leumi', labelKey: 'לאומי' },
  { value: 'Hapoalim', labelKey: 'הפועלים' },
  { value: 'Discount', labelKey: 'דיסקונט' },
  { value: 'Mizrahi', labelKey: 'מזרחי' },
  { value: 'Other', labelKey: 'אחר' },
];

const ISSUER_OPTIONS: readonly CardIssuer[] = [
  CardIssuer.Max,
  CardIssuer.Isracard,
  CardIssuer.Cal,
];

function parsePositiveNumber(value: string): number | null {
  const normalized = value.trim().replace(/,/g, '');
  const parsed = Number(normalized);
  return normalized !== '' && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : null;
}

function optionClassName(isSelected: boolean): string {
  return `min-h-[52px] flex-1 basis-[45%] items-center justify-center rounded-lg border px-3 ${
    isSelected
      ? 'border-blue-600 bg-blue-100 dark:border-blue-400 dark:bg-blue-950'
      : 'border-slate-300 bg-white dark:border-neutral-700 dark:bg-neutral-900'
  }`;
}

function optionTextClassName(isSelected: boolean): string {
  return `text-center text-base font-extrabold ${
    isSelected
      ? 'text-blue-700 dark:text-blue-200'
      : 'text-slate-700 dark:text-slate-200'
  }`;
}

export default function OnboardingScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { completeOnboarding } = useAuth();
  const { textAlign, writingDirection } = useAppDirection();
  const addProfile = useProfileStore(state => state.addProfile);
  const setProfile = useUserStore(state => state.setProfile);

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [incomeText, setIncomeText] = useState('');
  const [balanceText, setBalanceText] = useState('');
  const [selectedIssuer, setSelectedIssuer] = useState<CardIssuer | null>(null);
  const [clubText, setClubText] = useState('');
  const [phoneText, setPhoneText] = useState('');
  const [error, setError] = useState<string | null>(null);

  function canContinue(): boolean {
    if (currentStep === 1) return selectedBank !== null;
    if (currentStep === 2) {
      return (
        parsePositiveNumber(incomeText) !== null &&
        parsePositiveNumber(balanceText) !== null
      );
    }
    if (currentStep === 3) return selectedIssuer !== null;
    return true;
  }

  function goBack(): void {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
    }
  }

  function saveLocalOnboarding(): void {
    const monthlyIncome = parsePositiveNumber(incomeText);
    const currentBalance = parsePositiveNumber(balanceText);

    if (
      selectedBank === null ||
      selectedIssuer === null ||
      monthlyIncome === null ||
      currentBalance === null
    ) {
      setError(t('יש להשלים את שדות ההגדרה המקומית לפני המשך.'));
      return;
    }

    try {
      const profileId = createSecureProfileId();
      const now = Date.now();
      const appProfile: AppProfile = {
        id: profileId,
        // Store the Hebrew i18n key; callers render via t().
        displayName: 'פרופיל מקומי',
        bankName: selectedBank,
        languagePreference: 'he',
        cardIds: [],
      };
      const userProfile: UserProfile = {
        id: profileId,
        bankName: selectedBank,
        ...(phoneText.trim() === '' ? {} : { phoneNumber: phoneText.trim() }),
        monthlyIncome,
        currentBalance,
        createdAt: now,
        updatedAt: now,
      };

      addProfile(appProfile);
      setProfile(userProfile);
      completeOnboarding();
    } catch {
      setError(t('לא הצלחנו לשמור את ההגדרה המקומית. נסה שוב.'));
    }
  }

  function handleNext(): void {
    setError(null);
    if (!canContinue()) {
      if (currentStep === 2) {
        if (parsePositiveNumber(incomeText) === null) {
          setError(t('נא להזין הכנסה חודשית תקינה'));
          return;
        }
        if (parsePositiveNumber(balanceText) === null) {
          setError(t('נא להזין יתרה תקינה'));
          return;
        }
      }
      setError(t('יש להשלים שלב זה לפני המשך.'));
      return;
    }
    if (currentStep === 4) {
      saveLocalOnboarding();
      return;
    }
    setCurrentStep((currentStep + 1) as Step);
  }

  function renderStep(): React.ReactElement {
    if (currentStep === 1) {
      return (
        <View className="w-full">
          <AppText className="mb-5 text-2xl font-black text-slate-900 dark:text-white">
            {t('באיזה בנק אתה מנהל את החשבון?')}
          </AppText>
          <RtlRow className="w-full flex-wrap gap-3">
            {BANK_OPTIONS.map(bank => {
              const isSelected = selectedBank === bank.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  className={optionClassName(isSelected)}
                  key={bank.value}
                  onPress={(): void => setSelectedBank(bank.value)}
                >
                  <AppText className={optionTextClassName(isSelected)}>
                    {t(bank.labelKey)}
                  </AppText>
                </Pressable>
              );
            })}
          </RtlRow>
        </View>
      );
    }

    if (currentStep === 2) {
      return (
        <View className="w-full">
          <AppText className="mb-5 text-2xl font-black text-slate-900 dark:text-white">
            {t('פרטים פיננסיים')}
          </AppText>
          <AppText className="mb-2 text-base font-extrabold text-slate-700 dark:text-slate-200">
            {t('הכנסה חודשית (₪)')}
          </AppText>
          <TextInput
            className="min-h-[52px] rounded-lg border border-slate-300 bg-white px-4 text-lg text-slate-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            keyboardType="numeric"
            onChangeText={setIncomeText}
            placeholder={t('לדוגמה: 12000')}
            placeholderTextColor="#94A3B8"
            style={{ textAlign, writingDirection }}
            value={incomeText}
          />
          <AppText className="mb-2 mt-5 text-base font-extrabold text-slate-700 dark:text-slate-200">
            {t('יתרה נוכחית (₪)')}
          </AppText>
          <TextInput
            className="min-h-[52px] rounded-lg border border-slate-300 bg-white px-4 text-lg text-slate-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            keyboardType="numeric"
            onChangeText={setBalanceText}
            placeholder={t('לדוגמה: 3500')}
            placeholderTextColor="#94A3B8"
            style={{ textAlign, writingDirection }}
            value={balanceText}
          />
        </View>
      );
    }

    if (currentStep === 3) {
      return (
        <View className="w-full">
          <AppText className="mb-5 text-2xl font-black text-slate-900 dark:text-white">
            {t('הוסף את הכרטיס הראשון שלך')}
          </AppText>
          <AppText className="mb-2 text-base font-extrabold text-slate-700 dark:text-slate-200">
            {t('חברת כרטיס האשראי')}
          </AppText>
          <RtlRow className="w-full flex-wrap gap-3">
            {ISSUER_OPTIONS.map(issuer => {
              const isSelected = selectedIssuer === issuer;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  className={optionClassName(isSelected)}
                  key={issuer}
                  onPress={(): void => setSelectedIssuer(issuer)}
                >
                  <AppText className={optionTextClassName(isSelected)}>
                    {issuer}
                  </AppText>
                </Pressable>
              );
            })}
          </RtlRow>
          <AppText className="mb-2 mt-5 text-base font-extrabold text-slate-700 dark:text-slate-200">
            {t('מועדון הכרטיס')}
          </AppText>
          <TextInput
            className="min-h-[52px] rounded-lg border border-slate-300 bg-white px-4 text-lg text-slate-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            onChangeText={setClubText}
            placeholder={t('אופציונלי')}
            placeholderTextColor="#94A3B8"
            style={{ textAlign, writingDirection }}
            value={clubText}
          />
          <AppText className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-400">
            {t(
              'הגדרת כרטיס ידנית מלאה נשארת מקומית ותאסוף את שדות הכרטיס הנדרשים לפני יצירת כרטיס לשימוש.',
            )}
          </AppText>
        </View>
      );
    }

    return (
      <View className="w-full">
        <AppText className="mb-5 text-2xl font-black text-slate-900 dark:text-white">
          {t('אישור סיום')}
        </AppText>
        <AppText className="mb-2 text-base font-extrabold text-slate-700 dark:text-slate-200">
          {t('מספר טלפון')}
        </AppText>
        <TextInput
          className="min-h-[52px] rounded-lg border border-slate-300 bg-white px-4 text-lg text-slate-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          keyboardType="phone-pad"
          onChangeText={setPhoneText}
          placeholder="050-0000000"
          placeholderTextColor="#94A3B8"
          style={{ textAlign, writingDirection }}
          value={phoneText}
        />
        <AppText className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-400">
          {t('מספר טלפון - לשחזור חשבון בעתיד (אופציונלי)')}
        </AppText>
        <AppText className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-400">
          {t(
            'הנתונים נשמרים רק בכספת המוצפנת המקומית. לא ניתן לשחזר אותם אם שוכחים את ה-PIN ומאפסים את הכספת.',
          )}
        </AppText>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: '#F8FAFC' }}
    >
      <RtlRow className="gap-2 border-b border-slate-200 bg-white px-5 py-4 dark:border-neutral-800 dark:bg-neutral-950">
        {STEPS.map(step => (
          <View
            className={`h-1.5 flex-1 rounded-full ${
              step <= currentStep ? 'bg-blue-600' : 'bg-slate-200 dark:bg-neutral-700'
            }`}
            key={step}
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
            <AppText className="mt-5 text-sm font-bold text-red-600 dark:text-red-300">
              {error}
            </AppText>
          ) : null}
        </View>
      </RtlScrollView>

      <RtlRow className="gap-3 border-t border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <Pressable
          accessibilityRole="button"
          className={`min-h-[50px] flex-1 items-center justify-center rounded-lg border ${
            currentStep === 1
              ? 'border-slate-200 bg-slate-100 dark:border-neutral-800 dark:bg-neutral-900'
              : 'border-slate-300 bg-white dark:border-neutral-700 dark:bg-neutral-900'
          }`}
          disabled={currentStep === 1}
          onPress={goBack}
        >
          <AppText
            className={`text-center text-base font-extrabold ${
              currentStep === 1
                ? 'text-slate-400 dark:text-neutral-600'
                : 'text-slate-700 dark:text-slate-100'
            }`}
          >
            {t('חזרה')}
          </AppText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          className={`min-h-[50px] flex-[2] items-center justify-center rounded-lg ${
            canContinue() ? 'bg-blue-600' : 'bg-slate-300 dark:bg-neutral-700'
          }`}
          disabled={!canContinue()}
          onPress={handleNext}
        >
          <AppText className="text-center text-base font-extrabold text-white">
            {currentStep === 4 ? t('סיום') : t('המשך')}
          </AppText>
        </Pressable>
      </RtlRow>
    </KeyboardAvoidingView>
  );
}
