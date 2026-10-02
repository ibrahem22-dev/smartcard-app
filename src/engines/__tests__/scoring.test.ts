import { PROVENANCE_CHIPS } from '../../authority/provenanceChip';
import { scoreCards } from '../scoring';

const amount = (value: number, provenance: 'USER' | 'VERIFIED' | 'ESTIMATE' = 'VERIFIED') => ({
  value,
  provenance,
});

describe('the card scoring engine (N1)', () => {
  it('ranks available cards by effective cost and returns score, trace and deltas', () => {
    const result = scoreCards({
      cards: [
        { cardId: 'middle', available: true, costIls: amount(110) },
        { cardId: 'best', available: true, costIls: amount(100) },
        { cardId: 'worst', available: true, costIls: amount(120) },
      ],
    });

    expect(result.ranked.map((card) => card.cardId)).toEqual(['best', 'middle', 'worst']);
    expect(result.ranked.map((card) => card.score.value)).toEqual([100, 50, 0]);
    expect(result.ranked.map((card) => card.deltaFromBestIls?.value)).toEqual([0, 10, 20]);
    expect(result.trace.steps.length).toBeGreaterThan(0);
    for (const card of result.ranked) {
      expect(card.trace.steps.length).toBeGreaterThan(0);
      expect(PROVENANCE_CHIPS).toContain(card.effectiveCostIls.provenance);
      // No benefit touched these costs, so each cost IS its input fact (VERIFIED here).
      expect(card.effectiveCostIls.provenance).toBe('VERIFIED');
      // The relative score and the delta are derived comparisons — always graded.
      expect(card.score.provenance).toBe('ESTIMATE');
      expect(card.deltaFromBestIls?.provenance).toBe('ESTIMATE');
    }
  });

  it('benefits are optional: omission and an empty list produce identical ranking', () => {
    const cards = [
      { cardId: 'a', available: true, costIls: amount(90) },
      { cardId: 'b', available: true, costIls: amount(100) },
    ];
    const omitted = scoreCards({ cards });
    const empty = scoreCards({ cards, benefits: [] });
    expect(omitted.ranked).toEqual(empty.ranked);
    expect(omitted.unavailableCards).toEqual(empty.unavailableCards);
  });

  it('an optional matched benefit changes effective cost without changing the input shape', () => {
    const result = scoreCards({
      cards: [
        { cardId: 'plain', available: true, costIls: amount(90) },
        { cardId: 'benefit-card', available: true, costIls: amount(100) },
      ],
      benefits: [{
        benefitId: 'benefit:cashback',
        cardId: 'benefit-card',
        effectiveValueIls: amount(20),
      }],
    });

    expect(result.ranked.map((card) => card.cardId)).toEqual(['benefit-card', 'plain']);
    expect(result.ranked[0]?.effectiveCostIls.value).toBe(80);
    expect(result.ranked[0]?.benefitValueAppliedIls?.value).toBe(20);
    expect(result.ranked[0]?.appliedBenefitIds).toEqual(['benefit:cashback']);
    // ADR-013 §3 grades the DERIVATION: the benefit-adjusted figure is ESTIMATE, while the
    // untouched card's cost IS its input fact and arrives with its chip intact.
    expect(result.ranked[0]?.effectiveCostIls.provenance).toBe('ESTIMATE');
    expect(result.ranked.find((card) => card.cardId === 'plain')?.effectiveCostIls.provenance)
      .toBe('VERIFIED');
  });

  it('an unmodified cost keeps the provenance it arrived with — a derivation alone earns ESTIMATE', () => {
    const result = scoreCards({
      cards: [{ cardId: 'user-figure', available: true, costIls: amount(250, 'USER') }],
    });
    expect(result.ranked[0]?.effectiveCostIls).toEqual({ value: 250, provenance: 'USER' });
    // The score and delta are derived comparisons regardless of input grade.
    expect(result.ranked[0]?.score.provenance).toBe('ESTIMATE');
  });

  it('when the comparison suppresses deltas, scored deltas are omitted entirely', () => {
    const result = scoreCards({
      deltasSuppressed: true,
      cards: [
        { cardId: 'best', available: true, costIls: amount(100) },
        { cardId: 'runner-up', available: true, costIls: amount(108.4) },
      ],
    });
    expect(result.ranked.map((card) => card.cardId)).toEqual(['best', 'runner-up']);
    for (const card of result.ranked) {
      expect('deltaFromBestIls' in card).toBe(false);
    }
    // The ranking itself survives; only the savings CLAIM is suppressed — and the trace says why.
    const reasons = result.ranked
      .map((card) => card.trace.steps.map((s) => s.rule + ' ' + s.detail).join('\n'))
      .join('\n');
    expect(reasons).toMatch(/D1/);
    expect(reasons).toMatch(/suppressed/);
  });

  it('a card with no resolved cost lands in unknownCostCards, never ranked', () => {
    const result = scoreCards({
      cards: [
        { cardId: 'known', available: true, costIls: amount(90) },
        { cardId: 'mystery', available: true },
        { cardId: 'blocked-and-blind', available: false },
      ],
    });
    expect(result.ranked.map((card) => card.cardId)).toEqual(['known']);
    expect(result.unknownCostCards).toEqual(['mystery']);
    expect(result.unavailableCards).toEqual(['blocked-and-blind']);
  });

  it('unavailable cards never rank and receive no fabricated numeric output', () => {
    const result = scoreCards({
      cards: [
        { cardId: 'available', available: true, costIls: amount(100) },
        { cardId: 'blocked', available: false, costIls: amount(1) },
      ],
    });
    expect(result.ranked.map((card) => card.cardId)).toEqual(['available']);
    expect(result.unavailableCards).toEqual(['blocked']);
  });

  it('ties are deterministic and share the best score and zero delta', () => {
    const result = scoreCards({
      cards: [
        { cardId: 'z-card', available: true, costIls: amount(50) },
        { cardId: 'a-card', available: true, costIls: amount(50) },
      ],
    });
    expect(result.ranked.map((card) => card.cardId)).toEqual(['a-card', 'z-card']);
    expect(result.ranked.map((card) => card.score.value)).toEqual([100, 100]);
    expect(result.ranked.map((card) => card.deltaFromBestIls?.value)).toEqual([0, 0]);
  });

  it('refuses UNKNOWN, negative and non-finite monetary inputs', () => {
    expect(() => scoreCards({ cards: [{
      cardId: 'unknown', available: true, costIls: amount(10, 'ESTIMATE'),
    }], benefits: [{
      benefitId: 'bad', cardId: 'unknown', effectiveValueIls: { value: 5, provenance: 'UNKNOWN' },
    }] })).toThrow(/UNKNOWN/);
    expect(() => scoreCards({ cards: [
      { cardId: 'negative', available: true, costIls: amount(-1) },
    ] })).toThrow(/negative or non-finite/);
    expect(() => scoreCards({ cards: [
      { cardId: 'infinite', available: true, costIls: amount(Number.POSITIVE_INFINITY) },
    ] })).toThrow(/negative or non-finite/);
  });
});
