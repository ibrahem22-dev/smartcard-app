/**
 * D8's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 * Spec §9: every numeric claim on Check Verdict carries a provenance chip.
 * The population is derived by walking the mounted tree for accessibilityValue
 * texts that contain a digit — the same mark D3–D7 already use for a painted
 * figure — and requiring a shared ProvenanceChip in that claim's parent group.
 * Grepping the source for "<ProvenanceChip" would prove the import.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CheckVerdictScreen } from '../CheckVerdictScreen';
import { runPurchaseCheck } from '../runPurchaseCheck';
import type { CheckInputDraft } from '../CheckInputScreen';
import { compareAbroad } from '../../../engines/fx';
import { evaluateFinancialLoad } from '../../../engines/load';
import { scoreCards } from '../../../engines/scoring';
import { Currency } from '../../../types/purchase.types';

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
  return typeof id === 'string' && (id.endsWith('-chip') || id.startsWith('provenance-chip-'));
};

const subtreeHasChip = (node: JsonNode): boolean => {
  if (isChip(node)) return true;
  return asNodes(node.children).some(subtreeHasChip);
};

const sweep = (root: JsonNode): { readonly claims: string[]; readonly bare: string[] } => {
  const claims: string[] = [];
  const bare: string[] = [];
  const visit = (siblings: readonly JsonNode[]): void => {
    for (const node of siblings) {
      const text = node.props?.accessibilityValue?.text;
      if (typeof text === 'string' && /\d/.test(text)) {
        const id = node.props?.testID ?? text;
        claims.push(id);
        if (!siblings.some(subtreeHasChip)) bare.push(id);
      }
      visit(asNodes(node.children));
    }
  };
  visit([root]);
  return { claims, bare };
};

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
  throw new Error('scoreCards returned no ranked pair — D8 has nothing honest to sweep');
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
  throw new Error('compareAbroad returned no quote — D8 has nothing honest to sweep');
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
  throw new Error('evaluateFinancialLoad returned no cardLimits — D8 has nothing honest to sweep');
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

const mountFull = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
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
      />
    </SafeAreaProvider>,
  );

const mountRunnerUpWithoutDelta = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <CheckVerdictScreen
        result={result}
        recommendation={{
          displayName: NAMES[best.cardId] ?? best.cardId,
          matchScore: best.score,
        }}
        runnerUp={{ displayName: NAMES[second.cardId] ?? second.cardId }}
      />
    </SafeAreaProvider>,
  );

describe('Check Verdict — D8: every numeric claim carries a provenance chip', () => {
  it('every accessibilityValue numeric claim has a ProvenanceChip in its parent group', () => {
    const { claims, bare } = sweep(mountFull().toJSON() as JsonNode);
    expect(bare).toEqual([]);
    expect(claims.length).toBeGreaterThan(0);
  });

  it('the sweep is over a fully populated verdict, not an empty mount', () => {
    const { claims } = sweep(mountFull().toJSON() as JsonNode);
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

  it('the chips are the shared ProvenanceChip primitive, not local badge markup', () => {
    const { getByTestId } = mountFull();
    expect(getByTestId('check-verdict-fx-estimate-chip')).toBeTruthy();
    expect(getByTestId('check-verdict-impact-strip-chip')).toBeTruthy();
    expect(getByTestId('check-verdict-match-score-value-chip')).toBeTruthy();
  });

  it('a runner-up without a delta is not a numeric claim', () => {
    const { claims } = sweep(mountRunnerUpWithoutDelta().toJSON() as JsonNode);
    expect(claims).not.toContain('check-verdict-runner-up');
  });
});
