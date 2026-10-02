import { join } from 'node:path';

import {
  COMPATIBILITY_MATRIX,
  supportedPackFormats,
  supportedSnapshotFormats,
} from '@smartcard/data-authority-adapter';

import { fsPackReader } from '../fsPackReader';
import { inventory, openFxSnapshot, openPackSet, type PackReader } from '../packSet';

/**
 * CRITERION C6, MEASURED AGAINST THE REAL ARTIFACTS.
 *
 *   > **C6.** *"Shape skew is refused: the adapter ↔ `packFormatVersion` matrix is enforced **at
 *   > load**, proven by a **load-time rejection of an incompatible pair**."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "AT LOAD" IS THE WHOLE CLAIM, AND A FUNCTION CALL ON AN INTEGER DOES NOT PROVE IT
 *
 * `adapterSeam.test.ts` already proves `checkPackCompatibility(n)` refuses an unreadable format.
 * That is a claim about a function. C6 is a claim about **the door the app actually opens packs
 * with** — so every case here goes through `openPackSet` / `openFxSnapshot`, carrying a real
 * manifest, a real envelope and real bytes, with one field skewed.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE ORDER IS PART OF THE CRITERION
 *
 * The adapter states it: *"Compatibility is checked FIRST, before the signature: an adapter that
 * cannot read the pack's shape has no business deciding whether the shape it cannot read is
 * correctly signed, and reporting 'invalid signature' for a format mismatch sends whoever reads
 * the error somewhere useless."*
 *
 * Skewing `packFormatVersion` also invalidates the signature, because the envelope signs the
 * manifest's sha. So a refusal that named the signature would be a *true* statement that hides the
 * cause. The test requires the format to be named.
 */

const PACKS = join(__dirname, '..', 'packs');
const decoder = new TextDecoder();
const encoder = new TextEncoder();

/** A reader that rewrites one manifest field. Everything else is the real artifact. */
const skewing = (base: PackReader, field: string, value: unknown): PackReader => ({
  sets: base.sets,
  read: (set, file) => {
    const bytes = base.read(set, file);
    if (file !== 'manifest.json') return bytes;
    const manifest = JSON.parse(decoder.decode(bytes)) as Record<string, unknown>;
    manifest[field] = value;
    return encoder.encode(JSON.stringify(manifest));
  },
});

