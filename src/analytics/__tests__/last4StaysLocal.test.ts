/**
 * W7 — last4 cannot reach track(). The authorised off-device path is profile transfer.
 */
import type { UserCard } from '../../types/card.types';
import { track } from '../track';
import { recordingTransport } from './recordingTransport';

const AT = '2026-08-24T10:00:00.000Z';
const granted = { consent: 'GRANTED' as const, at: AT };

const userWithLast4: UserCard = {
  cardId: 'card-local-1',
  cardProductId: 'card:max:example',
  displayName: 'Test',
  last4: '1234',
  framework: { creditLimit: 10_000, currentBalance: 0 },
  billingCycle: { statementClosingDay: 0, billingDayOfMonth: 0 },
  isActive: true,
  primaryRole: null,
};

describe('W7 — last4 stays in the local vault', () => {
  it('passing a UserCard carrying last4 to track() is refused and sends nothing', () => {
    const transport = recordingTransport();
    const outcome = track(
      'verdict_completed',
      { card_count: 1, was_complete: true, card: userWithLast4 } as never,
      { ...granted, transport },
    );
    expect(outcome.sent).toBe(false);
    if (outcome.sent) return;
    expect(outcome.reason).toBe('DISALLOWED_PROP');
    expect(outcome.why).toMatch(/last4/);
    expect(outcome.outboundRequests).toBe(0);
    expect(transport.sent).toHaveLength(0);
  });

  it('a bare last4 prop is refused the same way', () => {
    const transport = recordingTransport();
    const outcome = track(
      'verdict_completed',
      { card_count: 1, was_complete: true, last4: '9999' } as never,
      { ...granted, transport },
    );
    expect(outcome.sent).toBe(false);
    if (outcome.sent) return;
    expect(outcome.why).toMatch(/last4/);
    expect(transport.sent).toHaveLength(0);
  });

  it('declared props without last4 still send — the control', () => {
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
