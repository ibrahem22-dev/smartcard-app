import { ANALYTICS_EVENT_NAMES } from '../events';
import { track } from '../track';
import { noOpTransport } from '../transport';

/**
 * CRITERION B8's NETWORK TRACE — *"with analytics off the release-gate network trace shows **zero**
 * outbound analytics requests"*.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IS TRACED, AND WHAT THIS IS NOT
 *
 * Every way JavaScript can start a request is replaced with a recorder before the analytics path
 * runs: `fetch`, `XMLHttpRequest`, `WebSocket`, `navigator.sendBeacon`, and `Image` — the last
 * because a tracking pixel is a request that uses none of the others and is exactly how analytics
 * has historically evaded a `fetch` spy.
 *
 * **This is a JS-level trace, not a packet capture.** It proves no request leaves the JavaScript
 * runtime. It cannot prove that a native module, linked into the binary, made one — and the honest
 * reason it does not need to is measured here too: **no analytics SDK is a dependency of this app**,
 * so there is no native module to make one. The `analytics-boundary` gate checks that dependency
 * list; a packet capture on a physical device is criterion C2's territory, and Phase 11's.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE POPULATION IS EVERY DECLARED EVENT
 *
 * Not one event chosen as representative. If a future event were routed around the boundary, a
 * trace of only `app_opened` would be silent about it.
 */

type Recorder = { readonly calls: string[]; restore: () => void };

const traceOutbound = (): Recorder => {
  const calls: string[] = [];
  const g = globalThis as unknown as Record<string, unknown>;

  const originals = {
    fetch: g.fetch,
    XMLHttpRequest: g.XMLHttpRequest,
    WebSocket: g.WebSocket,
    Image: g.Image,
    navigator: g.navigator,
  };

  g.fetch = (input: unknown) => {
    calls.push(`fetch:${String(input)}`);
    // Resolved, not rejected. A rejection models "no network" honestly and produces an unhandled
    // promise the moment anything calls fetch without awaiting it — which is a failure about the
    // TRACE rather than about the code under it. The recorded call is the measurement; the response
    // is deliberately unusable so nothing can mistake it for a real one.
    return Promise.resolve({ ok: false, status: 0, statusText: 'intercepted by the trace' });
  };
  g.XMLHttpRequest = class {
    open(_method: string, url: string): void { calls.push(`xhr:${url}`); }
    send(): void { /* recorded at open */ }
    setRequestHeader(): void { /* no-op */ }
  };
  g.WebSocket = class {
    constructor(url: string) { calls.push(`ws:${url}`); }
  };
  g.Image = class {
    // A tracking pixel: assigning src issues a GET, and it uses none of the above.
    set src(url: string) { calls.push(`img:${url}`); }
  };
  g.navigator = {
    ...(originals.navigator as object | undefined),
    sendBeacon: (url: string) => { calls.push(`beacon:${url}`); return true; },
  };

  return {
    calls,
    restore: () => {
      for (const [key, value] of Object.entries(originals)) {
        if (value === undefined) delete g[key];
        else g[key] = value;
      }
    },
  };
};

describe('B8 — the network trace, with analytics off', () => {
  it('the trace itself catches a request — the control that makes every zero below mean something', () => {
    // Without this, "0 outbound" would be indistinguishable from a trace that records nothing.
    const trace = traceOutbound();
    try {
      void (globalThis as unknown as { fetch: (u: string) => Promise<unknown> }).fetch('https://example.invalid/collect');
      (globalThis as unknown as { navigator: { sendBeacon: (u: string) => boolean } }).navigator.sendBeacon('https://example.invalid/beacon');
      const img = new (globalThis as unknown as { Image: new () => { src: string } }).Image();
      img.src = 'https://example.invalid/pixel.gif';
    } finally {
      trace.restore();
    }
    expect(trace.calls).toHaveLength(3);
    expect(trace.calls.some((c) => c.startsWith('img:'))).toBe(true);
  });

  it('EVERY declared event, with consent UNASKED, makes ZERO outbound requests', () => {
    const trace = traceOutbound();
    let attempted = 0;
    try {
      for (const event of ANALYTICS_EVENT_NAMES) {
        // Deliberately handing each event a plausible prop set. A refusal is fine — the claim is
        // about the network, not about acceptance.
        track(
          event,
          { launch_kind: 'cold', card_count: 1, was_complete: true, granted: true, outcome: 'imported', route: 'Home' } as never,
          { consent: 'UNASKED', at: '2026-08-24T10:00:00.000Z' },
        );
        attempted += 1;
      }
    } finally {
      trace.restore();
    }

    expect(attempted).toBe(ANALYTICS_EVENT_NAMES.length);
    expect(attempted).toBeGreaterThan(0);
    expect(trace.calls).toEqual([]);
  });

  it('EVERY declared event, with consent DENIED, makes ZERO outbound requests', () => {
    const trace = traceOutbound();
    try {
      for (const event of ANALYTICS_EVENT_NAMES) {
        track(
          event,
          { launch_kind: 'warm', card_count: 0, was_complete: false, granted: false, outcome: 'refused', route: 'More' } as never,
          { consent: 'DENIED', at: '2026-08-24T10:00:00.000Z' },
        );
      }
    } finally {
      trace.restore();
    }
    expect(trace.calls).toEqual([]);
  });

  it('makes ZERO outbound requests even with consent GRANTED, because no provider is selected', () => {
    // The shipped transport sends nothing. B8's guarantee holds with consent off by policy AND by
    // construction; this line records that the second half is currently doing the work.
    const trace = traceOutbound();
    try {
      for (const event of ANALYTICS_EVENT_NAMES) {
        track(
          event,
          { launch_kind: 'cold', card_count: 1, was_complete: true, granted: true, outcome: 'imported', route: 'Home' } as never,
          { consent: 'GRANTED', at: '2026-08-24T10:00:00.000Z' },
        );
      }
    } finally {
      trace.restore();
    }
    expect(trace.calls).toEqual([]);
    expect(noOpTransport.send({ event: 'app_opened', props: {}, at: '2026-08-24T10:00:00.000Z' })).toBe(0);
  });
});
