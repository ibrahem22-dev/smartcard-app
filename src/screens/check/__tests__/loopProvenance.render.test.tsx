/**
 * R5's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 * Contract §12: every figure in the loop carries a provenance chip, as a derived
 * sweep of the rendered surfaces. §12.1: any asset resolving above the generated
 * tier carries its attribution and its provenance chip.
 *
 * Population: accessibilityValue texts that contain a digit, walked on Check
 * Input, Check Verdict and FX Compare. Media: CardTile mounted generated vs a
 * CLEARED benefit-lane fixture (spec §3 still forbids card-brand artwork).
 * Grepping source for "<ProvenanceChip" would prove the import.
 */
import React from 'react';
import { View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppText } from '../../../components/AppText';
import { CardTile } from '../../../components/CardTile';
import { CheckInputScreen, type CheckInputDraft, type CheckInputFxReference } from '../CheckInputScreen';
import { CheckVerdictScreen } from '../CheckVerdictScreen';
import { runPurchaseCheck } from '../../../check/runPurchaseCheck';
import { FxCompareSheet } from '../../fx/FxCompareSheet';
import { compareAbroad } from '../../../engines/fx';
import { evaluateFinancialLoad } from '../../../engines/load';
import { scoreCards } from '../../../engines/scoring';
import { Currency } from '../../../types/purchase.types';
import type { MediaRecord, MediaSubject } from '../../../media/types';

type JsonNode = {
  readonly props?: {
    readonly testID?: string;
    readonly accessibilityValue?: { readonly text?: string };
  };
  readonly children?: JsonNode | readonly JsonNode[] | string | number | null;
};

const asNodes = (children: unknown): JsonNode[] => {
  if (children === null || children === undefined) return [];
  if (typeof children === 'string' || typeof children === 'number') return [];
  if (Array.isArray(children)) {
    const out: JsonNode[] = [];
    for (const child of children) {
      if (Array.isArray(child)) out.push(...asNodes(child));
      else if (child !== null && typeof child === 'object') out.push(child as JsonNode);
    }
    return out;
  }
  if (typeof children === 'object') return [children as JsonNode];
  return [];
};

const isChip = (node: JsonNode): boolean => {
  const id = node.props?.testID;
  if (typeof id !== 'string') return false;
  // X3: the BOI reference is a NEUTRAL badge, not the dashed Estimate chip.
  return id.endsWith('-chip') || id.startsWith('provenance-chip-') || id === 'fx-compare-reference';
};

const subtreeHasChip = (node: JsonNode): boolean => {
  if (isChip(node)) return true;
  return asNodes(node.children).some(subtreeHasChip);
};

const sweep = (root: JsonNode): { readonly claims: string[]; readonly bare: string[] } => {
  const claims: string[] = [];
  const bare: string[] = [];
  const visit = (siblings: readonly JsonNode[], parent: JsonNode | undefined): void => {
    for (const node of siblings) {
      const text = node.props?.accessibilityValue?.text;
      if (typeof text === 'string' && /\d/.test(text)) {
        const id = node.props?.testID ?? text;
        claims.push(id);
        const grouped = siblings.some(subtreeHasChip) || isChip(node) || (parent !== undefined && isChip(parent));
        if (!grouped) bare.push(id);
      }
      visit(asNodes(node.children), node);
    }
  };
  visit([root], undefined);
  return { claims, bare };
};

const safe = (child: React.ReactElement) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      {child}
    </SafeAreaProvider>,
  );

const NAMES: { readonly [cardId: string]: string } = {
  best: 'Max',
  middle: 'Club',
  worst: 'Basic',
};

const scored = scoreCards({
  cards: [
    { cardId: 'middle', available: true, costIls: { value: 110, provenance: 'VERIFIED' } },
    { cardId: 'best', available: true, costIls: { value: 100, provenance: 'VERIFIED' } },
    { cardId: 'worst', available: true, costIls: { value: 120, provenance: 'VERIFIED' } },
  ],
});
const best = scored.ranked[0];
const second = scored.ranked[1];
if (best === undefined || second === undefined) {
  throw new Error('scoreCards returned no ranked pair — R5 has nothing honest to sweep');
}

