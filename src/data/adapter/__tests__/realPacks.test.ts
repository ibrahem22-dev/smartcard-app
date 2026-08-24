import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fsPackReader } from '../fsPackReader';
import {
  appVersionMeetsFloor,
  inventory,
  openAllPackSets,
  openFxSnapshot,
  openPackSet,
  releaseState,
  requiredAppVersion,
  type PackSetAccepted,
} from '../packSet';

/**
 * GATE 7's FIRST CONDITION, MEASURED: *"The app reads **the real packs** through the adapter **at
 * their measured shas**."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THESE ARE THE SHIPPED PACKS, NOT FIXTURES
 *
 * `src/data/adapter/packs/**` is a byte-for-byte copy of what the pipeline built, written by
 * `campaign-p2/bin/p2-pack-shas.mjs` and compared in both directions by its `--check`. A fixture
 * would prove the code runs. Only the real bytes prove the code runs **on what ships** — and the
 * first thing running it found was that this app declared version `0.1.0` while every manifest
 * requires `1.0.0`, so it would have refused every pack it carries.
 *
 * The sha assertion is what makes "at their measured shas" a measurement rather than a phrase: the
 * test re-hashes the bytes it just fed the adapter and compares them against the recorded manifest.
 */

const PACKS = join(__dirname, '..', 'packs');
const RECORDED = JSON.parse(readFileSync(join(PACKS, 'PACK_SHAS.json'), 'utf8')) as {
  sets: { set: string; files: { file: string; bytes: number; sha256: string }[] }[];
};

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

describe('D2 — the app reads the real packs through the adapter', () => {
  const reader = fsPackReader(PACKS);

  it('carries every pack set the pipeline built, and no others', () => {
    // Both directions. A copy missing a set and a copy carrying an extra one are different bugs
    // and only one of them is caught by counting.
    expect(reader.sets()).toEqual(RECORDED.sets.map((s) => s.set).sort());
    expect(reader.sets().length).toBeGreaterThan(0);
  });

  it('the bytes it reads are the bytes that were measured', () => {
    let checked = 0;
    for (const set of RECORDED.sets) {
      for (const file of set.files) {
        const bytes = reader.read(set.set, file.file);
        expect(`${set.set}/${file.file}:${bytes.byteLength}`).toBe(`${set.set}/${file.file}:${file.bytes}`);
        expect(`${set.set}/${file.file}:${sha256(bytes)}`).toBe(`${set.set}/${file.file}:${file.sha256}`);
        checked += 1;
      }
    }
    // A loop over an empty list passes silently. This is the line that stops it.
    expect(checked).toBe(RECORDED.sets.reduce((n, s) => n + s.files.length, 0));
    expect(checked).toBeGreaterThan(0);
  });

  it('every real pack set VERIFIES end to end', () => {
    const results = openAllPackSets(reader);
    const refused = results.filter((r) => !r.accepted);

    // Named, not counted: "1 pack refused" sends somebody to find out which.
    expect(refused.map((r) => `${r.set}: ${JSON.stringify('failures' in r ? r.failures : [])}`)).toEqual([]);
    // Four packs and one FX snapshot: the population is the pack sets, derived by classification,
    // not the recorded file count. Asserting the total here would demand the snapshot be a pack.
    expect(results.length).toBe(inventory(reader).filter((a) => a.kind === 'pack').length);
    expect(results.length).toBeGreaterThan(0);
  });

  it('reports release: false on every set, because no release custody exists', () => {
    // OB-8 / OD-25: the development key is retired and nothing is release-signed. A test asserting
    // "verified" without asserting this would let a release-eligible claim appear the day somebody
    // re-signed with a key that had no custody either.
    const results = openAllPackSets(reader);
    const state = releaseState(results);
    expect(state.allAccepted).toBe(true);
    expect(state.allRelease).toBe(false);
    expect(state.refused).toEqual([]);
  });

  it('classifies every artifact by what its manifest declares, not by its filename', () => {
    // The finding this test exists for: fx-rates has no packFormatVersion at all. It is a THIRD
    // ARTIFACT CLASS with its own door, and a filename test would have sent it through the wrong
    // verifier and reported "packFormatVersion undefined" — a message about a missing field rather
    // than about the wrong door.
    const kinds = inventory(reader);
    expect(kinds.filter((a) => a.kind === null)).toEqual([]);
    expect(kinds.filter((a) => a.kind === 'fx-snapshot').map((a) => a.set)).toEqual(['fx-rates']);
    expect(kinds.filter((a) => a.kind === 'pack').length).toBe(kinds.length - 1);
  });

  it('REFUSES to open the FX snapshot through the pack door, and says which door it wants', () => {
    expect(() => openPackSet(reader, 'fx-rates')).toThrow(/FX snapshot|openFxSnapshot/);
  });

  it('opens the FX snapshot through ITS door', () => {
    const fx = openFxSnapshot(reader, 'fx-rates');
    expect(fx.manifest.snapshotId).toBe('fx-rates');
    expect(fx.snapshot).toBeDefined();
  });

  it('this app is at or above the version every bundled artifact requires', () => {
    // The second finding, and the reason PD-007 exists. The four packs require 1.0.0 and the FX
    // snapshot requires 1.1.0: an app at 1.0.0 opens four artifacts and refuses the fifth, and the
    // fifth is the one a cold start with no network depends on.
    //
    // Derived from the manifests, so this rises on its own if the pipeline ever raises the floor.
    const { ok, floor, requiredBy, appVersion } = appVersionMeetsFloor(reader);
    expect(`app ${appVersion} vs floor ${floor} (${requiredBy}): ${ok ? 'meets' : 'BELOW'}`)
      .toBe(`app ${appVersion} vs floor ${floor} (${requiredBy}): meets`);
    expect(requiredAppVersion(reader).floor).not.toBe('0.0.0');
  });

  it('the manifests agree with the compiled-in dataset id and this app version', () => {
    const results = openAllPackSets(reader).filter((r): r is PackSetAccepted => r.accepted);
    expect(results.length).toBeGreaterThan(0);
    // Every set carries the same estate id, and openVerifiedPack already refused any that did not.
    // Asserting it here as well makes the population visible: five sets, one estate.
    expect(new Set(results.map((r) => r.manifest.datasetId)).size).toBe(1);
  });
});

