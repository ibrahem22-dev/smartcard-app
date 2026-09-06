/**
 * THE PURCHASE COST LANE — the half of OQ-P5-002 that was missing at HEAD.
 *
 * The composition was repaired in August; nothing supplied a cost, so the ranking was empty on
 * every device and the recommendation block was omitted every time. These cases measure the lane
 * that fills it, and — just as importantly — the cases where it correctly refuses to.
 */
import { calculateInstallmentInterest } from '../../engines/interestCalculator';
import { Currency, PurchaseCategory } from '../../types/purchase.types';
import type { CardRates } from '../../types/card.types';
import { purchaseCosts } from '../purchaseCostLane';
import { vaultCard } from './cardFixture';

const rates = (installmentInterestRate: number): CardRates => ({
  creditInterestRate: 12,
  installmentInterestRate,
  cardLoanInterestRate: 11,
  foreignExchangeCommission: 2.8,
  monthlyFee: 0,
  source: 'test',
  lastUpdated: '2026-01-01',
});

const draft = (over: Partial<Parameters<typeof purchaseCosts>[0]> = {}) => ({
  amount: 6_000,
  currency: Currency.ILS,
  category: null as PurchaseCategory | null,
  installments: 12 as number | null,
  cardId: null as string | null,
  merchantId: null as string | null,
  ...over,
});

describe('purchase cost lane', () => {
  it('prices an installment purchase from each card’s own published rate', () => {
    const cards = [
      vaultCard({ cardId: 'a', cardRates: rates(6) }),
      vaultCard({ cardId: 'b', cardRates: rates(11) }),
    ];
    const reading = purchaseCosts(draft(), cards);

    expect(reading.basis).toBe('INSTALLMENT_INTEREST');
    /* The figures are the Spitzer engine's own, not a second calculation. */
    expect(reading.costs['a']).toBe(calculateInstallmentInterest(6_000, 12, 6).totalInterest);
    expect(reading.costs['b']).toBe(calculateInstallmentInterest(6_000, 12, 11).totalInterest);
    expect(reading.costs['a']).toBeLessThan(reading.costs['b'] as number);
    expect(reading.unpricedCardIds).toEqual([]);
  });

  it('leaves a card with no published rate UNPRICED rather than pricing it at zero', () => {
    const cards = [
      vaultCard({ cardId: 'priced', cardRates: rates(9) }),
      vaultCard({ cardId: 'unpriced' }),
    ];
    const reading = purchaseCosts(draft(), cards);

    expect(reading.basis).toBe('INSTALLMENT_INTEREST');
    expect(Object.keys(reading.costs)).toEqual(['priced']);
    expect(reading.costs['unpriced']).toBeUndefined();
    expect(reading.unpricedCardIds).toEqual(['unpriced']);
  });

  it('refuses to price a single-payment purchase, because it costs the same on every card', () => {
    const cards = [
      vaultCard({ cardId: 'a', cardRates: rates(6) }),
      vaultCard({ cardId: 'b', cardRates: rates(11) }),
    ];
    const reading = purchaseCosts(draft({ installments: null }), cards);

    expect(reading.basis).toBe('NOT_PRICEABLE');
    expect(reading.costs).toEqual({});
  });

  it('refuses a foreign-currency purchase — the FX lane owns that question', () => {
    const cards = [vaultCard({ cardId: 'a', cardRates: rates(6) })];
    expect(purchaseCosts(draft({ currency: Currency.USD }), cards).basis).toBe('NOT_PRICEABLE');
    expect(purchaseCosts(draft({ currency: Currency.EUR }), cards).basis).toBe('NOT_PRICEABLE');
  });

  it('prices only ACTIVE cards', () => {
    const cards = [
      vaultCard({ cardId: 'live', cardRates: rates(6) }),
      vaultCard({ cardId: 'dead', cardRates: rates(2), isActive: false }),
    ];
    const reading = purchaseCosts(draft(), cards);

    expect(Object.keys(reading.costs)).toEqual(['live']);
    expect(reading.unpricedCardIds).not.toContain('dead');
  });

  it('reports NOT_PRICEABLE when no available card could be priced', () => {
    const cards = [vaultCard({ cardId: 'a' }), vaultCard({ cardId: 'b' })];
    const reading = purchaseCosts(draft(), cards);

    expect(reading.basis).toBe('NOT_PRICEABLE');
    expect(reading.costs).toEqual({});
    expect([...reading.unpricedCardIds].sort()).toEqual(['a', 'b']);
  });

  it('refuses a rate outside the statutory band rather than amortising it', () => {
    const cards = [vaultCard({ cardId: 'a', cardRates: rates(45) })];
    const reading = purchaseCosts(draft(), cards);

    expect(reading.basis).toBe('NOT_PRICEABLE');
    expect(reading.unpricedCardIds).toEqual(['a']);
  });

  it('refuses an empty wallet, a non-positive amount and a one-payment plan', () => {
    expect(purchaseCosts(draft(), []).basis).toBe('NOT_PRICEABLE');
    expect(purchaseCosts(draft({ amount: 0 }), [vaultCard({ cardId: 'a', cardRates: rates(6) })]).basis)
      .toBe('NOT_PRICEABLE');
    expect(
      purchaseCosts(draft({ installments: 1 }), [vaultCard({ cardId: 'a', cardRates: rates(6) })]).basis,
    ).toBe('NOT_PRICEABLE');
  });

  it('gives tied rates tied costs, so the engine tie-break — not this lane — decides', () => {
    const cards = [
      vaultCard({ cardId: 'a', cardRates: rates(8) }),
      vaultCard({ cardId: 'b', cardRates: rates(8) }),
    ];
    const reading = purchaseCosts(draft(), cards);
    expect(reading.costs['a']).toBe(reading.costs['b']);
  });
});