const rate = {
  currency: 'EUR',
  quoteUnit: 1,
  rateIlsPerQuoteUnit: 4.02,
  rateDate: '2026-08-24',
  fetchDate: '2026-08-24',
  source: 'BUNDLED',
  provenance: 'ESTIMATE',
  rateBasis: 'BOI_REPRESENTATIVE',
} as const;

const quote = compareAbroad({
  amount: 1_000,
  currency: 'EUR',
  mode: 'purchase',
  rate,
  cards: [{ cardId: 'cheapest', fxPercent: 2.0 }],
}).ranked[0]?.quote;
if (quote === undefined) {
  throw new Error('compareAbroad returned no quote — R5 has nothing honest to sweep');
}

const load = evaluateFinancialLoad({
  monthlyIncomeIls: { value: 10_000, provenance: 'USER' },
  commitments: [
    {
      commitmentId: 'plan',
      monthlyAmountIls: { value: 500, provenance: 'USER' },
      linkedCardId: 'card-a',
      remainingHoldIls: { value: 4_000, provenance: 'USER' },
    },
  ],
  cards: [
    {
      cardId: 'card-a',
      creditLimitIls: { value: 10_000, provenance: 'USER' },
      loggedThisCyclePurchasesIls: { value: 1_000, provenance: 'USER' },
    },
  ],
  prospectiveCommitment: {
    commitmentId: 'this-purchase',
    monthlyAmountIls: { value: 200, provenance: 'USER' },
    linkedCardId: 'card-a',
    remainingHoldIls: { value: 1_500, provenance: 'USER' },
  },
});
const position = load.cardLimits[0];
if (position === undefined) {
  throw new Error('evaluateFinancialLoad returned no cardLimits — R5 has nothing honest to sweep');
}

const draft: CheckInputDraft = {
  amount: 1_500,
  currency: Currency.ILS,
  category: null,
  installments: 3,
  cardId: null,
};

const result = runPurchaseCheck(draft, {
  monthlyIncomeIls: { value: 10_000, provenance: 'USER' },
  commitments: [{ commitmentId: 'rent', monthlyAmountIls: { value: 2_000, provenance: 'USER' } }],
});

const fxReference: CheckInputFxReference = {
  rateIlsPerQuoteUnit: 3.72,
  rateDate: '2026-08-24',
};

const comparison = compareAbroad({
  amount: 1_000,
  currency: 'EUR',
  mode: 'purchase',
  rate,
  cards: [{ cardId: 'cheapest', fxPercent: 2.0, fixedFeeIls: 3 }],
});

const merchant: MediaSubject = {
  subjectKind: 'merchant',
  subjectId: 'merchant:shufersal',
  fallbackClass: 'benefit',
};

const clearedAsset: MediaRecord = {
  assetId: 'a1b2c3d4e5f60718',
  mediaKind: 'MERCHANT_LOGO',
  subjectKind: 'merchant',
  subjectId: 'merchant:shufersal',
  fallbackClass: 'benefit',
  rightsState: 'CLEARED',
  rightsBasis: 'commissioned in-house; owned outright',
  rightsDecidedBy: 'Ibrahim Abu Nasser (Owner)',
  rightsDecidedAt: '2026-08-25',
  attribution: 'in-house commission',
  altTextKey: 'ייצוג הטבה לפי קטגוריה',
  aspectRatio: '8:5',
  provenanceChip: 'VERIFIED',
};

const mountVerdict = () =>
  safe(
    <CheckVerdictScreen
      result={result}
      contextLine={{
        amount: draft.amount,
        currencySymbol: '₪',
        categoryLabel: null,
        installmentCount: 3,
      }}
      recommendation={{
        displayName: NAMES[best.cardId] ?? best.cardId,
        matchScore: best.score,
      }}
      runnerUp={{
        displayName: NAMES[second.cardId] ?? second.cardId,
        ...(second.deltaFromBestIls !== undefined
          ? { deltaFromBestIls: second.deltaFromBestIls }
          : {}),
      }}
      fxBlock={{ quote }}
      impactStrip={{ availableAfterPurchaseIls: position.availableAfterChangesIls }}
    />,
  );