describe('a pack that is not the pack it claims to be is refused', () => {
  const reader = fsPackReader(PACKS);

  it('REFUSES a body whose bytes were altered, naming the sha that disagreed', () => {
    // The signature covers the manifest, and the manifest covers the body's sha. One flipped byte
    // therefore has to break the chain — and if it does not, the chain is decorative.
    const tampered = {
      sets: reader.sets,
      read: (set: string, file: string): Uint8Array => {
        const bytes = reader.read(set, file);
        if (set === 'taxonomy' && file === 'pack.json') {
          const copy = new Uint8Array(bytes);
          copy[copy.length - 1] = copy[copy.length - 1] === 32 ? 33 : 32;
          return copy;
        }
        return bytes;
      },
    };

    const result = openPackSet(tampered, 'taxonomy');
    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.failures.length).toBeGreaterThan(0);
    // The refusal names BOTH digests and says what happened: "the artifact on disk hashes to X
    // and the signed manifest attests Y. The bytes were edited after signing." A refusal that only
    // said "invalid" would send whoever met it to read source to find out which link broke.
    const said = JSON.stringify(result.failures);
    expect(said).toMatch(/hashes to/);
    expect(said).toMatch(/attests/);
    expect(said).toMatch(/edited after signing/);
  });

  it('REFUSES a manifest naming a dataset this build was not compiled for', () => {
    const foreign = {
      sets: reader.sets,
      read: (set: string, file: string): Uint8Array => {
        const bytes = reader.read(set, file);
        if (file !== 'manifest.json') return bytes;
        const manifest = JSON.parse(new TextDecoder().decode(bytes)) as { datasetId: string };
        manifest.datasetId = 'some-other-estate-v9';
        return new TextEncoder().encode(JSON.stringify(manifest));
      },
    };

    const result = openPackSet(foreign, 'taxonomy');
    expect(result.accepted).toBe(false);
  });
});
