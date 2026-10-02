/**
 * L1 — "I made this purchase" writes a purchase record. Mapping only; the
 * store persist is proven on the rendered surface.
 */
import {
  queryVerdictHistory,
  writeLoggedPurchase,
  writeVerdictHistory,
} from '../../../check/activityMapper';

describe('L1 — purchase logging mapper', () => {
  it('writeLoggedPurchase records amount, activityId and loggedAt', () => {
    const purchase = writeLoggedPurchase({
      activityId: 'activity:test-1',
      amountIls: 1_500,
      at: '2026-08-27T10:00:00.000Z',
      cardId: 'card-a',
    });
    expect(purchase.activityId).toBe('activity:test-1');
    expect(purchase.amountIls).toBe(1_500);
    expect(purchase.loggedAt).toBe('2026-08-27T10:00:00.000Z');
    expect(purchase.cardId).toBe('card-a');
  });

  it('refusing a non-positive amount does not invent a log', () => {
    expect(() =>
      writeLoggedPurchase({
        activityId: 'activity:test-0',
        amountIls: 0,
        at: '2026-08-27T10:00:00.000Z',
      }),
    ).toThrow(/greater than zero/);
    expect(() =>
      writeLoggedPurchase({
        activityId: 'activity:test-neg',
        amountIls: -10,
        at: '2026-08-27T10:00:00.000Z',
      }),
    ).toThrow(/greater than zero/);
  });

  it('queryVerdictHistory returns matching records rather than a write-only log', () => {
    const a = writeVerdictHistory({
      activityId: 'activity:a',
      at: '2026-08-27T09:00:00.000Z',
      verdict: 'good_to_go',
      purchaseAmountIls: 100,
      cardId: 'card-a',
    });
    const b = writeVerdictHistory({
      activityId: 'activity:b',
      at: '2026-08-27T10:00:00.000Z',
      verdict: 'caution',
      purchaseAmountIls: 200,
      cardId: 'card-b',
    });
    expect(queryVerdictHistory([b, a]).map((row) => row.activityId)).toEqual([
      'activity:a',
      'activity:b',
    ]);
    expect(queryVerdictHistory([a, b], { cardId: 'card-b' })).toEqual([b]);
  });
});
