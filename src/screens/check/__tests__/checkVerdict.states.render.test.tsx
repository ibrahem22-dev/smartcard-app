/**
 * D1's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 * Four states, each icon + word + colour. Colour is never the only carrier: the
 * accessibility label carries the word, and the icon is its own node.
 *
 * Every result painted here came from `runPurchaseCheck` (the B1 seam). This suite
 * does not invent a pill.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CheckVerdictScreen, VERDICT_PILL } from '../CheckVerdictScreen';
import { runPurchaseCheck, type PurchaseCheckContext } from '../../../check/runPurchaseCheck';
import type { CheckInputDraft } from '../CheckInputScreen';
import { Currency } from '../../../types/purchase.types';
import type { PurchaseVerdict } from '../../../engines/verdict';
import { ROLE_BORDER, ROLE_SURFACE_BG } from '../../../theme/tokens';

const draft = (amount: number): CheckInputDraft => ({
  amount,
  currency: Currency.ILS,
  category: null,
  installments: null,
  cardId: null,
});

const context = (overrides: Partial<PurchaseCheckContext> = {}): PurchaseCheckContext => ({
  monthlyIncomeIls: { value: 10_000, provenance: 'USER' },
  commitments: [{ commitmentId: 'rent', monthlyAmountIls: { value: 2_000, provenance: 'USER' } }],
  ...overrides,
});

const RESULTS: { readonly verdict: PurchaseVerdict; readonly result: ReturnType<typeof runPurchaseCheck> }[] = [
  { verdict: 'good_to_go', result: runPurchaseCheck(draft(1_500), context()) },
  { verdict: 'caution', result: runPurchaseCheck(draft(1_501), context()) },
  { verdict: 'dont_buy_now', result: runPurchaseCheck(draft(3_001), context()) },
  {
    verdict: 'wait_until_billing_passes',
    result: runPurchaseCheck(
      draft(3_000),
      context({
        imminentBilling: {
          date: '2026-09-02',
          commitmentsClearingIls: { value: 2_000, provenance: 'USER' },
        },
      }),
    ),
  },
];

const mount = (verdict: PurchaseVerdict) => {
  const row = RESULTS.find((r) => r.verdict === verdict);
  if (row === undefined) {
    throw new Error('no engine result for ' + verdict);
  }
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <CheckVerdictScreen result={row.result} />
    </SafeAreaProvider>,
  );
};

describe('Check Verdict — D1: four states, icon + word + colour', () => {
  it('produces all four engine states for this suite, so every pill is a real verdict', () => {
    const seen = new Set(RESULTS.map((row) => row.result.verdict));
    expect(RESULTS.map((row) => row.result.verdict)).toEqual(RESULTS.map((row) => row.verdict));
    expect(seen.size).toBe(Object.keys(VERDICT_PILL).length);
    expect(seen.size).toBe(4);
  });

  it('renders good_to_go with an icon, a word and the positive colour role', () => {
    const { getByTestId } = mount('good_to_go');
    const pill = getByTestId('check-verdict-pill-good_to_go');
    const word = String(getByTestId('check-verdict-pill-word').props.children);
    expect(getByTestId('check-verdict-pill-icon').props.children).toBe(VERDICT_PILL.good_to_go.icon);
    expect(word.length).toBeGreaterThan(0);
    // The role's meaning moved from the panel's fill to its BOUNDARY when the frozen palette
    // landed (OQ-MDC-028 option 1): the frozen system has no semantic surface, so every role
    // now sits on the same neutral ground and is told apart by border and text. Asserting the
    // ROLE token rather than a hue family is what makes this survive the next palette too.
    expect(String(pill.props.className)).toContain(ROLE_BORDER.positive);
    expect(String(pill.props.className)).toContain(ROLE_SURFACE_BG.positive);
    expect(pill.props.accessibilityLabel).toContain(word);
  });

  it('renders caution with an icon, a word and the advisory colour role', () => {
    const { getByTestId } = mount('caution');
    const pill = getByTestId('check-verdict-pill-caution');
    const word = String(getByTestId('check-verdict-pill-word').props.children);
    expect(getByTestId('check-verdict-pill-icon').props.children).toBe(VERDICT_PILL.caution.icon);
    expect(word.length).toBeGreaterThan(0);
    // The role's meaning moved from the panel's fill to its BOUNDARY when the frozen palette
    // landed (OQ-MDC-028 option 1): the frozen system has no semantic surface, so every role
    // now sits on the same neutral ground and is told apart by border and text. Asserting the
    // ROLE token rather than a hue family is what makes this survive the next palette too.
    expect(String(pill.props.className)).toContain(ROLE_BORDER.advisory);
    expect(String(pill.props.className)).toContain(ROLE_SURFACE_BG.advisory);
    expect(pill.props.accessibilityLabel).toContain(word);
  });

  it('renders dont_buy_now with an icon, a word and the danger colour role', () => {
    const { getByTestId } = mount('dont_buy_now');
    const pill = getByTestId('check-verdict-pill-dont_buy_now');
    const word = String(getByTestId('check-verdict-pill-word').props.children);
    expect(getByTestId('check-verdict-pill-icon').props.children).toBe(VERDICT_PILL.dont_buy_now.icon);
    expect(word.length).toBeGreaterThan(0);
    // The role's meaning moved from the panel's fill to its BOUNDARY when the frozen palette
    // landed (OQ-MDC-028 option 1): the frozen system has no semantic surface, so every role
    // now sits on the same neutral ground and is told apart by border and text. Asserting the
    // ROLE token rather than a hue family is what makes this survive the next palette too.
    expect(String(pill.props.className)).toContain(ROLE_BORDER.danger);
    expect(String(pill.props.className)).toContain(ROLE_SURFACE_BG.danger);
    expect(pill.props.accessibilityLabel).toContain(word);
  });

  it('renders wait_until_billing_passes with an icon, a word and the slate colour role', () => {
    const { getByTestId } = mount('wait_until_billing_passes');
    const pill = getByTestId('check-verdict-pill-wait_until_billing_passes');
    const word = String(getByTestId('check-verdict-pill-word').props.children);
    expect(getByTestId('check-verdict-pill-icon').props.children).toBe(
      VERDICT_PILL.wait_until_billing_passes.icon,
    );
    expect(word.length).toBeGreaterThan(0);
    // The role's meaning moved from the panel's fill to its BOUNDARY when the frozen palette
    // landed (OQ-MDC-028 option 1): the frozen system has no semantic surface, so every role
    // now sits on the same neutral ground and is told apart by border and text. Asserting the
    // ROLE token rather than a hue family is what makes this survive the next palette too.
    expect(String(pill.props.className)).toContain(ROLE_BORDER.neutral);
    expect(String(pill.props.className)).toContain(ROLE_SURFACE_BG.neutral);
    expect(pill.props.accessibilityLabel).toContain(word);
    expect(getByTestId('check-verdict-wait-date').props.children).toBe('2026-09-02');
  });

  it('colour is never the only carrier — the label always carries the word and the icon', () => {
    for (const row of RESULTS) {
      const { getByTestId } = mount(row.verdict);
      const pill = getByTestId(`check-verdict-pill-${row.verdict}`);
      const copy = VERDICT_PILL[row.verdict];
      const word = String(getByTestId('check-verdict-pill-word').props.children);
      expect(word.length).toBeGreaterThan(0);
      expect(pill.props.accessibilityLabel).toBe(`${copy.icon} ${word}`);
      expect(getByTestId('check-verdict-pill-icon')).toBeTruthy();
      expect(getByTestId('check-verdict-pill-word')).toBeTruthy();
    }
  });
});
