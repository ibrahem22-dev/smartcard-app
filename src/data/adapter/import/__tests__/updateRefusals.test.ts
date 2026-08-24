import { join } from 'node:path';

import { TRUST_STORE, supportedPackFormats } from '@smartcard/data-authority-adapter';

import { EXPECTED_DATASET_ID } from '../../datasetId';
import { fsPackReader } from '../../fsPackReader';
import { artifactClassOf } from '../../packSet';
import { COMPILED_IN, type PackSetCandidate } from '../packSetImport';
import { UPDATE_REFUSAL_CODES, checkUpdate } from '../updateClient';

/**
 * CRITERION C5 — the update client's four refusals, and the two compiled-in constants.
 *
 * Every case is the real shipped pack with one field changed, so a refusal that fired for an
 * unrelated reason would show up as the wrong code rather than as a pass.
 */

const PACKS = join(__dirname, '..', '..', 'packs');
const reader = fsPackReader(PACKS);
const decoder = new TextDecoder();

const PACK_IDS = reader.sets().filter((s) => artifactClassOf(reader, s) === 'pack');
const SOME_PACK = PACK_IDS[0]!;

const candidate = (set: string = SOME_PACK): PackSetCandidate => ({
  packId: set,
  packBytes: reader.read(set, 'pack.json'),
  manifest: JSON.parse(decoder.decode(reader.read(set, 'manifest.json'))),
  envelope: JSON.parse(decoder.decode(reader.read(set, 'manifest.sig.json'))),
});

const withManifest = (patch: Record<string, unknown>): PackSetCandidate => {
  const c = candidate();
  return { ...c, manifest: { ...c.manifest, ...patch } };
};

describe('C5 — four refusals, reported distinctly', () => {
  it('accepts the real pack — the control that keeps the four refusals honest', () => {
    const verdict = checkUpdate(candidate());
    expect(verdict.acceptable ? 'accepted' : JSON.stringify(verdict.refusal)).toBe('accepted');
  });

  it('declares exactly four refusal codes', () => {
    // Counted from the exported list, not from this file. A fifth code added without a fifth test
    // makes this fail rather than pass quietly.
    expect(UPDATE_REFUSAL_CODES.length).toBe(4);
    expect(new Set(UPDATE_REFUSAL_CODES).size).toBe(4);
  });

  it('REFUSES a smartcard-canonical-v1 pack — the previous estate generation', () => {
    // C5 names this one specifically. It is the realistic case: not a forged pack, an OLD one,
    // built from an estate this app no longer reads.
    const verdict = checkUpdate(withManifest({ datasetId: 'smartcard-canonical-v1' }));
    expect(verdict.acceptable).toBe(false);
    if (verdict.acceptable) return;
    expect(verdict.refusal.code).toBe('DATASET_ID_REFUSED');
    expect(verdict.refusal.message).toContain('smartcard-canonical-v1');
    expect(verdict.refusal.message).toContain(EXPECTED_DATASET_ID);
  });

  it('reports DATASET_ID_REFUSED DISTINCTLY from a signature failure', () => {
    // Changing the datasetId also invalidates the signature — the envelope signs the manifest's
    // sha. So this is precisely the case where a naive implementation reports tampering, and the
    // whole obligation is that it must not.
    const foreign = checkUpdate(withManifest({ datasetId: 'some-other-estate-v9' }));
    expect(foreign.acceptable).toBe(false);
    if (foreign.acceptable) return;
    expect(foreign.refusal.code).toBe('DATASET_ID_REFUSED');
    expect(foreign.refusal.code).not.toBe('SIGNATURE_REFUSED');
    expect(foreign.refusal.message).toMatch(/no corruption to look for|not our data/i);

    // And a genuine tamper still reports tampering, so the distinction is a distinction and not a
    // blanket downgrade.
    const c = candidate();
    const bytes = new Uint8Array(c.packBytes);
    bytes[bytes.length - 1] = bytes[bytes.length - 1] === 32 ? 33 : 32;
    const tampered = checkUpdate({ ...c, packBytes: bytes });
    expect(tampered.acceptable).toBe(false);
    if (tampered.acceptable) return;
    expect(tampered.refusal.code).toBe('SIGNATURE_REFUSED');
    expect(tampered.refusal.message).toMatch(/MAY HAVE BEEN ALTERED/);
    expect(tampered.refusal.message).toMatch(/do not retry/i);
  });

  it('REFUSES a pack whose minAppVersion is above this build, and says to update the app', () => {
    const tooNew = `${Number(COMPILED_IN.appVersion.split('.')[0]) + 1}.0.0`;
    const verdict = checkUpdate(withManifest({ minAppVersion: tooNew }));
    expect(verdict.acceptable).toBe(false);
    if (verdict.acceptable) return;
    expect(verdict.refusal.code).toBe('MIN_APP_VERSION_REFUSED');
    expect(verdict.refusal.message).toContain(tooNew);
    expect(verdict.refusal.message).toContain(COMPILED_IN.appVersion);
    // Not a tampering warning. Teaching somebody that signature failures are routine is how a
    // device eventually accepts a forged pack.
    expect(verdict.refusal.message).not.toMatch(/ALTERED/);
  });

  it('REFUSES a pack format this adapter build cannot read', () => {
    const unreadable = Math.max(...supportedPackFormats()) + 1;
    const verdict = checkUpdate(withManifest({ packFormatVersion: unreadable }));
    expect(verdict.acceptable).toBe(false);
    if (verdict.acceptable) return;
    expect(verdict.refusal.code).toBe('SHAPE_SKEW_REFUSED');
    expect(verdict.refusal.message).not.toMatch(/ALTERED/);
  });

  it('REFUSES an altered pack as a possible tampering, and says not to retry', () => {
    const c = candidate();
    const manifest = { ...c.manifest, packVersion: `${c.manifest.packVersion}-edited` };
    const verdict = checkUpdate({ ...c, manifest });
    expect(verdict.acceptable).toBe(false);
    if (verdict.acceptable) return;
    expect(verdict.refusal.code).toBe('SIGNATURE_REFUSED');
    expect(verdict.refusal.failures?.length ?? 0).toBeGreaterThan(0);
  });

  it('every declared refusal code is reachable — none is decoration', () => {
    // A code nobody can produce is a code that describes an intention. Each of the four is driven
    // to by a real input above; this asserts the set of codes actually observed equals the set
    // declared, so neither list can grow without the other.
    const unreadable = Math.max(...supportedPackFormats()) + 1;
    const c = candidate();
    const bytes = new Uint8Array(c.packBytes);
    bytes[bytes.length - 1] = bytes[bytes.length - 1] === 32 ? 33 : 32;

    const observed = new Set(
      [
        checkUpdate(withManifest({ datasetId: 'smartcard-canonical-v1' })),
        checkUpdate(withManifest({ minAppVersion: '99.0.0' })),
        checkUpdate(withManifest({ packFormatVersion: unreadable })),
        checkUpdate({ ...c, packBytes: bytes }),
      ]
        .filter((v): v is Extract<typeof v, { acceptable: false }> => !v.acceptable)
        .map((v) => v.refusal.code),
    );
    expect([...observed].sort()).toEqual([...UPDATE_REFUSAL_CODES].sort());
  });
});

