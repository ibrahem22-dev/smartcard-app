import React from 'react';
import { act, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { arBySource } from '../../../i18n/ar';
import { en, enBySource } from '../../../i18n/en';
import { useCardsStore } from '../../../store/useCardsStore';
import {
  evaluateSurfaceEngines,
  type SurfaceContext,
  type SurfaceEngineResults,
} from '../../../surfaces';
import {
  CardIssuer,
  CardNetwork,
  type EngineCard,
} from '../../../types/card.types';
import { Currency } from '../../../types/purchase.types';
import { SectionCWhenBest } from '../SectionCWhenBest';
import { bestForChipsFor } from '../bestForChips';

const fakeDb = {
  execSync: (): void => { /* this suite needs no catalog rows */ },
  closeSync: (): void => { /* no native handle to close */ },
  getFirstSync: <T,>(): T | null => null,
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): unknown => fakeDb,
}));

jest.mock('../../../surfaces', () => {
  const actual = jest.requireActual('../../../surfaces');
  return {
    ...actual,
    evaluateSurfaceEngines: jest.fn(actual.evaluateSurfaceEngines),
  };
});

const mockedEvaluateSurfaceEngines = evaluateSurfaceEngines as jest.MockedFunction<
  typeof evaluateSurfaceEngines
>;

const card = (cardId: string): EngineCard => ({
  cardId,
  cardProductId: `product:${cardId}`,
  displayName: cardId,
  last4: '1234',
  issuer: CardIssuer.Max,
  network: CardNetwork.Visa,
  currency: Currency.ILS,
  framework: { creditLimit: 10_000, currentBalance: 1_000 },
  billingCycle: { statementClosingDay: 5, billingDayOfMonth: 10 },
  roleTags: [],
  primaryRole: null,
  rewardCategories: [],
  cashbackRate: 0,
  foreignTransactionFee: 0,
  supportsInstallments: true,
  annualFee: 0,
  isActive: true,
});

const CARDS = [card('card:lowest'), card('card:middle'), card('card:highest')] as const;

const context = (over: Partial<SurfaceContext> = {}): SurfaceContext => ({
  asOfDate: '2026-08-28',
  throughDate: '2026-09-28',
  profile: null,
  cards: CARDS,
  installments: [],
  loans: [],
  purchases: [],
  scoringCosts: {
    'card:lowest': 10,
    'card:middle': 20,
    'card:highest': 30,
  },
  ...over,
});

const wrap = (node: React.ReactElement): React.ReactElement => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}
  >
    {node}
  </SafeAreaProvider>
);

function textsInTree(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(textsInTree);
  if (node === null || typeof node !== 'object') return [];
  return textsInTree((node as { readonly children?: unknown }).children);
}

function requiredScoring(result: SurfaceEngineResults) {
  if (result.scoring === null) throw new Error('the scoring fixture must produce a result');
  return result.scoring;
}

function requiredEffectiveCostStep(result: SurfaceEngineResults, cardId: string) {
  const rankedCard = requiredScoring(result).ranked.find((candidate) => candidate.cardId === cardId);
  const reason = rankedCard?.trace.steps.find(
    (step) => step.rule === 'product spec §20.1 effective cost',
  );
  if (reason === undefined) throw new Error('the scoring fixture must carry its effective-cost reason');
  return reason;
}

function catalogueStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, nested]) => [key, ...catalogueStrings(nested)]);
}