describe('Loop — R5: every figure carries a provenance chip; above-generated media is attributed', () => {
  it('every Check Input numeric claim has a ProvenanceChip in its parent group', () => {
    const mounted = safe(<CheckInputScreen asOfDate="2026-08-30" fxReference={fxReference} />);
    fireEvent.press(mounted.getByTestId(`check-input-currency-${Currency.EUR}`));
    fireEvent.press(mounted.getByTestId('check-input-plan-installments'));
    fireEvent.changeText(mounted.getByTestId('check-input-amount'), '1200');
    const { claims, bare } = sweep(mounted.toJSON() as JsonNode);
    expect(bare).toEqual([]);
    expect(claims).toEqual(expect.arrayContaining([
      'check-input-fx-rate',
      'check-input-stepper-count',
      'check-input-monthly-preview',
    ]));
    expect(mounted.getByTestId('check-input-fx-rate-chip')).toBeTruthy();
    expect(mounted.getByTestId('check-input-stepper-count-chip')).toBeTruthy();
    expect(mounted.getByTestId('check-input-monthly-preview-chip')).toBeTruthy();
  });

  it('every Check Verdict numeric claim has a ProvenanceChip in its parent group', () => {
    const mounted = mountVerdict();
    const { claims, bare } = sweep(mounted.toJSON() as JsonNode);
    expect(bare).toEqual([]);
    expect(claims).toEqual(expect.arrayContaining([
      'check-verdict-context',
      'check-verdict-match-score-value',
      'check-verdict-runner-up',
      'check-verdict-fx-rate',
      'check-verdict-fx-fee',
      'check-verdict-fx-estimate',
      'check-verdict-impact-strip',
    ]));
  });

  it('every FX Compare numeric claim has a chip in its parent group, including the open explainer', () => {
    const mounted = safe(<FxCompareSheet comparison={comparison} />);
    fireEvent.press(mounted.getByTestId('fx-compare-explainer-toggle'));
    const { claims, bare } = sweep(mounted.toJSON() as JsonNode);
    expect(bare).toEqual([]);
    expect(claims).toEqual(expect.arrayContaining([
      'fx-compare-reference-rate',
      'fx-compare-total-cheapest',
      'fx-compare-explainer-base',
      'fx-compare-explainer-markup',
      'fx-compare-explainer-fixed',
      'fx-compare-explainer-total',
    ]));
    expect(mounted.getByTestId('fx-compare-estimate-chip')).toBeTruthy();
    expect(mounted.getByTestId('fx-compare-explainer-chip')).toBeTruthy();
  });

  it('a generated CardTile does not wear collected-asset attribution', () => {
    const { queryByTestId } = render(
      <CardTile nickname="Max Gold" subject={{
        subjectKind: 'card',
        subjectId: 'card:max:gold',
        fallbackClass: 'card',
      }} />,
    );
    expect(queryByTestId('card-tile-attribution')).toBeNull();
    expect(queryByTestId('card-tile-attribution-chip')).toBeNull();
  });

  it('an asset resolving above the generated tier carries attribution and a provenance chip', () => {
    const { getByTestId } = render(
      <CardTile nickname="Shufersal" subject={merchant} mediaSet={[clearedAsset]} />,
    );
    expect(getByTestId('card-tile-attribution').props.children).toBe('in-house commission');
    expect(getByTestId('card-tile-attribution-chip')).toBeTruthy();
  });

  it('a planted bare number is detected as bare — the sweep is not a vacuous pass', () => {
    const { toJSON } = render(
      <View>
        <AppText accessibilityValue={{ text: '42' }} testID="planted-bare-figure">
          42
        </AppText>
      </View>,
    );
    const { claims, bare } = sweep(toJSON() as JsonNode);
    expect(claims).toContain('planted-bare-figure');
    expect(bare).toContain('planted-bare-figure');
  });
});
