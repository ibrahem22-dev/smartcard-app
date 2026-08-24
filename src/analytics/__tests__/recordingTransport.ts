import type { AnalyticsEnvelope, AnalyticsTransport } from '../transport';

/**
 * A transport that records what it was handed, for tests and for a diagnostic surface.
 *
 * Still sends nothing. It exists so a test can prove the boundary REFUSED an event rather than
 * merely that nothing arrived somewhere — those are different claims, and only the first one
 * distinguishes a working allowlist from a broken transport.
 */
export function recordingTransport(): AnalyticsTransport & { readonly sent: AnalyticsEnvelope[] } {
  const sent: AnalyticsEnvelope[] = [];
  return {
    name: 'recording (test only)',
    sent,
    send: (envelope) => {
      sent.push(envelope);
      return 0;
    },
  };
}
