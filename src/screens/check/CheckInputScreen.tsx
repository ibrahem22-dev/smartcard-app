import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { RtlButton, RtlRow, RtlScreen } from '../../components/rtl';
import { useTranslation } from '../../hooks/useTranslation';
import { ACCENT, BORDER, ROLE_TEXT, SURFACE, TEXT } from '../../theme/tokens';
import { Currency, type PurchaseCategory } from '../../types/purchase.types';

/**
 * CHECK INPUT — the root of the P4 Check stack, built to criterion **C1 and to nothing else**.
 *
 *   > **C1.** *"Amount greater than zero and currency are required with the shekel as default;
 *   > category, plan and card preselect are optional."*  (spec §8)
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS SCREEN DELIBERATELY DOES NOT DO, AND WHO OWNS EACH ABSENCE
 *
 * Spec §8 describes far more than C1: a ≤4-tap layout with a custom keypad, category chips and a
 * collapsed card picker (**C2**); an installments stepper with a ≈₪/month preview (**C3**);
 * foreign-currency selection auto-activating the FX lane and the Bank of Israel reference line
 * (**C4**); a benefit-hint chip that appears only on a real match (**C5**). None of them is here.
 * Each is a separate criterion with its own gate, and building one early would put a guess in the
 * diff where a decision belongs — indistinguishable afterwards from work that was actually owed.
 *
 * The currency control is the minimum that makes C1's own sentence true: the shekel is already
 * chosen before anybody touches anything, and the other currencies the type defines can be picked.
 * The *designed* switcher, and what selecting a foreign currency then ACTIVATES, are C2's and C4's.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * NO NUMBER HERE WAS COMPUTED HERE — contract §5 B1, spec §20
 *
 * *"No surface holds recommendation logic."* This screen reads what the user typed and decides one
 * thing about it: whether it is a usable amount. That is INPUT VALIDATION — the question C1 asks —
 * and it derives nothing. No threshold, no total, no monthly payment, no ranking, no percentage.
 * The purchase draft leaves here as the user's own figures; every number the flow later SHOWS comes
 * back from an engine call, and that seam is WP-1.3's.
 *
 * Where the draft goes is likewise not decided here. `onCheck` hands it to the caller, because the
 * verdict screen and its navigation params are WP-1.4's to define, and a screen that invented them
 * would be answering a question the next work package owns.
 */

/** The optional halves of C1, carried as fields so "optional" is structural and not implied. */
export interface CheckInputDraft {
  /** What the user typed, parsed. Always > 0 — an unusable amount never produces a draft. */
  readonly amount: number;
  /** Required by C1, and never unset: the shekel is the default before any user action. */
  readonly currency: Currency;
  /** Optional (spec §8: improves benefit matching and scoring). The chips that set it are C2's. */
  readonly category: PurchaseCategory | null;
  /** Optional. Number of תשלומים; one payment is the default. The stepper that sets it is C3's. */
  readonly installments: number | null;
  /** Optional (spec §8: "default: recommend"). The collapsed card picker that sets it is C2's. */
  readonly cardId: string | null;
}

export interface CheckInputScreenProps {
  /**
   * Called with the draft when the contract is satisfied and the user asks for the check.
   * Optional: until WP-1.3 wires the engine seam there is nobody to call, and a required
   * dependency that nothing can supply yet would make this screen unmountable.
   */
  readonly onCheck?: (draft: CheckInputDraft) => void;
}

/**
 * The currencies the app has, DERIVED from the type rather than listed here. A currency added to
 * `Currency` appears in this control on the next render instead of quietly missing from it.
 */
const CURRENCIES: readonly Currency[] = Object.values(Currency);

/** How each currency is written. `Record` makes a new member a compile error, not a blank chip. */
const CURRENCY_SYMBOL: Readonly<Record<Currency, string>> = {
  [Currency.ILS]: '₪',
  [Currency.USD]: '$',
  [Currency.EUR]: '€',
};