describe('C6 — shape skew is refused at load', () => {
  const reader = fsPackReader(PACKS);
  const packSets = inventory(reader).filter((a) => a.kind === 'pack').map((a) => a.set);
  const fxSets = inventory(reader).filter((a) => a.kind === 'fx-snapshot').map((a) => a.set);
  // Named, not indexed. `fxSets[0]` is `string | undefined` and every use of it would need a
  // non-null assertion — which is the kind of silence that turns "there was no snapshot" into a
  // passing test.
  const theFxSet = (): string => {
    const set = fxSets[0];
    if (set === undefined) throw new Error('no FX snapshot in the bundled artifacts — C6 has nothing to measure on the snapshot axis');
    return set;
  };

  it('has real artifacts to measure — an empty population would prove nothing', () => {
    expect(packSets.length).toBeGreaterThan(0);
    expect(fxSets.length).toBeGreaterThan(0);
  });

  it('every shipped pack declares a format the adapter says it can read', () => {
    const supported = supportedPackFormats();
    expect(supported.length).toBeGreaterThan(0);

    for (const set of packSets) {
      const manifest = JSON.parse(decoder.decode(reader.read(set, 'manifest.json'))) as {
        packFormatVersion: number;
      };
      expect(`${set}: format ${manifest.packFormatVersion} in ${JSON.stringify(supported)}`).toBe(
        `${set}: format ${manifest.packFormatVersion} in ${JSON.stringify(supported)}`,
      );
      expect(supported).toContain(manifest.packFormatVersion);
    }
  });

  it('the matrix covers every format the adapter claims to support', () => {
    // Two homes for one fact inside the adapter: supportedPackFormats() and COMPATIBILITY_MATRIX.
    // A format the adapter says it reads with no row to decide it would be a load-time check with
    // nothing behind it.
    const rows = COMPATIBILITY_MATRIX.map((r) => r.packFormatVersion).sort();
    expect(supportedPackFormats().slice().sort()).toEqual(rows);
  });

  describe.each(['catalog', 'benefits', 'content', 'taxonomy'])('%s', (set) => {
    it('is REFUSED at load when its packFormatVersion is one the adapter cannot read', () => {
      const unreadable = Math.max(...supportedPackFormats()) + 1;
      const result = openPackSet(skewing(reader, 'packFormatVersion', unreadable), set);

      expect(result.accepted).toBe(false);
      if (result.accepted) return;

      const said = JSON.stringify(result.failures);
      // The FORMAT must be named. Skewing it also breaks the signature, so a refusal that reported
      // only the signature would be true and useless.
      expect(said).toMatch(/packFormatVersion|format/i);
      expect(said).toContain(String(unreadable));
    });
  });

  it('names the format, not the signature, when both are wrong', () => {
    const unreadable = Math.max(...supportedPackFormats()) + 1;
    const result = openPackSet(skewing(reader, 'packFormatVersion', unreadable), 'taxonomy');
    expect(result.accepted).toBe(false);
    if (result.accepted) return;

    const first = JSON.stringify(result.failures[0]);
    expect(first).toMatch(/format/i);
  });

  it('REFUSES a pack claiming a format below the matrix as well as above it', () => {
    // A one-sided check passes for the skew nobody tries. 0 is below every row.
    const result = openPackSet(skewing(reader, 'packFormatVersion', 0), 'catalog');
    expect(result.accepted).toBe(false);
  });

  it('REFUSES a pack whose format field is not a number at all', () => {
    // A string "1" is what a hand-edited manifest looks like, and JSON will not stop it. This is a
    // REFUSAL and not an exception on purpose: a corrupted artifact can arrive on a device at any
    // time, and a load path that threw would take a screen down instead of refusing a pack.
    const result = openPackSet(skewing(reader, 'packFormatVersion', '1'), 'catalog');
    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(JSON.stringify(result.failures)).toMatch(/exactly one of them, as a number/);
  });

  it('REFUSES a manifest claiming BOTH artifact classes', () => {
    const result = openPackSet(skewing(reader, 'snapshotFormatVersion', 1), 'catalog');
    expect(result.accepted).toBe(false);
  });

  it('THROWS when the FX snapshot is sent through the pack door — a caller bug, not a data problem', () => {
    // The distinction is the point: the artifact is fine and the code asked the wrong verifier.
    // Throwing keeps it from being caught and shown to somebody as a data problem.
    expect(() => openPackSet(reader, theFxSet())).toThrow(/openFxSnapshot/);
  });

  it('the FX snapshot has its OWN format axis, and it is enforced too', () => {
    const supported = supportedSnapshotFormats();
    expect(supported.length).toBeGreaterThan(0);

    const set = theFxSet();
    const manifest = JSON.parse(decoder.decode(reader.read(set, 'manifest.json'))) as {
      snapshotFormatVersion: number;
    };
    expect(supported).toContain(manifest.snapshotFormatVersion);

    const unreadable = Math.max(...supported) + 1;
    expect(() => openFxSnapshot(skewing(reader, 'snapshotFormatVersion', unreadable), set)).toThrow();
  });

  it('accepts every real artifact when nothing is skewed — the control that keeps the rest honest', () => {
    // Without this, every assertion above would still pass if the door refused everything.
    for (const set of packSets) expect(openPackSet(reader, set).accepted).toBe(true);
    expect(openFxSnapshot(reader, theFxSet()).manifest).toBeDefined();
  });
});
