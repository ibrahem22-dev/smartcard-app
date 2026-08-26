/**
 * X2's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 * Spec §17: ranked rows from compareAbroad, unknown cards unranked, deltas only
 * when the engine supplies them (it currently does not — the surface must not subtract).
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { compareAbroad } from '../../../engines/fx';
import { FxCompareSheet } from '../FxCompareSheet';

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
      <FxCompareSheet
        comparison={comparison}
        displayNames={{ cheapest: 'Cheap', mid: 'Mid', unknown: 'Unknown' }}
      />
    </SafeAreaProvider>,
  );

type JsonNode = {
  readonly props?: { readonly testID?: string };
  readonly children?: JsonNode | readonly JsonNode[] | null;
};

function collectTestIds(node: unknown, acc: string[] = []): string[] {
  if (node === null || node === undefined) return acc;
  if (Array.isArray(node)) {
    for (const child of node) collectTestIds(child, acc);
    return acc;
  }
  if (typeof node !== 'object') return acc;
  const obj = node as JsonNode;
  const id = obj.props?.testID;
  if (typeof id === 'string' && id.length > 0) acc.push(id);
  collectTestIds(obj.children, acc);
  return acc;
}

describe('FX Compare — X2: ranked rows from compareAbroad', () => {
  it('renders ranked rows in the engine order, cheapest first', () => {
    const comparison = compareAbroad({
      amount: 1_000,
      currency: 'EUR',
      mode: 'purchase',
      rate: rate('EUR', 1, 4.02),
      cards: [
        { cardId: 'mid', fxPercent: 3 },
        { cardId: 'cheapest', fxPercent: 2 },
      ],
    });
    const tree = mount(comparison);
    const ids = comparison.ranked.map((entry) => entry.cardId);
    expect(ids[0]).toBe('cheapest');
    const painted = collectTestIds(tree.toJSON());
    const rowIds = ids.map((id) => `fx-compare-row-${id}`);
    expect(painted.filter((id) => rowIds.includes(id))).toEqual(rowIds);
    const winnerAt = painted.indexOf('fx-compare-winner');
    expect(winnerAt).toBeGreaterThan(painted.indexOf(rowIds[0]!));
    expect(winnerAt).toBeLessThan(painted.indexOf(rowIds[1]!));
  });

  it('unknown-leg cards are listed separately and never ranked', () => {
    const comparison = compareAbroad({
      amount: 1_000,
      currency: 'EUR',
      mode: 'purchase',
      rate: rate('EUR', 1, 4.02),
      cards: [
        { cardId: 'cheapest', fxPercent: 2 },
        { cardId: 'unknown' },
      ],
    });
    const { getByTestId, queryByTestId } = mount(comparison);
    expect(queryByTestId('fx-compare-row-unknown')).toBeNull();
    expect(getByTestId('fx-compare-unknown-unknown')).toBeTruthy();
    expect(comparison.unknownCards).toEqual(['unknown']);
  });

  it('paints the engine floor reason as the exemption and never invents a delta', () => {
    const comparison = compareAbroad({
      amount: 10_000,
      currency: 'JPY',
      mode: 'atm',
      rate: rate('JPY', 100, 186.97),
      cards: [{ cardId: 'cheapest', fxPercent: 2.9 }],
    });
    const { getByTestId, queryByTestId } = mount(comparison);
    expect(getByTestId('fx-compare-exemption-cheapest').props.children).toBe(
      'MINOR_CURRENCY_DOUBLE_CONVERSION_UNPRICED',
    );
    expect(queryByTestId('fx-compare-delta-cheapest')).toBeNull();
  });

  it('the painted total is the engine effectiveIls, not a surface recomputation', () => {
    const comparison = compareAbroad({
      amount: 1_000,
      currency: 'EUR',
      mode: 'purchase',
      rate: rate('EUR', 1, 4.02),
      cards: [{ cardId: 'cheapest', fxPercent: 2 }],
    });
    const { getByTestId } = mount(comparison);
    const expected = comparison.ranked[0]?.quote.effectiveIls;
    expect(getByTestId('fx-compare-total-cheapest').props.accessibilityValue?.text).toBe(
      String(expected),
    );
  });
});
