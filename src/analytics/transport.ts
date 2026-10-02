/**
 * THE PROVIDER SEAM — criterion B6, Owner Decision OD-5.
 *
 *   > **B6.** *"All instrumentation passes through one **provider-agnostic** `track(event, props)`
 *   > boundary; **no vendor SDK is reachable from a screen, hook or engine**."*
 *
 *   > **OD-5.** *"The architecture must not assume analytics is local-only."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THERE IS NO VENDOR, AND THAT IS THE CURRENT STATE RATHER THAN AN OVERSIGHT
 *
 * No analytics SDK is a dependency of this app. OD-5 permits one; nobody has chosen one, and
 * choosing one is a decision with a data-processing agreement attached — not something a campaign
 * takes on the Owner's behalf.
 *
 * So the shipped transport is `noOpTransport`: it accepts an envelope and sends nothing. That is
 * **not** a stub standing in for missing work. It is the honest implementation of "analytics is
 * permitted, opt-in, and no provider has been selected", and it makes B8's guarantee — zero
 * outbound requests with consent off — true by construction as well as by policy.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY A SEAM AT ALL, IF NOTHING IS BEHIND IT
 *
 * Because the day a vendor is chosen, the change must be **one module**. A codebase that called an
 * SDK from screens would need that vendor removed from dozens of files, and OD-5 says the
 * architecture must not assume analytics is local-only — which cuts both ways: it must not assume
 * a particular remote one either.
 *
 * The `analytics-boundary` gate enforces that nothing outside this directory imports a transport,
 * and that no vendor SDK is a dependency at all.
 */

/** What leaves the boundary, if anything ever does. Primitive, flat, and already validated. */
export interface AnalyticsEnvelope {
  readonly event: string;
  readonly props: Readonly<Record<string, string | number | boolean>>;
  /** Supplied by the caller. This module never reads a clock — a test must be able to fix it. */
  readonly at: string;
}

export interface AnalyticsTransport {
  readonly name: string;
  /** Returns the number of outbound requests it made. Zero, for the one that ships. */
  send(envelope: AnalyticsEnvelope): number;
}

/**
 * The transport this build ships: it sends nothing, and says so.
 *
 * `send` returns 0 rather than void so a caller — and a test — can assert the count instead of
 * inferring it from silence. "Nothing happened" and "nothing was measured" look identical when the
 * return type is void.
 */
export const noOpTransport: AnalyticsTransport = {
  name: 'none — no provider selected (OD-5 permits one; nobody has chosen one)',
  send: () => 0,
};

/**
 * A RECORDING TRANSPORT USED TO LIVE HERE, AND THE `consent` GATE MOVED IT.
 *
 * It appended to an array, and the gate reads any `.push(` inside `src/analytics/**` as a queue by
 * another name — correctly, because that is exactly the shape OD-8 forbids and a reviewer cannot
 * tell a test double from a buffer by looking at the line.
 *
 * It is a test double, so it now lives beside the tests: `__tests__/recordingTransport.ts`. A test
 * double in production source ships in the bundle and reads as a feature; moving it is the fix, and
 * exempting it by name would have been the beginning of an exemption list.
 */
