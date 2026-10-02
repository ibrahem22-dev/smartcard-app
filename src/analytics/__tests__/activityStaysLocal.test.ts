/**
 * L4 — nothing logged leaves the device. Activity records cannot reach track().
 */
import { track } from '../track';
import { recordingTransport } from './recordingTransport';

const AT = '2026-08-27T10:00:00.000Z';
const granted = { consent: 'GRANTED' as const, at: AT };

const activityRecord = {
  activityId: 'activity:1',
  amountIls: 1_500,
  loggedAt: AT,
};

describe('L4 — activity stays local', () => {
  it('passing an activity record to track() is refused and sends nothing', () => {
    const transport = recordingTransport();
    const outcome = track(
      'verdict_completed',
      { card_count: 1, was_complete: true, record: activityRecord } as never,
      { ...granted, transport },
    );
    expect(outcome.sent).toBe(false);
    if (outcome.sent) return;
    expect(outcome.reason).toBe('DISALLOWED_PROP');
    expect(outcome.why).toMatch(/activity/);
    expect(outcome.outboundRequests).toBe(0);
    expect(transport.sent).toHaveLength(0);
  });

  it('a nested activity record is refused the same way', () => {
    const transport = recordingTransport();
    const outcome = track(
      'verdict_completed',
      { card_count: 1, was_complete: true, payload: { inner: activityRecord } } as never,
      { ...granted, transport },
    );
    expect(outcome.sent).toBe(false);
    if (outcome.sent) return;
    expect(outcome.why).toMatch(/activity/);
    expect(transport.sent).toHaveLength(0);
  });

  it('declared props without activity still send — the control', () => {
    const transport = recordingTransport();
    const outcome = track(
      'verdict_completed',
      { card_count: 2, was_complete: true },
      { ...granted, transport },
    );
    expect(outcome.sent).toBe(true);
    expect(transport.sent).toHaveLength(1);
  });
});
