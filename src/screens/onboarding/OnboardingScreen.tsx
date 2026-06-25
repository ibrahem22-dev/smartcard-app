// /src/screens/onboarding/OnboardingScreen.tsx
//
// 4-step wizard collecting the user's bank, income, balance, and (future) card.
// Onboarding runs before the vault is ever unlocked. This screen does not own
// MMKV storage; completion is persisted by authContext.completeOnboarding().
// No network calls.
//
// Step 1: Bank selector
// Step 2: Monthly income + current balance
// Step 3: Add first card (stub — M3)
// Step 4: Phone number (stub — M3)

import React, { useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  I18nManager,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CardIssuer, CardNetwork } from '../../types/card.types';
import type { CardInput } from '../../types/card.types';
import { Currency } from '../../types/purchase.types';
import { useAuth } from '../../navigation/authContext';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

// ─── Constants ─────────────────────────────────────────────────────────────────

// Storage ownership lives in authContext; keep this screen UI-only.
const BANK_OPTIONS: readonly string[] = [
  'לאומי',
  'הפועלים',
  'דיסקונט',
  'מזרחי',
  'אחר',
];

const STEPS: readonly Step[] = [1, 2, 3, 4];

const TEXT_ALIGN: 'right' | 'left' = I18nManager.isRTL ? 'right' : 'left';

// ─── Step 3 constants ──────────────────────────────────────────────────────────

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
  [CardIssuer.Max]: [
    'מועדון מקס רגיל',
    'לייף סטייל מקס',
    'מקס פלטינום',
    'זהב מקס',
  ],
  [CardIssuer.Isracard]: [
    'ישראכרט רגיל',
    'ישראכרט זהב',
    'פלטינום ישראכרט',
    'כרטיס אמריקן אקספרס',
  ],
  [CardIssuer.Cal]: [
    'ויזה כל-בו',
    'ויזה פלטינום',
    'דיינרס CAL',
    'ויזה גולד',
  ],
};

const BASIC_CLUB: Record<CardIssuer, string> = {
  [CardIssuer.Max]: 'מועדון מקס רגיל',
  [CardIssuer.Isracard]: 'ישראכרט רגיל',
  [CardIssuer.Cal]: 'ויזה כל-בו',
};

const TRAVEL_CLUB: Record<CardIssuer, string> = {
  [CardIssuer.Max]: 'לייף סטייל מקס',
  [CardIssuer.Isracard]: 'כרטיס אמריקן אקספרס',
  [CardIssuer.Cal]: 'דיינרס CAL',
};

const PREMIUM_CLUB: Record<CardIssuer, string> = {
  [CardIssuer.Max]: 'מקס פלטינום',
  [CardIssuer.Isracard]: 'פלטינום ישראכרט',
  [CardIssuer.Cal]: 'ויזה פלטינום',
};

const Q1_OPTIONS = ['לעיתים נדירות', 'כמה פעמים', 'יומיומי'] as const;
const Q2_OPTIONS = ['קניות יומיומיות', 'מסעדות ובילויים', 'חו"ל', 'הכל'] as const;
const Q3_OPTIONS = ['כן', 'לא', 'לא בטוח'] as const;

// ─── Step 3 helpers ────────────────────────────────────────────────────────────

function suggestClub(company: CardIssuer, q1: string, q2: string): string {
  if (q2 === 'חו"ל') return TRAVEL_CLUB[company];
  if (q1 === 'יומיומי') return PREMIUM_CLUB[company];
  return BASIC_CLUB[company];
}