/**
 * C1's amount clause, and the whole of it: greater than zero, actually a number, actually typed.
 *
 * `Number('')` is 0 and `Number('  ')` is 0, so an empty field would otherwise parse to a value
 * and be refused only by luck of the comparison. It is refused deliberately instead.
 */
const parseTypedAmount = (typed: string): number | null => {
  const trimmed = typed.trim();
  if (trimmed === '') {
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
};

export function CheckInputScreen({ onCheck }: CheckInputScreenProps): React.ReactElement {
  const { t } = useTranslation();

  const [typedAmount, setTypedAmount] = useState<string>('');
  const [currency, setCurrency] = useState<Currency>(Currency.ILS);

  const amount = useMemo((): number | null => parseTypedAmount(typedAmount), [typedAmount]);
  const canCheck = amount !== null;

  const check = useCallback((): void => {
    if (amount === null) {
      return;
    }
    onCheck?.({
      amount,
      currency,
      // C1's optional half, unset. C2 and C3 own the controls that fill these in.
      category: null,
      installments: null,
      cardId: null,
    });
  }, [amount, currency, onCheck]);

  return (
    <RtlScreen className={SURFACE.page} safe>
      <View className={`m-3 rounded-lg border p-4 ${SURFACE.card} ${BORDER.hairline}`}>
        <AppText className={`text-lg font-extrabold ${TEXT.heading}`}>{t('בדיקת רכישה')}</AppText>

        <AppText className={`mt-4 text-sm font-bold ${TEXT.body}`}>{t('סכום הרכישה')}</AppText>
        <TextInput
          accessibilityLabel={t('סכום הרכישה')}
          className={`mt-1 rounded-lg border p-3 text-lg ${SURFACE.sunken} ${BORDER.hairline}`}
          keyboardType="decimal-pad"
          onChangeText={setTypedAmount}
          testID="check-input-amount"
          value={typedAmount}
        />

        <AppText className={`mt-4 text-sm font-bold ${TEXT.body}`}>{t('מטבע')}</AppText>
        {/* rtl-ok */}
        <RtlRow className="mt-1 gap-2">
          {CURRENCIES.map((option: Currency) => {
            const selected = option === currency;
            return (
              <Pressable
                accessibilityLabel={CURRENCY_SYMBOL[option] + ' ' + option}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`rounded-lg border px-3 py-2 ${
                  selected ? `${ACCENT.surface} ${ACCENT.border}` : `${SURFACE.sunken} ${BORDER.hairline}`
                }`}
                key={option}
                onPress={(): void => setCurrency(option)}
                testID={`check-input-currency-${option}`}
              >
                <AppText className={`text-sm font-bold ${selected ? ACCENT.text : TEXT.body}`}>
                  {CURRENCY_SYMBOL[option] + ' ' + option}
                </AppText>
              </Pressable>
            );
          })}
        </RtlRow>

        {/*
          The refusal is ADVISORY and not danger: nothing is wrong with the user's money, the screen
          simply has not been given the one thing C1 requires. The word carries it, not the colour.
        */}
        {!canCheck ? (
          <AppText className={`mt-4 text-sm font-bold ${ROLE_TEXT.advisory}`} testID="check-input-refusal">
            {t('צריך סכום גדול מאפס כדי להמשיך')}
          </AppText>
        ) : null}

        <AppText className={`mt-2 text-xs ${TEXT.muted}`}>
          {t('קטגוריה, תשלומים ובחירת כרטיס אינם חובה')}
        </AppText>

        <RtlButton
          accessibilityRole="button"
          accessibilityState={{ disabled: !canCheck }}
          className={`mt-4 items-center rounded-lg p-3 ${canCheck ? ACCENT.solid : SURFACE.raised}`}
          disabled={!canCheck}
          label={t('בדוק רכישה')}
          labelClassName={`text-base font-extrabold ${canCheck ? TEXT.onAccent : TEXT.muted}`}
          onPress={check}
          testID="check-input-submit"
        />
      </View>
    </RtlScreen>
  );
}