describe('Card DNA when best', () => {
  beforeEach(() => {
    mockedEvaluateSurfaceEngines.mockClear();
    act(() => {
      useCardsStore.setState({ cards: [], obligations: [] });
    });
  });

  it('renders a Best-For chip for each way this card ranks best', () => {
    const ctx = context();
    const scoring = requiredScoring(evaluateSurfaceEngines(ctx));
    const selected = scoring.ranked[0];
    if (selected === undefined) throw new Error('the scoring fixture must rank a card');
    const expected = bestForChipsFor(scoring, selected.cardId);

    const tree = render(wrap(<SectionCWhenBest cardId={selected.cardId} context={ctx} />));

    expect(expected.length).toBeGreaterThan(0);
    expect(
      expected.map((chip) => tree.getByTestId(`card-dna-best-for-${chip.id}`)).length,
    ).toBe(expected.length);
    expect(textsInTree(tree.getByTestId(`card-dna-best-for-${selected.cardId}`))).toContain(
      'Lowest cost',
    );
    expect(textsInTree(tree.getByTestId(`card-dna-best-for-${selected.cardId}`))).not.toContain(
      'product spec §20.1 effective cost',
    );
  });

  it('renders the empty state when this card is ranked but is not first', () => {
    const ctx = context();
    const scoring = requiredScoring(evaluateSurfaceEngines(ctx));
    const third = scoring.ranked[2];
    if (third === undefined) throw new Error('the scoring fixture must rank three cards');

    const tree = render(wrap(<SectionCWhenBest cardId={third.cardId} context={ctx} />));

    expect(bestForChipsFor(scoring, third.cardId)).toEqual([]);
    expect(tree.getByTestId('card-dna-when-best-empty')).toBeTruthy();
    expect(tree.queryAllByTestId(/^card-dna-best-for-/)).toHaveLength(0);
  });

  it('renders each explanation exactly as the engine trace worded it', () => {
    const ctx = context();
    const result = evaluateSurfaceEngines(ctx);
    const selected = requiredScoring(result).ranked[0];
    if (selected === undefined) throw new Error('the scoring fixture must rank a card');
    const reason = requiredEffectiveCostStep(result, selected.cardId);

    const tree = render(wrap(<SectionCWhenBest cardId={selected.cardId} context={ctx} />));
    const explanation = tree.getByTestId(
      `card-dna-best-for-${selected.cardId}-explanation`,
    );

    expect(textsInTree(explanation).join('')).toBe(reason.detail);
  });

  it('renders no explanation when the trace offers none for that chip', () => {
    const ctx = context();
    const result = evaluateSurfaceEngines(ctx);
    const scoring = requiredScoring(result);
    const selected = scoring.ranked[0];
    if (selected === undefined) throw new Error('the scoring fixture must rank a card');
    const withoutEffectiveCostReason = {
      ...scoring,
      ranked: scoring.ranked.map((rankedCard) =>
        rankedCard.cardId === selected.cardId
          ? {
              ...rankedCard,
              trace: {
                ...rankedCard.trace,
                steps: rankedCard.trace.steps.filter(
                  (step) => step.rule !== 'product spec §20.1 effective cost',
                ),
              },
            }
          : rankedCard,
      ),
    };
    mockedEvaluateSurfaceEngines.mockReturnValueOnce({
      ...result,
      scoring: withoutEffectiveCostReason,
    });

    const tree = render(wrap(<SectionCWhenBest cardId={selected.cardId} context={ctx} />));

    expect(tree.getByTestId(`card-dna-best-for-${selected.cardId}`)).toBeTruthy();
    expect(tree.queryByTestId(`card-dna-best-for-${selected.cardId}-explanation`)).toBeNull();
  });

  it('renders an honest empty state when nothing ranks this card', () => {
    const unranked = CARDS[0];
    const ctx = context({ scoringCosts: { [CARDS[1].cardId]: 20 } });

    const tree = render(wrap(<SectionCWhenBest cardId={unranked.cardId} context={ctx} />));

    expect(tree.getByTestId('card-dna-when-best-empty')).toBeTruthy();
    expect(tree.queryAllByTestId(/^card-dna-best-for-/)).toHaveLength(0);
    expect(textsInTree(tree.getByTestId('card-dna-when-best-empty')).join(' ')).toMatch(
      /no ranking|אין לנו.*דירוג|ليس لدينا.*تصنيف/i,
    );
  });

  it('takes its explanations from the engine rather than the translation catalogue', () => {
    const ctx = context();
    const result = evaluateSurfaceEngines(ctx);
    const selected = requiredScoring(result).ranked[0];
    if (selected === undefined) throw new Error('the scoring fixture must rank a card');
    const explanation = requiredEffectiveCostStep(result, selected.cardId).detail;

    const tree = render(wrap(<SectionCWhenBest cardId={selected.cardId} context={ctx} />));
    const rendered = textsInTree(
      tree.getByTestId(`card-dna-best-for-${selected.cardId}-explanation`),
    ).join('');
    const catalogues = [
      ...catalogueStrings(en),
      ...catalogueStrings(enBySource),
      ...catalogueStrings(arBySource),
    ];

    expect(rendered).toBe(explanation);
    expect(catalogues).not.toContain(rendered);
  });
});