function inferNetwork(company: CardIssuer, clubName: string): CardNetwork {
  if (clubName === 'כרטיס אמריקן אקספרס') return CardNetwork.Amex;
  if (clubName === 'דיינרס CAL') return CardNetwork.Diners;
  if (company === CardIssuer.Max) return CardNetwork.Mastercard;
  return CardNetwork.Visa;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingScreen(): React.ReactElement {
  const { completeOnboarding } = useAuth();

  // ── Wizard state ────────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // ── Step 1 state ─────────────────────────────────────────────────────────────
  const [selectedBank, setSelectedBank] = useState<string | null>(null);

  // ── Step 2 state ─────────────────────────────────────────────────────────────
  const [incomeText, setIncomeText] = useState('');
  const [balanceText, setBalanceText] = useState('');
  const [incomeError, setIncomeError] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Step 3 state ─────────────────────────────────────────────────────────────
  const [selectedCompany, setSelectedCompany] = useState<CardIssuer | null>(null);
  const [selectedClub, setSelectedClub] = useState<string | null>(null);
  const [unknownClubMode, setUnknownClubMode] = useState(false);
  const [q1Answer, setQ1Answer] = useState<string | null>(null);
  const [q2Answer, setQ2Answer] = useState<string | null>(null);
  const [q3Answer, setQ3Answer] = useState<string | null>(null);

  // STEP 4 START
  const [phoneText, setPhoneText] = useState('');
  const [finishError, setFinishError] = useState<string | null>(null);
  // STEP 4 END

  // Derived: unknown-club flow is complete once Q3 is answered
  const unknownClubDone = q3Answer !== null;

  // ── Navigation helpers ────────────────────────────────────────────────────────

  function goTo(step: Step): void {
    setCurrentStep(step);
  }

  function handleBack(): void {
    if (currentStep === 1) return;
    goTo((currentStep - 1) as Step);
  }

  // ── Step 2 validation + persistence ─────────────────────────────────────────

  function commitStep2(): boolean {
    const rawIncome = incomeText.trim().replace(/,/g, '');
    const rawBalance = balanceText.trim().replace(/,/g, '');
    const income = Number(rawIncome);
    const balance = Number(rawBalance);

    let valid = true;

    if (rawIncome === '' || !Number.isFinite(income) || income <= 0) {
      setIncomeError('נא להזין הכנסה חודשית תקינה (מספר חיובי)');
      valid = false;
    } else {
      setIncomeError(null);
    }

    if (rawBalance === '' || !Number.isFinite(balance) || balance <= 0) {
      setBalanceError('נא להזין יתרה תקינה (מספר חיובי)');
      valid = false;
    } else {
      setBalanceError(null);
    }
    if (!valid) return false;

    try {
      const now = Date.now();
      const profile = {
        id: `user_${now}`,
        ...(selectedBank !== null ? { bankName: selectedBank } : {}),
        monthlyIncome: income,
        currentBalance: balance,
        dangerThreshold: Math.round(income * 0.1),
        createdAt: now,
        updatedAt: now,
      };
      void JSON.stringify(profile);
      setSaveError(null);
    } catch (e) {
      setSaveError('שמירת הנתונים נכשלה. נסה שוב.');
      return false;
    }

    return true;
  }

  // ── Step 3 handlers + persistence ───────────────────────────────────────────

  function handleCompanySelect(company: CardIssuer): void {
    setSelectedCompany(company);
    setSelectedClub(null);
    setUnknownClubMode(false);
    setQ1Answer(null);
    setQ2Answer(null);
    setQ3Answer(null);
  }

  function commitStep3(): boolean {
    if (selectedCompany === null) return false;

    const clubName =
      unknownClubDone && q1Answer !== null && q2Answer !== null
        ? suggestClub(selectedCompany, q1Answer, q2Answer)
        : selectedClub;

    if (clubName === null) return false;

    const clubSuggestedByApp = unknownClubDone;

    try {
      const now = Date.now();
      const card: CardInput = {
        cardId: `card_${now}`,
        displayName: clubName,
        last4: '0000',
        issuer: selectedCompany,
        network: inferNetwork(selectedCompany, clubName),
        currency: Currency.ILS,
        framework: { creditLimit: 0, currentBalance: 0 },
        billingCycle: { statementClosingDay: 25, billingDayOfMonth: 10 },
        roleTags: [],
        primaryRole: null,
        rewardCategories: [],
        cashbackRate: 0,
        foreignTransactionFee: 0,
        supportsInstallments: true,
        annualFee: 0,
        isActive: true,
      };
      const entry = { card, clubSuggestedByApp };
      void JSON.stringify(entry);
      setSaveError(null);
    } catch (e) {
      setSaveError('שמירת הכרטיס נכשלה. נסה שוב.');
      return false;
    }

    return true;
  }

  // ── Main "המשך" handler ──────────────────────────────────────────────────────

  async function handleNext(): Promise<void> {
    if (currentStep === 1) {
      goTo(2);
      return;
    }

    if (currentStep === 2) {
      if (commitStep2()) {
        goTo(3);
      }
      return;
    }

    if (currentStep === 3) {
      if (commitStep3()) {
        goTo(4);
      }
      return;
    }

    if (currentStep === 4) {
      const result = await LocalAuthentication.authenticateAsync();
      if (result.success === false) {
        return;
      }
      completeOnboarding();
      return;
    }
  }

  // ── Step renderers ───────────────────────────────────────────────────────────

  function renderStep1(): React.ReactElement {
    return (
      <View>
        <Text style={styles.stepTitle}>באיזה בנק אתה מנהל את החשבון?</Text>
        <View style={styles.bankGrid}>
          {BANK_OPTIONS.map((bank) => {
            const isSelected = selectedBank === bank;
            return (
              <Pressable
                key={bank}
                style={[styles.bankBox, isSelected && styles.bankBoxSelected]}
                onPress={() => setSelectedBank(bank)}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={bank}
              >
                <Text
                  style={[styles.bankLabel, isSelected && styles.bankLabelSelected]}
                >
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
      <View>
        <Text style={styles.stepTitle}>פרטים פיננסיים</Text>

        <Text style={styles.inputLabel}>הכנסה חודשית (₪)</Text>
        <TextInput
          style={[styles.textInput, incomeError !== null && styles.textInputError]}
          value={incomeText}
          onChangeText={(t) => {
            setIncomeText(t);
            if (incomeError !== null) setIncomeError(null);
          }}
          keyboardType="numeric"
          placeholder="למשל: 8000"
          placeholderTextColor="#9CA3AF"
          textAlign={TEXT_ALIGN}
          accessibilityLabel="הכנסה חודשית"
          returnKeyType="next"
        />
        {incomeError !== null && (
          <Text style={styles.fieldError}>{incomeError}</Text>
        )}

        <Text style={[styles.inputLabel, styles.inputLabelSpaced]}>יתרה נוכחית (₪)</Text>
        <TextInput
          style={[styles.textInput, balanceError !== null && styles.textInputError]}
          value={balanceText}
          onChangeText={(t) => {
            setBalanceText(t);
            if (balanceError !== null) setBalanceError(null);
          }}
          keyboardType="numeric"
          placeholder="למשל: 5000"
          placeholderTextColor="#9CA3AF"
          textAlign={TEXT_ALIGN}
          accessibilityLabel="יתרה נוכחית"
          returnKeyType="done"
        />
        {balanceError !== null && (
          <Text style={styles.fieldError}>{balanceError}</Text>
        )}

        {saveError !== null && (
          <Text style={[styles.fieldError, styles.saveError]}>{saveError}</Text>
        )}
      </View>
    );
  }

  function renderStep3(): React.ReactElement {
    const clubs =
      selectedCompany !== null ? CLUBS[selectedCompany] : null;

    return (
      <View>
        <Text style={styles.stepTitle}>הוסף את הכרטיס הראשון שלך</Text>

        {/* ── Company selector ─────────────────────────────────────────────── */}
        <Text style={styles.inputLabel}>חברת כרטיס האשראי</Text>
        <View style={styles.bankGrid}>
          {COMPANY_OPTIONS.map((company) => {
            const isSelected = selectedCompany === company;
            return (
              <Pressable
                key={company}
                style={[styles.bankBox, isSelected && styles.bankBoxSelected]}
                onPress={() => handleCompanySelect(company)}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={COMPANY_LABELS[company]}
              >
                <Text
                  style={[styles.bankLabel, isSelected && styles.bankLabelSelected]}
                >
                  {COMPANY_LABELS[company]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Club list ────────────────────────────────────────────────────── */}
        {clubs !== null && !unknownClubMode && (
          <View style={styles.step3Section}>
            <Text style={styles.inputLabel}>מועדון הכרטיס</Text>
            <View style={styles.clubList}>
              {clubs.map((club) => {
                const isSelected = selectedClub === club;
                return (
                  <Pressable
                    key={club}
                    style={[styles.clubItem, isSelected && styles.clubItemSelected]}
                    onPress={() => setSelectedClub(club)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={club}
                  >
                    <Text
                      style={[
                        styles.clubItemLabel,
                        isSelected && styles.clubItemLabelSelected,
                      ]}
                    >
                      {club}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Unknown-club guided flow ─────────────────────────────────────── */}
        {unknownClubMode && (
          <View style={styles.step3Section}>
            {/* Q1 */}
            <Text style={styles.qaQuestion}>
              כמה פעמים בחודש אתה משתמש בה?
            </Text>
            <View style={styles.qaOptions}>
              {Q1_OPTIONS.map((opt) => {
                const isSelected = q1Answer === opt;
                return (
                  <Pressable
                    key={opt}
                    style={[styles.qaOption, isSelected && styles.qaOptionSelected]}
                    onPress={() => {
                      setQ1Answer(opt);
                      setQ2Answer(null);
                      setQ3Answer(null);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <Text
                      style={[
                        styles.qaOptionLabel,
                        isSelected && styles.qaOptionLabelSelected,
                      ]}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Q2 — shown after Q1 */}
            {q1Answer !== null && (
              <>
                <Text style={[styles.qaQuestion, styles.qaQuestionSpaced]}>
                  בעיקר לאיזה שימוש?
                </Text>
                <View style={styles.qaOptions}>
                  {Q2_OPTIONS.map((opt) => {
                    const isSelected = q2Answer === opt;
                    return (
                      <Pressable
                        key={opt}
                        style={[
                          styles.qaOption,
                          isSelected && styles.qaOptionSelected,
                        ]}
                        onPress={() => {
                          setQ2Answer(opt);
                          setQ3Answer(null);
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                      >
                        <Text
                          style={[
                            styles.qaOptionLabel,
                            isSelected && styles.qaOptionLabelSelected,
                          ]}
                        >
                          {opt}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {/* Q3 — shown after Q2 */}
            {q2Answer !== null && (
              <>
                <Text style={[styles.qaQuestion, styles.qaQuestionSpaced]}>
                  יש לך הטבות מיוחדות שאתה יודע עליהן?
                </Text>
                <View style={styles.qaOptions}>
                  {Q3_OPTIONS.map((opt) => {
                    const isSelected = q3Answer === opt;
                    return (
                      <Pressable
                        key={opt}
                        style={[
                          styles.qaOption,
                          isSelected && styles.qaOptionSelected,
                        ]}
                        onPress={() => setQ3Answer(opt)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                      >
                        <Text
                          style={[
                            styles.qaOptionLabel,
                            isSelected && styles.qaOptionLabelSelected,
                          ]}
                        >
                          {opt}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {/* Suggested club — shown after Q3 */}
            {unknownClubDone &&
              selectedCompany !== null &&
              q1Answer !== null &&
              q2Answer !== null && (
                <View style={styles.suggestedClubBox}>
                  <Text style={styles.suggestedClubLabel}>המועדון המומלץ עבורך:</Text>
                  <Text style={styles.suggestedClubName}>
                    {suggestClub(selectedCompany, q1Answer, q2Answer)}
                  </Text>
                </View>
              )}
          </View>
        )}

        {/* ── "אני לא יודע את המועדון" — always visible ───────────────────── */}
        <Pressable
          style={styles.unknownClubBtn}
          onPress={() => {
            setUnknownClubMode(true);
            setSelectedClub(null);
          }}
          accessibilityRole="button"
          accessibilityLabel="אני לא יודע את המועדון"
        >
          <Text style={styles.unknownClubBtnText}>אני לא יודע את המועדון</Text>
        </Pressable>
      </View>
    );
  }

  // STEP 4 START
  function renderStep4(): React.ReactElement {
    return (
      <View>
        <Text style={styles.stepTitle}>מספר טלפון</Text>

        <Text style={styles.inputLabel}>מספר טלפון</Text>
        <TextInput
          style={styles.textInput}
          value={phoneText}
          onChangeText={(text) => {
            setPhoneText(text);
            if (finishError !== null) setFinishError(null);
          }}
          keyboardType="phone-pad"
          placeholder="למשל: 0501234567"
          placeholderTextColor="#9CA3AF"
          textAlign={TEXT_ALIGN}
          accessibilityLabel="מספר טלפון"
          returnKeyType="done"
        />

        {finishError !== null && (
          <Text style={[styles.fieldError, styles.saveError]}>{finishError}</Text>
        )}

        <Pressable
          style={styles.finishButton}
          onPress={() => {
            void handleNext();
          }}
          accessibilityRole="button"
          accessibilityLabel="סיום"
        >
          <Text style={styles.finishButtonLabel}>סיום</Text>
        </Pressable>
      </View>
    );
  }
  // STEP 4 END

  function renderCurrentStep(): React.ReactElement {
    if (currentStep === 1) return renderStep1();
    if (currentStep === 2) return renderStep2();
    if (currentStep === 3) return renderStep3();
    return renderStep4();
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const isBackDisabled = currentStep === 1;
  const isNextDisabled =
    currentStep === 3 &&
    (selectedCompany === null ||
      (selectedClub === null && !unknownClubDone));

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Step progress indicator */}
      <View style={styles.progressRow}>
        {STEPS.map((step) => (
          <View
            key={step}
            style={[
              styles.progressDot,
              currentStep === step && styles.progressDotActive,
              currentStep > step && styles.progressDotDone,
            ]}
          />
        ))}
      </View>

      {/* Scrollable step content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {renderCurrentStep()}
      </ScrollView>

      {/* Fixed navigation bar — outside scroll area */}
      <View style={styles.bottomBar}>
        {/* "המשך" first → appears on the RIGHT in RTL layout (primary/forward action) */}
        <Pressable
          style={[styles.btnNext, isNextDisabled && styles.btnNextDisabled]}
          onPress={handleNext}
          disabled={isNextDisabled}
          accessibilityRole="button"
          accessibilityLabel="המשך"
          accessibilityState={{ disabled: isNextDisabled }}
        >
          <Text style={[styles.btnNextLabel, isNextDisabled && styles.btnLabelMuted]}>
            המשך
          </Text>
        </Pressable>

        {/* "חזור" second → appears on the LEFT in RTL layout (secondary/back action) */}
        <Pressable
          style={[styles.btnBack, isBackDisabled && styles.btnBackDisabled]}
          onPress={handleBack}
          disabled={isBackDisabled}
          accessibilityRole="button"
          accessibilityLabel="חזור"
          accessibilityState={{ disabled: isBackDisabled }}
        >
          <Text style={[styles.btnBackLabel, isBackDisabled && styles.btnLabelMuted]}>
            חזור
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  // ── Progress dots ──────────────────────────────────────────────────────────
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 12,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  progressDotActive: {
    width: 24,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  progressDotDone: {
    backgroundColor: '#93C5FD',
  },

  // ── Scroll area ────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },

  // ── Shared step typography ─────────────────────────────────────────────────
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: TEXT_ALIGN,
    marginBottom: 24,
  },

  // ── Step 1: Bank grid ──────────────────────────────────────────────────────
  bankGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bankBox: {
    // ~2 per row with gap accounted for
    width: '47%',
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankBoxSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  bankLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  bankLabelSelected: {
    color: '#2563EB',
    fontWeight: '700',
  },

  // ── Step 2: Financial inputs ───────────────────────────────────────────────
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    textAlign: TEXT_ALIGN,
    marginBottom: 8,
  },
  inputLabelSpaced: {
    marginTop: 20,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: '#111827',
  },
  textInputError: {
    borderColor: '#DC2626',
  },
  fieldError: {
    fontSize: 13,
    color: '#DC2626',
    textAlign: TEXT_ALIGN,
    marginTop: 5,
  },
  saveError: {
    marginTop: 16,
    fontSize: 14,
  },

  // ── Stub ───────────────────────────────────────────────────────────────────
  stubContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },

  // ── Step 3: Card setup ────────────────────────────────────────────────────
  step3Section: {
    marginTop: 20,
  },
  clubList: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  clubItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  clubItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  clubItemLabel: {
    fontSize: 16,
    color: '#374151',
    textAlign: TEXT_ALIGN,
  },
  clubItemLabelSelected: {
    color: '#2563EB',
    fontWeight: '600',
  },
  unknownClubBtn: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  unknownClubBtnText: {
    fontSize: 14,
    color: '#6B7280',
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  finishButton: {
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // ── Step 3: Q&A flow ───────────────────────────────────────────────────────
  qaQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    textAlign: TEXT_ALIGN,
    marginBottom: 10,
  },
  qaQuestionSpaced: {
    marginTop: 20,
  },
  qaOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  qaOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  qaOptionSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  qaOptionLabel: {
    fontSize: 14,
    color: '#374151',
  },
  qaOptionLabelSelected: {
    color: '#2563EB',
    fontWeight: '600',
  },
  suggestedClubBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  suggestedClubLabel: {
    fontSize: 13,
    color: '#166534',
    textAlign: TEXT_ALIGN,
    marginBottom: 4,
  },
  suggestedClubName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#15803D',
    textAlign: TEXT_ALIGN,
  },

  // ── Bottom navigation bar ──────────────────────────────────────────────────
  bottomBar: {
    // RTL: flexDirection 'row' → first child on RIGHT, second on LEFT
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  btnNext: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnNextLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnNextDisabled: {
    backgroundColor: '#BFDBFE',
  },
  btnBack: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  btnBackDisabled: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  btnBackLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  btnLabelMuted: {
    color: '#D1D5DB',
  },
});
