import {
  ANALYTICS_EVENTS,
  ANALYTICS_EVENT_NAMES,
  isPermittedPropValue,
} from '../events';
import {
  CONSENT_STATES,
  CONSENT_VAULT_KEY,
  DEFAULT_CONSENT,
  analyticsPermitted,
  answerConsent,
  mayRequestConsent,
  revokeConsent,
} from '../consent';
import { activeTransportName, track } from '../track';
import { noOpTransport } from '../transport';
import { recordingTransport } from './recordingTransport';

/**
 * CRITERIA B6, B7 and B8 — the analytics boundary, its allowlist, and consent.
 *
 * Every assertion here is about what the boundary REFUSES. The one thing it can do — send — is
 * proven too, because a boundary that refused everything would pass every refusal test and be
 * useless.
 */

const AT = '2026-08-24T10:00:00.000Z';

describe('B6 — one provider-agnostic boundary', () => {
  it('ships a transport that sends nothing, and says why', () => {
    // No vendor SDK is a dependency. OD-5 permits one; nobody has chosen one, and choosing one
    // carries a data-processing agreement that is not a campaign's to sign.
    expect(noOpTransport.send({ event: 'app_opened', props: {}, at: AT })).toBe(0);
    expect(activeTransportName()).toMatch(/no provider selected/i);
  });

  it('never reads a clock — the caller supplies the timestamp', () => {
    const transport = recordingTransport();
    track('consent_prompt_shown', {}, { consent: 'GRANTED', at: AT, transport });
    expect(transport.sent[0]?.at).toBe(AT);
  });
});

describe('B7 — events allowlisted, props primitive', () => {
  const granted = { consent: 'GRANTED' as const, at: AT };

  it('declares at least one event, and every declaration is reachable', () => {
    // An empty allowlist would make every "refused" assertion below pass for the wrong reason.
    expect(ANALYTICS_EVENT_NAMES.length).toBeGreaterThan(0);
    for (const name of ANALYTICS_EVENT_NAMES) {
      expect(Object.prototype.hasOwnProperty.call(ANALYTICS_EVENTS, name)).toBe(true);
    }
  });

  it('SENDS a declared event with declared props — the control', () => {
    const transport = recordingTransport();
    const outcome = track('verdict_completed', { card_count: 3, was_complete: true }, { ...granted, transport });
    expect(outcome.sent).toBe(true);
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]?.props).toEqual({ card_count: 3, was_complete: true });
  });

  it('REFUSES an event that is not on the allowlist', () => {
    const transport = recordingTransport();
    const outcome = track('card_opened' as never, {} as never, { ...granted, transport });
    expect(outcome.sent).toBe(false);
    if (outcome.sent) return;
    expect(outcome.reason).toBe('UNKNOWN_EVENT');
    expect(transport.sent).toHaveLength(0);
  });

  it('REFUSES an undeclared prop, even on a declared event', () => {
    const transport = recordingTransport();
    const outcome = track(
      'verdict_completed',
      { card_count: 3, was_complete: true, card_id: 'card:amex-il:platinum' } as never,
      { ...granted, transport },
    );
    expect(outcome.sent).toBe(false);
    if (outcome.sent) return;
    expect(outcome.reason).toBe('DISALLOWED_PROP');
    expect(outcome.why).toContain('card_id');
    expect(transport.sent).toHaveLength(0);
  });

  it('REFUSES a free string where a closed set is declared', () => {
    // A free string is where a card name, a merchant, or an error message containing either of them
    // ends up.
    const outcome = track('screen_viewed', { route: 'SomeNewScreen' as never }, granted);
    expect(outcome.sent).toBe(false);
    if (outcome.sent) return;
    expect(outcome.reason).toBe('DISALLOWED_PROP');
  });

  it('REFUSES an object or an array where a primitive is declared', () => {
    for (const value of [{ id: 1 }, [1, 2], null, undefined]) {
      const outcome = track('verdict_completed', { card_count: value as never, was_complete: true }, granted);
      expect(outcome.sent).toBe(false);
    }
  });

  it('REFUSES a non-finite number', () => {
    // NaN and Infinity serialise to null in JSON and arrive as a missing field nobody notices.
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(track('verdict_completed', { card_count: value, was_complete: true }, granted).sent).toBe(false);
    }
  });

  it('every declared prop type is exercised by the checker', () => {
    // Derived from the declaration: number, boolean, and closed-set are all represented, so no
    // branch of isPermittedPropValue is untested by construction.
    const kinds = new Set<string>();
    for (const [event, props] of Object.entries(ANALYTICS_EVENTS)) {
      for (const declaration of Object.values(props as Record<string, unknown>)) {
        kinds.add(Array.isArray(declaration) ? 'closed-set' : String(declaration));
      }
      // And an undeclared prop on every event is refused, not only on the one tested above.
      expect(isPermittedPropValue(event as never, '__not_declared__', 1).ok).toBe(false);
    }
    expect([...kinds].sort()).toEqual(['boolean', 'closed-set', 'number']);
  });
});