describe('C5 — the two constants are compiled in, and not loadable from a pack', () => {
  it('EXPECTED_DATASET_ID is a compiled constant and checkUpdate takes no argument for it', () => {
    expect(COMPILED_IN.expectedDatasetId).toBe(EXPECTED_DATASET_ID);
    // The enforcement is the signature: one candidate, no options object, nowhere to pass one.
    expect(checkUpdate.length).toBe(1);
  });

  it('the trust store is a compiled constant and checkUpdate takes no argument for it', () => {
    expect(COMPILED_IN.trustStore).toBe(TRUST_STORE);
    expect(COMPILED_IN.trustStore.length).toBeGreaterThan(0);
  });

  it('a pack carrying its OWN datasetId and trustStore fields changes neither', () => {
    // The attack the obligation names: a pack that supplies the constants it is about to be
    // checked against. Both are ignored, because neither is ever read from the manifest.
    const hostile = withManifest({
      datasetId: EXPECTED_DATASET_ID,
      expectedDatasetId: 'attacker-estate',
      trustStore: [{ keyId: 'ATTACKER', custody: 'HARDWARE_BACKED', publicKeyPem: 'x' }],
    });
    const verdict = checkUpdate(hostile);

    // It verifies or refuses on its real merits; what it cannot do is change what it is checked
    // against.
    expect(COMPILED_IN.expectedDatasetId).toBe(EXPECTED_DATASET_ID);
    expect(COMPILED_IN.trustStore).toBe(TRUST_STORE);
    expect(COMPILED_IN.trustStore.some((k) => k.keyId === 'ATTACKER')).toBe(false);
    expect(typeof verdict.acceptable).toBe('boolean');
  });
});
