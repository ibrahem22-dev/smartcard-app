import { parseStoredActivity } from '../activityParsing';

describe('activity vault parsing', () => {
  it('accepts a well-formed activity vault', () => {
    const vault = parseStoredActivity(
      JSON.stringify({
        purchases: [
          {
            activityId: 'activity:1',
            amountIls: 80,
            loggedAt: '2026-08-27T10:00:00.000Z',
            cardId: 'card-a',
          },
        ],
        verdicts: [
          {
            activityId: 'activity:1',
            at: '2026-08-27T10:00:00.000Z',
            verdict: 'good_to_go',
            purchaseAmountIls: 80,
            cardId: 'card-a',
          },
        ],
      }),
    );
    expect(vault.purchases).toHaveLength(1);
    expect(vault.verdicts).toHaveLength(1);
  });

  it('malformed JSON is an empty vault, not a throw', () => {
    expect(parseStoredActivity('{"purchases":')).toEqual({ purchases: [], verdicts: [] });
    expect(parseStoredActivity(undefined)).toEqual({ purchases: [], verdicts: [] });
  });
});
