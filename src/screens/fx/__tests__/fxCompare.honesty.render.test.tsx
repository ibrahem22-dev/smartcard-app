/**
 * X3's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 * Spec §17: the BOI reference-rate chip is structurally separate from the dashed
 * Estimate chip. The reference is not the real card cost. The settlement caveat
 * is persistent copy.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { compareAbroad } from '../../../engines/fx';
import { FxCompareSheet } from '../FxCompareSheet';
import { ROLE_BORDER, ROLE_TEXT } from '../../../theme/tokens';

const rate = (currency: string, quoteUnit: number, rateIlsPerQuoteUnit: number) => ({
  currency,
  quoteUnit,
  rateIlsPerQuoteUnit,
  rateDate: '2026-08-24',
  fetchDate: '2026-08-24',
  source: 'BUNDLED' as const,
  provenance: 'ESTIMATE' as const,
  rateBasis: 'BOI_REPRESENTATIVE' as const,
});

const mount = (comparison: ReturnType<typeof compareAbroad>) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <FxCompareSheet comparison={comparison} />
    </SafeAreaProvider>,
  );

function walkHost(node: unknown, visit: (n: { props?: Record<string, unknown>; children?: unknown }) => void): void {
  if (node === null || node === undefined) return;
  if (typeof node === 'string' || typeof node === 'number') return;
  if (Array.isArray(node)) {
    for (const child of node) walkHost(child, visit);
    return;
  }
  if (typeof node !== 'object') return;
  const obj = node as { props?: Record<string, unknown>; children?: unknown };
  visit(obj);
  walkHost(obj.children, visit);
  walkHost(obj.props?.children, visit);
}

function collectTestIds(node: unknown): string[] {
  const acc: string[] = [];
  walkHost(node, (n) => {
    const id = n.props?.testID;
    if (typeof id === 'string' && id.length > 0) acc.push(id);
  });
  return acc;
}

function collectClassNames(node: unknown): string[] {
  const acc: string[] = [];
  walkHost(node, (n) => {
    const cn = n.props?.className;
    if (typeof cn === 'string' && cn.length > 0) acc.push(cn);
  });
  return acc;
}

function collectText(node: unknown): string[] {
  const acc: string[] = [];
  const visit = (value: unknown): void => {
    if (value === null || value === undefined) return;
    if (typeof value === 'string' || typeof value === 'number') {
      acc.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }
    if (typeof value === 'object') {
      const obj = value as { props?: { children?: unknown }; children?: unknown };
      visit(obj.children);
      visit(obj.props?.children);
    }
  };
  visit(node);
  return acc;
}

describe('FX Compare — X3: reference is not the estimated real cost', () => {
  const comparison = compareAbroad({
    amount: 1_000,
    currency: 'EUR',
    mode: 'purchase',
    rate: rate('EUR', 1, 4.02),
    cards: [{ cardId: 'cheapest', fxPercent: 2 }],
  });

  it('paints the engine rateUsed on a neutral reference chip, not a surface invention', () => {
    const { getByTestId } = mount(comparison);
    const used = comparison.ranked[0]?.quote.rateUsed;
    expect(used).toBeDefined();
    expect(getByTestId('fx-compare-reference-rate').props.accessibilityValue?.text).toBe(
      `${used!.rateIlsPerQuoteUnit}|${used!.rateDate}`,
    );
    const classes = collectClassNames(getByTestId('fx-compare-reference')).join(' ');
    // A neutral reference chip is a ROLE, not a hue family. It was pinned to the word `slate`,
    // which the frozen palette does not contain; the role token says the same thing and keeps
    // saying it. The negative below is what carries the real claim: no estimate framing.
    expect(classes).toContain(ROLE_TEXT.neutral);
    expect(classes).not.toContain(ROLE_BORDER.advisory);
    expect(classes).not.toMatch(/border-dashed/);
  });

  it('keeps the dashed Estimate chip structurally outside the reference lane', () => {
    const { getByTestId } = mount(comparison);
    const referenceIds = collectTestIds(getByTestId('fx-compare-reference'));
    expect(referenceIds).not.toContain('fx-compare-estimate-chip');
    expect(referenceIds).not.toContain('fx-compare-estimate-frame');
    expect(getByTestId('fx-compare-estimate-chip')).toBeTruthy();
    const frameClasses = collectClassNames(getByTestId('fx-compare-estimate-frame')).join(' ');
    expect(frameClasses).toMatch(/border-dashed/);
  });

  it('paints the network-settlement caveat as persistent copy', () => {
    const { getByTestId } = mount(comparison);
    const text = collectText(getByTestId('fx-compare-settlement-caveat')).join(' ');
    expect(text).toMatch(/Visa\/Mastercard/);
    expect(text).toMatch(/Bank of Israel/);
  });

  it('does not label the reference rate as the estimated real cost', () => {
    const { getByTestId } = mount(comparison);
    const text = collectText(getByTestId('fx-compare-reference')).join(' ');
    expect(text).not.toMatch(/Estimated real cost/i);
    expect(text).not.toMatch(/real cost/i);
    const ids = collectTestIds(getByTestId('fx-compare-reference'));
    expect(ids.some((id) => id.includes('estimate'))).toBe(false);
  });
});
