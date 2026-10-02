import { join } from 'node:path';

import { KEY_CUSTODY, TRUST_STORE, releaseEligible, type SignatureEnvelope } from '@smartcard/data-authority-adapter';

import { fsPackReader } from '../../fsPackReader';
import {
  checkDelivery,
  releaseCapableCustodies,
  releaseCustodyExists,
} from '../releaseGate';

/**
 * CRITERION C7 — *"**No pack reaches a real device while `release: false`.**"*
 *
 * Every assertion here is about the state this repository is ACTUALLY in: no release custody
 * exists, every shipped envelope carries `release: false`, and delivery to a device is refused.
 * A test that mocked a release-eligible key would be describing a build nobody has made.
 */

const PACKS = join(__dirname, '..', '..', 'packs');
const reader = fsPackReader(PACKS);
const decoder = new TextDecoder();

const envelopes = (): SignatureEnvelope[] =>
  reader.sets().map((set) => JSON.parse(decoder.decode(reader.read(set, 'manifest.sig.json'))));

describe('C7 — delivery is refused while release: false', () => {
  it('has real envelopes to check — an empty population would prove nothing', () => {
    expect(envelopes().length).toBeGreaterThan(0);
  });

  it('every shipped envelope carries release: false, signed by a development key', () => {
    for (const e of envelopes()) {
      expect(`${e.packId}: release=${e.release}`).toBe(`${e.packId}: release=false`);
      expect(e.keyId).toMatch(/NOT-FOR-RELEASE/);
    }
  });

  it('NO release custody exists in this build — OD-25 has not been taken', () => {
    // Derived from the compiled-in trust store and the adapter's custody ruling, never a constant.
    expect(releaseCustodyExists()).toBe(false);
    for (const key of TRUST_STORE) expect(releaseEligible(key.custody)).toBe(false);
  });

  it('names the custodies that WOULD qualify, so the refusal says what would lift it', () => {
    const capable = releaseCapableCustodies();
    expect(capable.length).toBeGreaterThan(0);
    expect(capable).toContain('HARDWARE_BACKED');
    // And they are a strict subset — a build where every custody could release would make the
    // check vacuous, and the adapter's ordering is the trust ordering.
    expect(capable.length).toBeLessThan(KEY_CUSTODY.length);
  });

  it('REFUSES delivery of every shipped pack to a real device', () => {
    const verdict = checkDelivery(envelopes(), true);
    expect(verdict.deliverable).toBe(false);
    if (verdict.deliverable) return;

    const codes = new Set(verdict.refusals.map((r) => r.code));
    expect(codes.has('NO_RELEASE_CUSTODY_EXISTS')).toBe(true);
    expect(codes.has('ENVELOPE_NOT_RELEASE')).toBe(true);
    expect(codes.has('CUSTODY_MAY_NOT_RELEASE')).toBe(true);
    // Every pack named, not counted. "5 packs refused" sends somebody to find out which.
    const named = new Set(verdict.refusals.map((r) => r.packId));
    for (const e of envelopes()) expect(named.has(e.packId)).toBe(true);
  });

  it('does NOT refuse a build tool inspecting the same packs', () => {
    // The control. Without it, this gate would pass for an implementation that refused everything
    // everywhere, which would also stop the tests that verify these packs from running at all.
    const verdict = checkDelivery(envelopes(), false);
    expect(verdict.deliverable).toBe(true);
  });

  it('REFUSES a forged release: true beside a development key', () => {
    // The envelope's own flag is not the check. A pack asserting its own release-eligibility is
    // exactly the shape EXPECTED_DATASET_ID exists to avoid.
    const forged = envelopes().map((e) => ({ ...e, release: true }));
    const verdict = checkDelivery(forged, true);
    expect(verdict.deliverable).toBe(false);
    if (verdict.deliverable) return;
    expect(verdict.refusals.map((r) => r.code)).toContain('CUSTODY_MAY_NOT_RELEASE');
  });

  it('REFUSES a pack signed by a key this build does not carry', () => {
    const stranger = envelopes().map((e) => ({ ...e, keyId: 'SOME-KEY-NOBODY-HERE-TRUSTS' }));
    const verdict = checkDelivery(stranger, true);
    expect(verdict.deliverable).toBe(false);
    if (verdict.deliverable) return;
    expect(verdict.refusals.map((r) => r.code)).toContain('UNKNOWN_KEY');
  });

  it('the refusal says what would lift it, not merely that it happened', () => {
    const verdict = checkDelivery(envelopes(), true);
    expect(verdict.deliverable).toBe(false);
    if (verdict.deliverable) return;
    const said = verdict.refusals.find((r) => r.code === 'NO_RELEASE_CUSTODY_EXISTS')!.message;
    expect(said).toContain('OD-25');
    expect(said).toContain('HARDWARE_BACKED');
  });
});
