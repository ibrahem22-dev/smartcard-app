// /src/screens/onboarding/OnboardingScreen.tsx
//
// Four-step onboarding wizard. Storage ownership stays in authContext and the
// encrypted stores; this screen only collects transient UI input.

import React, { useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../../navigation/authContext';
import { CardIssuer } from '../../types/card.types';
import { rtl } from '../../utils/rtlStyles';

type Step = 1 | 2 | 3 | 4;

const STEPS: readonly Step[] = [1, 2, 3, 4];

const BANK_OPTIONS: readonly string[] = [
  'לאומי',
  'הפועלים',
  'דיסקונט',
  'מזרחי',
  'אחר',
];

const COMPANY_OPTIONS: readonly CardIssuer[] = [
  CardIssuer.Max,
  CardIssuer.Isracard,
  CardIssuer.Cal,
];

const COMPANY_LABELS: Record<CardIssuer, string> = {
  [CardIssuer.Max]: 'Max',
  [CardIssuer.Isracard]: 'Isracard',
  [CardIssuer.Cal]: 'CAL',
};

const CLUBS: Record<CardIssuer, readonly string[]> = {
  [CardIssuer.Max]: ['מועדון מקס רגיל', 'Life Style Max', 'Max Platinum'],
  [CardIssuer.Isracard]: ['ישראכרט רגיל', 'ישראכרט זהב', 'אמריקן אקספרס'],
  [CardIssuer.Cal]: ['ויזה כאל', 'Diners CAL', 'ויזה פלטינום'],
};

const BASIC_CLUB: Record<CardIssuer, string> = {
  [CardIssuer.Max]: 'מועדון מקס רגיל',
  [CardIssuer.Isracard]: 'ישראכרט רגיל',
  [CardIssuer.Cal]: 'ויזה כאל',
};

function parsePositiveNumber(value: string): number | null {
  const normalized = value.trim().replace(/,/g, '');
  const parsed = Number(normalized);

  if (normalized === '' || !Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
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
  const { completeOnboarding } = useAuth();

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [incomeText, setIncomeText] = useState('');
  const [balanceText, setBalanceText] = useState('');
  const [incomeError, setIncomeError] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CardIssuer | null>(null);
  const [selectedClub, setSelectedClub] = useState<string | null>(null);
  const [unknownClub, setUnknownClub] = useState(false);
  const [phoneText, setPhoneText] = useState('');
  const [finishError, setFinishError] = useState<string | null>(null);

  function goBack(): void {
    if (currentStep === 1) {
      return;
    }

    setCurrentStep((currentStep - 1) as Step);
  }

  function validateStep2(): boolean {
    const income = parsePositiveNumber(incomeText);
    const balance = parsePositiveNumber(balanceText);

    setIncomeError(income === null ? 'נא להזין הכנסה חודשית תקינה' : null);
    setBalanceError(balance === null ? 'נא להזין יתרה תקינה' : null);

    return income !== null && balance !== null;
  }

  function handleCompanySelect(company: CardIssuer): void {
    setSelectedCompany(company);
    setSelectedClub(null);
    setUnknownClub(false);
  }

  function handleUnknownClub(): void {
    if (selectedCompany === null) {
      return;
    }

    setSelectedClub(BASIC_CLUB[selectedCompany]);
    setUnknownClub(true);
  }

  function canContinue(): boolean {
    if (currentStep === 1) {
      return selectedBank !== null;
    }

    if (currentStep === 3) {
      return selectedCompany !== null && selectedClub !== null;
    }

    return true;
  }

  async function handleFinish(): Promise<void> {
    setFinishError(null);

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'אישור סיום',
        fallbackLabel: 'השתמש בקוד',
      });

      if (!result.success) {
        setFinishError('האימות לא הושלם. נסה שוב.');
        return;
      }

      completeOnboarding();
    } catch {
      setFinishError('לא הצלחנו להשלים את האימות. נסה שוב.');
    }
  }

  function handleNext(): void {
    if (currentStep === 2 && !validateStep2()) {
      return;
    }

    if (currentStep === 4) {
      void handleFinish();
      return;
    }

    setCurrentStep((currentStep + 1) as Step);
  }

  function renderStep1(): React.ReactElement {
    return (
      <View className="w-full">
        <Text
          className="mb-5 text-right text-2xl font-black text-slate-900 dark:text-white"
          style={rtl.text}
        >
          באיזה בנק אתה מנהל את החשבון?
        </Text>
        <View
          className="w-full flex-row-reverse flex-wrap gap-3"
          style={rtl.row}
        >
          {BANK_OPTIONS.map(bank => {
            const isSelected = selectedBank === bank;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                className={optionClassName(isSelected)}
                key={bank}
                onPress={(): void => setSelectedBank(bank)}
              >
                <Text className={optionTextClassName(isSelected)} style={rtl.text}>
                  {bank}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  function renderStep2(): React.ReactElement {
    return (
      <View className="w-full">
        <Text
          className="mb-5 text-right text-2xl font-black text-slate-900 dark:text-white"
          style={rtl.text}
        >
          פרטים פיננסיים
        </Text>

        <Text
          className="mb-2 text-right text-base font-extrabold text-slate-700 dark:text-slate-200"
          style={rtl.text}
        >
          הכנסה חודשית (₪)
        </Text>
        <TextInput
          className="min-h-[52px] rounded-lg border border-slate-300 bg-white px-4 text-right text-lg text-slate-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          keyboardType="numeric"
          onChangeText={setIncomeText}
          placeholder="לדוגמה: 12000"
          placeholderTextColor="#94A3B8"
          style={rtl.input}
          value={incomeText}
        />
        {incomeError !== null ? (
          <Text
            className="mt-1.5 text-right text-sm font-bold text-red-600 dark:text-red-300"
            style={rtl.text}
          >
            {incomeError}
          </Text>
        ) : null}

        <Text
          className="mb-2 mt-5 text-right text-base font-extrabold text-slate-700 dark:text-slate-200"
          style={rtl.text}
        >
          יתרה נוכחית (₪)
        </Text>
        <TextInput
          className="min-h-[52px] rounded-lg border border-slate-300 bg-white px-4 text-right text-lg text-slate-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          keyboardType="numeric"
          onChangeText={setBalanceText}
          placeholder="לדוגמה: 3500"
          placeholderTextColor="#94A3B8"
          style={rtl.input}
          value={balanceText}
        />
        {balanceError !== null ? (
          <Text
            className="mt-1.5 text-right text-sm font-bold text-red-600 dark:text-red-300"
            style={rtl.text}
          >
            {balanceError}
          </Text>
        ) : null}
      </View>
    );
  }

  function renderStep3(): React.ReactElement {
    const clubs = selectedCompany === null ? [] : CLUBS[selectedCompany];

    return (
      <View className="w-full">
        <Text
          className="mb-5 text-right text-2xl font-black text-slate-900 dark:text-white"
          style={rtl.text}
        >
          הוסף את הכרטיס הראשון שלך
        </Text>

        <Text
          className="mb-2 text-right text-base font-extrabold text-slate-700 dark:text-slate-200"
          style={rtl.text}
        >
          חברת כרטיס האשראי
        </Text>
        <View
          className="w-full flex-row-reverse flex-wrap gap-3"
          style={rtl.row}
        >
          {COMPANY_OPTIONS.map(company => {
            const isSelected = selectedCompany === company;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                className={optionClassName(isSelected)}
                key={company}
                onPress={(): void => handleCompanySelect(company)}
              >
                <Text className={optionTextClassName(isSelected)} style={rtl.text}>
                  {COMPANY_LABELS[company]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {selectedCompany !== null ? (
          <View className="mt-6 w-full">
            <Text
              className="mb-2 text-right text-base font-extrabold text-slate-700 dark:text-slate-200"
              style={rtl.text}
            >
              מועדון הכרטיס
            </Text>
            <View className="gap-2">
              {clubs.map(club => {
                const isSelected = selectedClub === club && !unknownClub;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    className={`min-h-[48px] justify-center rounded-lg border px-4 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-100 dark:border-blue-400 dark:bg-blue-950'
                        : 'border-slate-300 bg-white dark:border-neutral-700 dark:bg-neutral-900'
                    }`}
                    key={club}
                    onPress={(): void => {
                      setSelectedClub(club);
                      setUnknownClub(false);
                    }}
                  >
                    <Text className={optionTextClassName(isSelected)} style={rtl.text}>
                      {club}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: unknownClub }}
              className={`mt-4 min-h-[48px] items-center justify-center rounded-lg border px-4 ${
                unknownClub
                  ? 'border-orange-500 bg-orange-100 dark:border-orange-300 dark:bg-orange-950'
                  : 'border-orange-300 bg-orange-50 dark:border-orange-900 dark:bg-orange-950'
              }`}
              onPress={handleUnknownClub}
            >
              <Text
                className="text-center text-base font-extrabold text-orange-800 dark:text-orange-200"
                style={rtl.text}
              >
                אני לא יודע את המועדון 🔍
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  function renderStep4(): React.ReactElement {
    return (
      <View className="w-full">
        <Text
          className="mb-5 text-right text-2xl font-black text-slate-900 dark:text-white"
          style={rtl.text}
        >
          מספר טלפון
        </Text>
        <Text
          className="mb-2 text-right text-base font-extrabold text-slate-700 dark:text-slate-200"
          style={rtl.text}
        >
          מספר טלפון - לשחזור חשבון בעתיד (אופציונלי)
        </Text>
        <TextInput
          className="min-h-[52px] rounded-lg border border-slate-300 bg-white px-4 text-right text-lg text-slate-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          keyboardType="phone-pad"
          onChangeText={setPhoneText}
          placeholder="050-0000000"
          placeholderTextColor="#94A3B8"
          style={rtl.input}
          value={phoneText}
        />

        <Pressable
          accessibilityRole="button"
          className="mt-6 min-h-[52px] items-center justify-center rounded-lg bg-green-600"
          onPress={(): void => {
            void handleFinish();
          }}
        >
          <Text className="text-center text-lg font-black text-white" style={rtl.text}>
            סיום
          </Text>
        </Pressable>

        {finishError !== null ? (
          <Text
            className="mt-3 text-right text-sm font-bold text-red-600 dark:text-red-300"
            style={rtl.text}
          >
            {finishError}
          </Text>
        ) : null}
      </View>
    );
  }

  function renderCurrentStep(): React.ReactElement {
    if (currentStep === 1) {
      return renderStep1();
    }

    if (currentStep === 2) {
      return renderStep2();
    }

    if (currentStep === 3) {
      return renderStep3();
    }

    return renderStep4();
  }

  const isContinueDisabled = !canContinue();

  return (
    /*
      FIX: Removed className from KeyboardAvoidingView and ScrollView.
      NativeWind's CSSInterop wraps these components and on Android can inject
      layout props (alignItems, flexDirection) into the native `style` prop
      instead of contentContainerStyle — causing Invariant Violation crash.
      Solution: explicit style props only on KeyboardAvoidingView and ScrollView.
      All child <View> and <Text> components keep className as normal.
    */
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[rtl.screen, { backgroundColor: '#F8FAFC' }]}
    >
      <View
        className="flex-row-reverse gap-2 border-b border-slate-200 bg-white px-5 py-4 dark:border-neutral-800 dark:bg-neutral-950"
        style={rtl.row}
      >
        {STEPS.map(step => {
          const isActive = step <= currentStep;

          return (
            <View
              className={`h-1.5 flex-1 rounded-full ${
                isActive ? 'bg-blue-600' : 'bg-slate-200 dark:bg-neutral-700'
              }`}
              key={step}
            />
          );
        })}
      </View>

      <ScrollView
        style={rtl.scrollOuter}
        contentContainerStyle={rtl.scrollInner}
        keyboardShouldPersistTaps="handled"
      >
        <View className="min-h-full w-full px-5 py-6">{renderCurrentStep()}</View>
      </ScrollView>

      <View
        className="flex-row-reverse gap-3 border-t border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
        style={rtl.row}
      >
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
          <Text
            className={`text-center text-base font-extrabold ${
              currentStep === 1
                ? 'text-slate-400 dark:text-neutral-600'
                : 'text-slate-700 dark:text-slate-100'
            }`}
            style={rtl.text}
          >
            חזרה
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          className={`min-h-[50px] flex-[2] items-center justify-center rounded-lg ${
            isContinueDisabled
              ? 'bg-slate-300 dark:bg-neutral-700'
              : 'bg-blue-600'
          }`}
          disabled={isContinueDisabled}
          onPress={handleNext}
        >
          <Text className="text-center text-base font-extrabold text-white" style={rtl.text}>
            {currentStep === 4 ? 'סיום' : 'המשך'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}