describe('B8 — consent is opt-in, default off', () => {
  it('defaults to UNASKED, which is not GRANTED and not DENIED', () => {
    expect(DEFAULT_CONSENT).toBe('UNASKED');
    expect(analyticsPermitted({ state: DEFAULT_CONSENT })).toBe(false);
    expect(CONSENT_STATES).toContain('UNASKED');
    // Three states, because "never asked" and "said no" are different facts.
    expect(CONSENT_STATES).toHaveLength(3);
  });

  it('is stored as vault data, under the vault\'s own namespace', () => {
    expect(CONSENT_VAULT_KEY.startsWith('app:')).toBe(true);
  });

  it('SENDS NOTHING while consent is UNASKED or DENIED', () => {
    for (const consent of ['UNASKED', 'DENIED'] as const) {
      const transport = recordingTransport();
      const outcome = track('app_opened', { launch_kind: 'cold' }, { consent, at: AT, transport });
      expect(outcome.sent).toBe(false);
      if (outcome.sent) return;
      expect(outcome.reason).toBe('NO_CONSENT');
      expect(outcome.outboundRequests).toBe(0);
      expect(transport.sent).toHaveLength(0);
    }
  });

  it('DROPS a refused event — nothing is collected, buffered or queued', () => {
    // The usual opt-in implementation buffers and flushes on grant, so the first upload contains
    // everything the user did before they agreed. OD-8 forbids it in as many words, and the proof
    // is that granting consent afterwards sends nothing that happened before.
    const transport = recordingTransport();
    track('app_opened', { launch_kind: 'cold' }, { consent: 'UNASKED', at: AT, transport });
    track('verdict_completed', { card_count: 2, was_complete: true }, { consent: 'UNASKED', at: AT, transport });
    expect(transport.sent).toHaveLength(0);

    track('consent_answered', { granted: true }, { consent: 'GRANTED', at: AT, transport });
    // Exactly one: the event sent after consent. Nothing from before it.
    expect(transport.sent.map((e) => e.event)).toEqual(['consent_answered']);
  });

  it('turning consent off stops collection immediately, with nothing in flight', () => {
    const revoked = revokeConsent();
    expect(revoked.state).toBe('DENIED');
    expect(revoked.pendingEvents).toBe(0);
    expect(analyticsPermitted({ state: revoked.state })).toBe(false);
  });

  it('records a decline rather than forgetting the question', () => {
    expect(answerConsent(false)).toBe('DENIED');
    expect(answerConsent(true)).toBe('GRANTED');
  });
});

describe('B8 — consent is requested only after the first successful verdict', () => {
  const base = {
    state: 'UNASKED' as const,
    onboardingComplete: true,
    successfulVerdicts: 1,
    promptShown: false,
  };

  it('MAY be requested once onboarding is done and a verdict has succeeded — the control', () => {
    expect(mayRequestConsent(base).may).toBe(true);
  });

  it('NEVER during onboarding', () => {
    const verdict = mayRequestConsent({ ...base, onboardingComplete: false });
    expect(verdict.may).toBe(false);
    expect(verdict.why).toMatch(/onboarding/i);
  });

  it('NOT before a verdict has succeeded', () => {
    const verdict = mayRequestConsent({ ...base, successfulVerdicts: 0 });
    expect(verdict.may).toBe(false);
    expect(verdict.why).toMatch(/verdict/i);
  });

  it('NOT twice, and not after an answer', () => {
    expect(mayRequestConsent({ ...base, promptShown: true }).may).toBe(false);
    expect(mayRequestConsent({ ...base, state: 'DENIED' }).may).toBe(false);
    expect(mayRequestConsent({ ...base, state: 'GRANTED' }).may).toBe(false);
  });
});
