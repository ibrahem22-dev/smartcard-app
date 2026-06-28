import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import * as Crypto from 'expo-crypto';

import { AppText } from '../components/AppText';
import { calculateLoanImpact, calculateLoanSummary } from '../engines/loanEngine';
import { useTranslation } from '../hooks/useTranslation';
import { useLoansStore } from '../store/useLoansStore';
import { useUserStore } from '../store/useUserStore';
import type { Loan, LoanImpact, LoanSummary, LoanType } from '../types/loan.types';
import { parseAmount } from '../utils/parseAmount';
import { inputStyle, rtl } from '../utils/rtlStyles';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseRate(value: string): number | null {
  const normalized = value.trim().replace(/[%\s]/g, '');
  if (normalized === '') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 30 ? parsed : null;
}

function parseMonthCount(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 360 ? parsed : null;
}

function parseMonthsPaidCount(value: string, max: number): number | null {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= max ? parsed : null;
}

function parseISODate(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : trimmed;
}

function formatILS(amount: number): string {
  // Number first, then ₪ — consistent with the rest of the app.
  return `${amount.toLocaleString('he-IL', { maximumFractionDigits: 0 })} ₪`;
}

function riskColor(level: LoanImpact['riskLevel']): string {
  if (level === 'low') return '#16A34A';
  if (level === 'medium') return '#D97706';
  return '#DC2626';
}

function riskLabel(level: LoanImpact['riskLevel']): string {
  if (level === 'low') return 'נמוך';
  if (level === 'medium') return 'בינוני';
  if (level === 'high') return 'גבוה';
  return 'קריטי';
}

const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  personal: 'הלוואה אישית',
  mortgage: 'משכנתא',
  overdraft: 'מינוס',
  credit_line: 'קרדיט',
};

type PersonalLoanType = 'personal' | 'overdraft' | 'credit_line';
type ActiveTab = 'personal' | 'mortgage';

