/**
 * L3 — verdict history is queryable substrate, not a write-only log.
 */
import { queryVerdictHistory, writeVerdictHistory } from '../activityMapper';

const older = writeVerdictHistory({
  activityId: 'activity:older',
  at: '2026-08-27T09:00:00.000Z',
  verdict: 'good_to_go',
  purchaseAmountIls: 100,
  cardId: 'card-a',
});

const newer = writeVerdictHistory({
  activityId: 'activity:newer',
  at: '2026-08-27T11:00:00.000Z',
  verdict: 'caution',
  purchaseAmountIls: 250,
  cardId: 'card-b',
});

describe('L3 — verdict history is queryable substrate', () => {
  it('querying the history returns written verdicts in time order', () => {
    const found = queryVerdictHistory([newer, older]);
    expect(found.map((row) => row.activityId)).toEqual(['activity:older', 'activity:newer']);
    expect(found[0]?.verdict).toBe('good_to_go');
    expect(found[1]?.verdict).toBe('caution');
  });

  it('a card filter returns that card rather than the whole write-only log', () => {
    const found = queryVerdictHistory([older, newer], { cardId: 'card-b' });
    expect(found).toEqual([newer]);
    expect(found).not.toEqual([older, newer]);
  });
});