const PERSONAL_LOAN_TYPES: readonly PersonalLoanType[] = [
  'personal',
  'overdraft',
  'credit_line',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LoansScreen(): React.ReactElement {
  const { t } = useTranslation();
  const loans = useLoansStore(state => state.loans);
  const hydrate = useLoansStore(state => state.hydrate);
  const addLoan = useLoansStore(state => state.addLoan);
  const updateLoan = useLoansStore(state => state.updateLoan);
  const deleteLoan = useLoansStore(state => state.deleteLoan);
  const profile = useUserStore(state => state.profile);
  const monthlyIncome = profile?.monthlyIncome ?? 0;

  // Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('personal');

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedLoanType, setSelectedLoanType] = useState<PersonalLoanType>('personal');
  const [lenderName, setLenderName] = useState('');
  const [originalAmountText, setOriginalAmountText] = useState('');
  const [monthlyPaymentText, setMonthlyPaymentText] = useState('');
  const [annualInterestRateText, setAnnualInterestRateText] = useState('');
  const [startDateText, setStartDateText] = useState(todayISO());
  const [totalMonthsText, setTotalMonthsText] = useState('');
  const [monthsPaidText, setMonthsPaidText] = useState('0');
  const [rentalIncomeText, setRentalIncomeText] = useState('');
  const [notesText, setNotesText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // ---------------------------------------------------------------------------
  // Form logic
  // ---------------------------------------------------------------------------

  function resetForm(): void {
    setEditingId(null);
    setSelectedLoanType('personal');
    setLenderName('');
    setOriginalAmountText('');
    setMonthlyPaymentText('');
    setAnnualInterestRateText('');
    setStartDateText(todayISO());
    setTotalMonthsText('');
    setMonthsPaidText('0');
    setRentalIncomeText('');
    setNotesText('');
    setFormError(null);
  }

  function switchTab(tab: ActiveTab): void {
    setActiveTab(tab);
    resetForm();
  }

  function beginEdit(loan: Loan): void {
    setEditingId(loan.id);
    setSelectedLoanType(
      loan.loanType === 'mortgage' ? 'personal' : (loan.loanType as PersonalLoanType),
    );
    setLenderName(loan.lenderName);
    setOriginalAmountText(String(loan.originalAmount));
    setMonthlyPaymentText(String(loan.monthlyPayment));
    setAnnualInterestRateText(String(loan.annualInterestRate));
    setStartDateText(loan.startDate);
    setTotalMonthsText(String(loan.totalMonths));
    setMonthsPaidText(String(loan.monthsPaid));
    setRentalIncomeText(loan.rentalIncome !== undefined ? String(loan.rentalIncome) : '');
    setNotesText(loan.notes ?? '');
    setFormError(null);
  }

  function buildLoan(): Loan | null {
    const origAmt = parseAmount(originalAmountText);
    const monthly = parseAmount(monthlyPaymentText);
    const rate = parseRate(annualInterestRateText);
    const totalMo = parseMonthCount(totalMonthsText);
    const paidMo = totalMo !== null
      ? parseMonthsPaidCount(monthsPaidText, totalMo)
      : null;
    const isoDate = parseISODate(startDateText);

    if (
      lenderName.trim() === '' ||
      origAmt === null ||
      monthly === null ||
      rate === null ||
      totalMo === null ||
      paidMo === null ||
      isoDate === null
    ) {
      return null;
    }

    const optionals: { rentalIncome?: number; notes?: string } = {};

    if (activeTab === 'mortgage' && rentalIncomeText.trim() !== '') {
      const rentalAmt = parseAmount(rentalIncomeText);
      if (rentalAmt === null) return null;
      optionals.rentalIncome = rentalAmt;
    }

    const trimmedNotes = notesText.trim();
    if (trimmedNotes !== '') {
      optionals.notes = trimmedNotes;
    }

    const currentLoanType: LoanType =
      activeTab === 'mortgage' ? 'mortgage' : selectedLoanType;

    const loan: Loan = {
      id: editingId ?? Crypto.randomUUID(),
      loanType: currentLoanType,
      lenderName: lenderName.trim(),
      originalAmount: origAmt,
      remainingBalance: Math.max(0, origAmt - monthly * paidMo),
      monthlyPayment: monthly,
      annualInterestRate: rate,
      startDate: isoDate,
      totalMonths: totalMo,
      monthsPaid: paidMo,
      ...optionals,
    };

    return loan;
  }

  function saveLoan(): void {
    const loan = buildLoan();

    if (loan === null) {
      setFormError(
        t(
          activeTab === 'mortgage' && rentalIncomeText.trim() !== '' &&
          parseAmount(rentalIncomeText) === null
            ? 'הכנסה מדמי שכירות אינה תקינה (₪0.01–999,999).'
            : 'יש למלא: שם מלווה, סכום (₪0.01–999,999), תשלום חודשי, ריבית (0–30%), תאריך (YYYY-MM-DD), חודשים (1–360), חודשים ששולמו.',
        ),
      );
      return;
    }

    if (editingId === null) {
      addLoan(loan);
    } else {
      updateLoan(loan);
    }
    resetForm();
  }

  function confirmDelete(loan: Loan): void {
    Alert.alert(
      t('מחיקת הלוואה'),
      t('למחוק את ההלוואה של {{name}}?', { name: loan.lenderName }),
      [
        { text: t('ביטול'), style: 'cancel' },
        {
          text: t('מחיקה'),
          style: 'destructive',
          onPress: (): void => {
            deleteLoan(loan.id);
            if (editingId === loan.id) resetForm();
          },
        },
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const filteredLoans = loans.filter((loan) =>
    activeTab === 'mortgage'
      ? loan.loanType === 'mortgage'
      : loan.loanType !== 'mortgage',
  );

  const impact: LoanImpact = calculateLoanImpact(loans, monthlyIncome);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const inputClass =
    'min-h-[50px] rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-900 dark:border-neutral-700 dark:bg-dark-surface dark:text-white';
  const labelClass =
    'mb-1 text-sm font-bold text-slate-700 dark:text-slate-200';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-50 dark:bg-app-dark"
      style={rtl.screen}
    >
      <ScrollView
        contentContainerStyle={[rtl.scrollInner, { paddingBottom: 32 }]}
        keyboardShouldPersistTaps="handled"
        style={rtl.scrollOuter}
      >
        <View className="w-full gap-3 p-5">
          {/* Title */}
          <AppText
            className="text-2xl font-black text-slate-900 dark:text-white"
          >
            {t('הלוואות ומשכנתא')}
          </AppText>

          {/* Tab switcher */}
          <View
            className="mb-1 overflow-hidden rounded-lg border border-slate-300 dark:border-neutral-700"
            style={rtl.row}
          >
            {(['personal', 'mortgage'] as const).map((tab) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === tab }}
                className={`flex-1 min-h-[44px] items-center justify-center ${
                  activeTab === tab
                    ? 'bg-blue-600'
                    : 'bg-white dark:bg-dark-surface'
                }`}
                key={tab}
                onPress={(): void => switchTab(tab)}
              >
                <AppText
                  className={`text-center text-sm font-bold ${ activeTab === tab ? 'text-white' : 'text-slate-700 dark:text-slate-200' }`}
                >
                  {tab === 'personal' ? t('הלוואות') : t('משכנתא')}
                </AppText>
              </Pressable>
            ))}
          </View>

          {/* Form header */}
          <AppText
            className="mt-2 text-lg font-extrabold text-slate-900 dark:text-white"
          >
            {editingId === null ? t('הוסף הלוואה') : t('עריכת הלוואה')}
          </AppText>

          {/* Personal loan type selector (personal tab only) */}
          {activeTab === 'personal' && (
            <>
              <AppText className={labelClass}>
                {t('סוג הלוואה')}
              </AppText>
              <View className="flex-wrap gap-2" style={rtl.row}>
                {PERSONAL_LOAN_TYPES.map((type) => {
                  const isSelected = selectedLoanType === type;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                      className={`min-h-[42px] min-w-[90px] items-center justify-center rounded-lg border px-3 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-100 dark:border-blue-400 dark:bg-blue-950'
                          : 'border-slate-300 bg-white dark:border-neutral-700 dark:bg-dark-surface'
                      }`}
                      key={type}
                      onPress={(): void => setSelectedLoanType(type)}
                    >
                      <AppText
                        className={`text-center text-sm font-bold ${ isSelected ? 'text-blue-700 dark:text-blue-200' : 'text-slate-700 dark:text-slate-200' }`}
                      >
                        {t(LOAN_TYPE_LABELS[type])}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {/* Lender name */}
          <AppText className={labelClass}>
            {t('שם המלווה')}
          </AppText>
          <TextInput
            className={inputClass}
            onChangeText={setLenderName}
            placeholder={t('לדוגמה: בנק הפועלים')}
            placeholderTextColor="#94A3B8"
            style={inputStyle()}
            value={lenderName}
          />

          {/* Original amount */}
          <AppText className={labelClass}>
            {t('סכום ההלוואה המקורי (₪)')}
          </AppText>
          <TextInput
            className={inputClass}
            keyboardType="decimal-pad"
            onChangeText={setOriginalAmountText}
            style={inputStyle()}
            value={originalAmountText}
          />

          {/* Monthly payment */}
          <AppText className={labelClass}>
            {t('תשלום חודשי (₪)')}
          </AppText>
          <TextInput
            className={inputClass}
            keyboardType="decimal-pad"
            onChangeText={setMonthlyPaymentText}
            style={inputStyle()}
            value={monthlyPaymentText}
          />

          {/* Annual interest rate */}
          <AppText className={labelClass}>
            {t('ריבית שנתית (0–30%)')}
          </AppText>
          <TextInput
            className={inputClass}
            keyboardType="decimal-pad"
            onChangeText={setAnnualInterestRateText}
            style={inputStyle()}
            value={annualInterestRateText}
          />

          {/* Start date */}
          <AppText className={labelClass}>
            {t('תאריך תחילת ההלוואה (YYYY-MM-DD)')}
          </AppText>
          <TextInput
            className={inputClass}
            onChangeText={setStartDateText}
            placeholder="2024-01-01"
            placeholderTextColor="#94A3B8"
            style={inputStyle()}
            value={startDateText}
          />

          {/* Total months */}
          <AppText className={labelClass}>
            {t('סך חודשי ההלוואה (1–360)')}
          </AppText>
          <TextInput
            className={inputClass}
            keyboardType="number-pad"
            onChangeText={setTotalMonthsText}
            style={inputStyle()}
            value={totalMonthsText}
          />

          {/* Months paid */}
          <AppText className={labelClass}>
            {t('חודשים ששולמו')}
          </AppText>
          <TextInput
            className={inputClass}
            keyboardType="number-pad"
            onChangeText={setMonthsPaidText}
            style={inputStyle()}
            value={monthsPaidText}
          />

          {/* Rental income (mortgage only) */}
          {activeTab === 'mortgage' && (
            <>
              <AppText className={labelClass}>
                {t('הכנסה מדמי שכירות (₪, אופציונלי)')}
              </AppText>
              <TextInput
                className={inputClass}
                keyboardType="decimal-pad"
                onChangeText={setRentalIncomeText}
                style={inputStyle()}
                value={rentalIncomeText}
              />
            </>
          )}

          {/* Notes */}
          <AppText className={labelClass}>
            {t('הערות (אופציונלי)')}
          </AppText>
          <TextInput
            className="min-h-20 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 dark:border-neutral-700 dark:bg-dark-surface dark:text-white"
            multiline
            onChangeText={setNotesText}
            style={inputStyle()}
            value={notesText}
          />

          {/* Form error */}
          {formError !== null && (
            <AppText
              className="text-sm font-bold text-red-600 dark:text-red-300"
            >
              {formError}
            </AppText>
          )}

          {/* Save / Cancel */}
          <View className="gap-2" style={rtl.row}>
            <Pressable
              accessibilityRole="button"
              className="min-h-[50px] flex-1 items-center justify-center rounded-lg bg-blue-600"
              onPress={saveLoan}
            >
              <AppText
                className="text-center text-base font-extrabold text-white"
              >
                {editingId === null ? t('הוסף הלוואה') : t('שמור שינויים')}
              </AppText>
            </Pressable>
            {editingId !== null && (
              <Pressable
                accessibilityRole="button"
                className="min-h-[50px] items-center justify-center rounded-lg border border-slate-300 px-4 dark:border-neutral-700"
                onPress={resetForm}
              >
                <AppText
                  className="text-center text-base font-bold text-slate-700 dark:text-slate-200"
                >
                  {t('ביטול')}
                </AppText>
              </Pressable>
            )}
          </View>

          {/* Loan list */}
          {filteredLoans.length === 0 ? (
            <View className="mt-4 items-center rounded-lg border border-slate-200 bg-white p-6 dark:border-neutral-700 dark:bg-dark-surface">
              <AppText
                className="text-center text-base text-slate-500 dark:text-slate-400"
              >
                {activeTab === 'mortgage'
                  ? t('לא נמצאה משכנתא. הוסף משכנתא למעלה.')
                  : t('לא נמצאו הלוואות. הוסף הלוואה למעלה.')}
              </AppText>
            </View>
          ) : (
            <View className="mt-4 gap-3">
              {filteredLoans.map((loan) => {
                const summary: LoanSummary = calculateLoanSummary(loan);
                const endDate = summary.projectedEndDate.slice(0, 10);

                return (
                  <View
                    className="rounded-lg border border-slate-300 bg-white p-4 dark:border-neutral-700 dark:bg-dark-surface"
                    key={loan.id}
                  >
                    <Pressable
                      accessibilityRole="button"
                      onPress={(): void => beginEdit(loan)}
                    >
                      <View className="items-center justify-between" style={rtl.row}>
                        <AppText
                          className="text-lg font-extrabold text-slate-900 dark:text-white"
                        >
                          {loan.lenderName}
                        </AppText>
                        <View className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-neutral-800">
                          <AppText
                            className="text-xs font-bold text-slate-600 dark:text-slate-300"
                          >
                            {t(LOAN_TYPE_LABELS[loan.loanType])}
                          </AppText>
                        </View>
                      </View>

                      <View className="mt-3 gap-1">
                        <View className="items-center justify-between" style={rtl.row}>
                          <AppText
                            className="text-sm font-bold text-slate-600 dark:text-slate-300"
                          >
                            {t('תשלום חודשי')}
                          </AppText>
                          <AppText
                            className="text-sm font-extrabold text-slate-900 dark:text-white"
                          >
                            {formatILS(summary.monthlyPayment)}
                          </AppText>
                        </View>

                        <View className="items-center justify-between" style={rtl.row}>
                          <AppText
                            className="text-sm font-bold text-slate-600 dark:text-slate-300"
                          >
                            {t('יתרה לתשלום')}
                          </AppText>
                          <AppText
                            className="text-sm font-extrabold text-slate-900 dark:text-white"
                          >
                            {formatILS(summary.remainingBalance)}
                          </AppText>
                        </View>

                        <View className="items-center justify-between" style={rtl.row}>
                          <AppText
                            className="text-sm font-bold text-slate-600 dark:text-slate-300"
                          >
                            {t('חודשים נותרו')}
                          </AppText>
                          <AppText
                            className="text-sm font-extrabold text-slate-900 dark:text-white"
                          >
                            {t('{{count}} חודשים', { count: summary.remainingMonths })}
                          </AppText>
                        </View>

                        <View className="items-center justify-between" style={rtl.row}>
                          <AppText
                            className="text-sm font-bold text-slate-600 dark:text-slate-300"
                          >
                            {t('סיום משוער')}
                          </AppText>
                          <AppText
                            className="text-sm font-extrabold text-slate-900 dark:text-white"
                          >
                            {endDate}
                          </AppText>
                        </View>

                        {summary.totalInterestRemaining > 0 && (
                          <View className="items-center justify-between" style={rtl.row}>
                            <AppText
                              className="text-sm font-bold text-slate-600 dark:text-slate-300"
                            >
                              {t('סה"כ ריבית נותרת')}
                            </AppText>
                            <AppText
                              className="text-sm font-extrabold text-amber-700 dark:text-amber-300"
                            >
                              {formatILS(summary.totalInterestRemaining)}
                            </AppText>
                          </View>
                        )}

                        {loan.rentalIncome !== undefined && loan.rentalIncome > 0 && (
                          <View className="items-center justify-between" style={rtl.row}>
                            <AppText
                              className="text-sm font-bold text-slate-600 dark:text-slate-300"
                            >
                              {t('הכנסה משכירות')}
                            </AppText>
                            <AppText
                              className="text-sm font-extrabold text-green-700 dark:text-green-300"
                            >
                              {formatILS(loan.rentalIncome)}
                            </AppText>
                          </View>
                        )}
                      </View>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      className="mt-3 min-h-[42px] items-center justify-center rounded-lg border border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950"
                      onPress={(): void => confirmDelete(loan)}
                    >
                      <AppText
                        className="text-center text-sm font-extrabold text-red-700 dark:text-red-200"
                      >
                        {t('מחיקה')}
                      </AppText>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          {/* Monthly impact summary */}
          <View
            className="mt-4 rounded-lg border p-4"
            style={{ borderColor: riskColor(impact.riskLevel) }}
          >
            <AppText
              className="mb-2 text-base font-extrabold text-slate-900 dark:text-white"
            >
              {t('השפעה חודשית כוללת')}
            </AppText>

            <View className="gap-1">
              <View className="items-center justify-between" style={rtl.row}>
                <AppText
                  className="text-sm font-bold text-slate-600 dark:text-slate-300"
                >
                  {t('סה"כ תשלום חודשי')}
                </AppText>
                <AppText
                  className="text-sm font-extrabold text-slate-900 dark:text-white"
                >
                  {formatILS(impact.totalMonthlyObligations)}
                </AppText>
              </View>

              <View className="items-center justify-between" style={rtl.row}>
                <AppText
                  className="text-sm font-bold text-slate-600 dark:text-slate-300"
                >
                  {t('אחוז מהכנסה')}
                </AppText>
                <AppText
                  className="text-sm font-extrabold"
                  style={{ color: riskColor(impact.riskLevel) }}
                >
                  {monthlyIncome > 0
                    ? `${impact.percentOfIncome.toFixed(1)}%`
                    : t('הכנסה לא הוגדרה')}
                </AppText>
              </View>

              <View className="items-center justify-between" style={rtl.row}>
                <AppText
                  className="text-sm font-bold text-slate-600 dark:text-slate-300"
                >
                  {t('רמת סיכון')}
                </AppText>
                <AppText
                  className="text-sm font-extrabold"
                  style={{ color: riskColor(impact.riskLevel) }}
                >
                  {t(riskLabel(impact.riskLevel))}
                </AppText>
              </View>

              <View className="items-center justify-between" style={rtl.row}>
                <AppText
                  className="text-sm font-bold text-slate-600 dark:text-slate-300"
                >
                  {t('הלוואות פעילות')}
                </AppText>
                <AppText
                  className="text-sm font-extrabold text-slate-900 dark:text-white"
                >
                  {t('{{count}} הלוואות', { count: impact.loansCount })}
                </AppText>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
