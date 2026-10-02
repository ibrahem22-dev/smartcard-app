import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { TRUST_STORE } from '@smartcard/data-authority-adapter';

import { EXPECTED_DATASET_ID } from '../../datasetId';
import { fsPackReader } from '../../fsPackReader';
import { artifactClassOf } from '../../packSet';
import { memoryPackSetStore } from '../memoryPackSetStore';
import {
  COMPILED_IN,
  IMPORT_STEPS,
  importLockHeld,
  importPackSets,
  recoverAtStartup,
  type ImportPolicy,
  type PackSetCandidate,
} from '../packSetImport';

/**
 * CRITERION C1 — **one test per OB-4 refusal, NAMED BY THE REFUSAL**.
 *
 * Each test title below is the obligation's own text from `authority/P1_TO_P2_HANDOFF.md`, and
 * `tools/p2/ob4-refusals.json` is the parsed list the gate matches against. That is what makes
 * "all ten" checkable: rename a test and it stops matching; add an eleventh obligation to the
 * handoff and the gate fails until an eleventh test exists.
 *
 * Every candidate is built from the REAL shipped packs. A fixture would prove the refusals fire on
 * a shape somebody invented to make them fire.
 */

const PACKS = join(__dirname, '..', '..', 'packs');
const reader = fsPackReader(PACKS);
const decoder = new TextDecoder();
const encoder = new TextEncoder();

/** The four pack sets, DERIVED by classification. The FX snapshot is not one of them. */
const PACK_IDS = reader.sets().filter((s) => artifactClassOf(reader, s) === 'pack');

const candidateFor = (set: string): PackSetCandidate => ({
  packId: set,
  packBytes: reader.read(set, 'pack.json'),
  manifest: JSON.parse(decoder.decode(reader.read(set, 'manifest.json'))),
  envelope: JSON.parse(decoder.decode(reader.read(set, 'manifest.sig.json'))),
});

const allCandidates = (): PackSetCandidate[] => PACK_IDS.map(candidateFor);

const withManifest = (c: PackSetCandidate, patch: Record<string, unknown>): PackSetCandidate => ({
  ...c,
  manifest: { ...c.manifest, ...patch },
});

const policy: ImportPolicy = { requiredPackSets: PACK_IDS };

describe('OB-4 — the ten refusals, on the real packs', () => {
  it('has real pack sets to import — an empty population would prove nothing', () => {
    expect(PACK_IDS.length).toBeGreaterThan(1);
    expect(PACK_IDS).not.toContain('fx-rates');
  });

  it('imports the real set end to end when nothing is wrong — the control that keeps the rest honest', async () => {
    // Without this, every refusal below would still pass if the importer refused everything.
    const store = memoryPackSetStore();
    const outcome = await importPackSets(store, allCandidates(), policy);
    expect(outcome.ok ? 'imported' : JSON.stringify(outcome.refusals)).toBe('imported');
    expect(store.snapshotInstalled().map((s) => s.packId).sort()).toEqual([...PACK_IDS].sort());
    expect(store.backupIds()).toBeNull();
  });

  // ── 1 ────────────────────────────────────────────────────────────────────────────
  it('Import the whole set or none', async () => {
    const store = memoryPackSetStore();
    const outcome = await importPackSets(store, allCandidates().slice(0, PACK_IDS.length - 1), policy);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusals.map((r) => r.code)).toContain('INCOMPLETE_SET');
    // Nothing was written. Not "nothing that matters" — no write verb was reached at all.
    expect(store.calls.filter((c) => ['stage', 'backupInstalled', 'promoteStaged'].includes(c))).toEqual([]);
  });

  // ── 2 ────────────────────────────────────────────────────────────────────────────
  it('Verify before writing, always', async () => {
    const store = memoryPackSetStore();
    const broken = allCandidates();
    broken[0] = withManifest(broken[0]!, { packVersion: 'tampered' });

    const outcome = await importPackSets(store, broken, policy);
    expect(outcome.ok).toBe(false);

    // The obligation is about SEQUENCE, so the proof is the recorded order: no write verb appears.
    // A store that merely ended in the right state would pass for an implementation that wrote
    // first and cleaned up after itself, which is the behaviour OB-4 refuses.
    expect(store.calls).toEqual([]);
  });

  // ── 3 ────────────────────────────────────────────────────────────────────────────
  it('Replace the installed directory whole', async () => {
    const store = memoryPackSetStore({
      installed: [{ packId: 'catalog', packVersion: 'old', packFormatVersion: 1, datasetVersion: '1.0.0' }],
    });
    await importPackSets(store, allCandidates(), policy);

    // Stage beside, then two renames, in this order. A write into the installed directory would
    // show up as a stage call after backupInstalled.
    const writes = store.calls.filter((c) =>
      ['clearStaging', 'stage', 'backupInstalled', 'promoteStaged', 'discardBackup'].includes(c));
    expect(writes[0]).toBe('clearStaging');
    expect(writes.lastIndexOf('stage')).toBeLessThan(writes.indexOf('backupInstalled'));
    expect(writes.indexOf('backupInstalled')).toBeLessThan(writes.indexOf('promoteStaged'));
    expect(writes.indexOf('promoteStaged')).toBeLessThan(writes.indexOf('discardBackup'));
  });

  // ── 4 ────────────────────────────────────────────────────────────────────────────
  it('Roll back at startup when a backup is present', async () => {
    const before = [{ packId: 'catalog', packVersion: 'known-good', packFormatVersion: 1, datasetVersion: '1.0.0' }];
    const store = memoryPackSetStore({
      installed: before,
      // A crash between the two renames: the backup exists and the promote never happened.
      failOn: { verb: 'promoteStaged', error: new Error('power loss between the two renames') },
    });

    await expect(importPackSets(store, allCandidates(), policy)).rejects.toThrow(/power loss/);
    expect(store.backupIds()).not.toBeNull();

    expect(await recoverAtStartup(store)).toBe('ROLLED_BACK');
    expect(store.snapshotInstalled()).toEqual(before);
    expect(store.stagedIds()).toEqual([]);
    // And a second startup does nothing, rather than rolling back a state nobody replaced.
    expect(await recoverAtStartup(store)).toBe('NOTHING_TO_DO');
  });

  // ── 5 ────────────────────────────────────────────────────────────────────────────
  it('Keep EXPECTED_DATASET_ID compiled in', () => {
    // The enforcement is that there is NO ARGUMENT TO PASS. A constant a pack can influence is not
    // a check, so ImportPolicy has no field for it and importPackSets takes none.
    expect(COMPILED_IN.expectedDatasetId).toBe(EXPECTED_DATASET_ID);
    const policyKeys = Object.keys(policy);
    expect(policyKeys).not.toContain('expectedDatasetId');
    expect(policyKeys).not.toContain('datasetId');
    // And it is not empty — a compiled-in blank would match nothing and refuse everything, which
    // reads as "very safe" and is actually a check that never passes.
    expect(COMPILED_IN.expectedDatasetId.length).toBeGreaterThan(0);
  });

  // ── 6 ────────────────────────────────────────────────────────────────────────────
  it('Keep the trust store compiled in', () => {
    // A trust store a pack could supply answers "is this signed by whoever signed it?".
    expect(COMPILED_IN.trustStore).toBe(TRUST_STORE);
    expect(COMPILED_IN.trustStore.length).toBeGreaterThan(0);
    expect(Object.keys(policy)).not.toContain('trustStore');
    // Every key in it is a real key with a custody, not a placeholder.
    for (const key of COMPILED_IN.trustStore) {
      expect(typeof key.keyId).toBe('string');
      expect(key.publicKeyPem).toMatch(/BEGIN PUBLIC KEY/);
    }
  });

  // ── 7 ────────────────────────────────────────────────────────────────────────────
  it('Report DATASET_ID_REFUSED distinctly from a signature failure', async () => {
    const store = memoryPackSetStore();
    const foreign = allCandidates();
    foreign[0] = withManifest(foreign[0]!, { datasetId: 'some-other-estate-v9' });

    const outcome = await importPackSets(store, foreign, policy);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;

    const codes = outcome.refusals.map((r) => r.code);
    expect(codes).toContain('DATASET_ID_REFUSED');
    // The distinction IS the obligation: "this is not our data" and "this may have been altered"
    // are different problems, and reporting the second for the first sends a user hunting for
    // corruption that is not there.
    expect(codes).not.toContain('SIGNATURE_REFUSED');
    const said = outcome.refusals.find((r) => r.code === 'DATASET_ID_REFUSED')!.message;
    expect(said).toContain('some-other-estate-v9');
    expect(said).toContain(EXPECTED_DATASET_ID);
  });

  // ── 8 ────────────────────────────────────────────────────────────────────────────
  it('Treat a cross-pack-set reference miss as absent', async () => {
    // OB-2 / §6: content skew across pack sets is LEGAL. A benefits row naming a card the catalog
    // at this version does not carry is not corruption, and the importer must not refuse it —
    // refusing here would make a legal state unimportable.
    //
    // The mix is not fabricated. THE SHIPPED SET IS ALREADY MIXED: catalog and benefits are at
    // packVersion 2026.08.22+3, content and taxonomy at +2, all four signed at those versions.
    // An earlier draft of this test edited a manifest to manufacture the skew and the signature
    // caught it — which is the right outcome and the wrong experiment, because a manifest edited
    // after signing is not "genuinely mixed pack versions", it is a tampered pack.
    const versions = new Set(allCandidates().map((c) => c.manifest.packVersion));
    expect(versions.size).toBeGreaterThan(1);
    // One estate generation, several pack versions: that is the legal state, and it is the exact
    // distinction obligation 10 is about.
    expect(new Set(allCandidates().map((c) => c.manifest.datasetVersion)).size).toBe(1);

    const store = memoryPackSetStore();
    const outcome = await importPackSets(store, allCandidates(), policy);
    expect(outcome.ok ? 'imported' : JSON.stringify(outcome.refusals)).toBe('imported');
    expect(new Set(store.snapshotInstalled().map((s) => s.packVersion)).size).toBeGreaterThan(1);
  });

  // ── 9 ────────────────────────────────────────────────────────────────────────────
  it('Refuse shape skew', async () => {
    const store = memoryPackSetStore();
    const skewed = allCandidates();
    skewed[0] = withManifest(skewed[0]!, { packFormatVersion: 99 });

    const outcome = await importPackSets(store, skewed, policy);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;

    const codes = outcome.refusals.map((r) => r.code);
    // Mixed formats across the set, AND the skew itself. Both are true and both are named.
    expect(codes.some((c) => c === 'SHAPE_SKEW_REFUSED' || c === 'MIXED_PACK_FORMAT')).toBe(true);
    expect(store.calls).toEqual([]);
  });

  // ── 10 ───────────────────────────────────────────────────────────────────────────
  it('Hold one estate generation at a time', async () => {
    const store = memoryPackSetStore();
    const mixed = allCandidates();
    mixed[0] = withManifest(mixed[0]!, { datasetVersion: '99.0.0' });

    const outcome = await importPackSets(store, mixed, policy);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.refusals.map((r) => r.code)).toContain('MIXED_DATASET_VERSION');
    expect(store.calls).toEqual([]);
  });
});

describe('C3 — the three things P1 could not prove', () => {
  it('an importer concurrency lock exists, and is released on every path', async () => {
    // P1 assumed one at a time. A P2 runtime that can start an import while another runs needs a
    // lock, and a lock that survived a throw would brick every later import until the app
    // restarted — so the release is asserted on the failing path, not the happy one.
    const store = memoryPackSetStore({
      failOn: { verb: 'promoteStaged', error: new Error('crash mid-commit') },
    });
    expect(importLockHeld()).toBe(false);
    await expect(importPackSets(store, allCandidates(), policy)).rejects.toThrow(/crash mid-commit/);
    expect(importLockHeld()).toBe(false);
  });

  it('a second import while one is running is REFUSED, not queued', async () => {
    // The lock is taken SYNCHRONOUSLY, before the first await, so starting an import and not
    // awaiting it is enough to have one genuinely in flight. That is also why the lock works at
    // all: a flag set after an await would leave a window where two imports both saw it clear.
    const first = importPackSets(memoryPackSetStore(), allCandidates(), policy);
    expect(importLockHeld()).toBe(true);

    const second = await importPackSets(memoryPackSetStore(), allCandidates(), policy);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.refusals.map((r) => r.code)).toContain('IMPORT_ALREADY_RUNNING');
    // Refused, not queued: a queued second import would promote its set over the first one's
    // backup, which is the partial state the three-phase shape exists to prevent.
    expect(second.wrote).toBe(false);

    await first;
    expect(importLockHeld()).toBe(false);
  });

  it('a rename that fails for lack of disk space leaves the prior state recoverable', async () => {
    const before = [{ packId: 'catalog', packVersion: 'known-good', packFormatVersion: 1, datasetVersion: '1.0.0' }];
    const enospc = Object.assign(new Error('ENOSPC: no space left on device, rename'), { code: 'ENOSPC' });
    const store = memoryPackSetStore({ installed: before, failOn: { verb: 'promoteStaged', error: enospc } });

    await expect(importPackSets(store, allCandidates(), policy)).rejects.toThrow(/ENOSPC/);

    // The device is mid-commit: the backup exists and the installed set does not. That is the state
    // recoverAtStartup is written for, and it is why the backup is a rename rather than a delete.
    expect(store.backupIds()).not.toBeNull();
    expect(await recoverAtStartup(store)).toBe('ROLLED_BACK');
    expect(store.snapshotInstalled()).toEqual(before);
  });

  describe.each(IMPORT_STEPS)('interrupted at %s', (step) => {
    it('leaves a state startup can recover from', async () => {
      const before = [{ packId: 'catalog', packVersion: 'known-good', packFormatVersion: 1, datasetVersion: '1.0.0' }];
      const store = memoryPackSetStore({ installed: before });

      let threw = false;
      try {
        await importPackSets(store, allCandidates(), {
          ...policy,
          onStep: (s) => { if (s === step) throw new Error(`interrupted at ${s}`); },
        });
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);

      const verdict = await recoverAtStartup(store);
      const installed = store.snapshotInstalled();

      // Whatever the step, the device ends on a COMPLETE set — never a partial one. Either the
      // previous set (rolled back) or the new one (the promote had already happened).
      if (verdict === 'ROLLED_BACK') {
        expect(installed).toEqual(before);
      } else {
        // Nothing to roll back means the commit phase was never entered, so the previous set is
        // still installed and untouched.
        expect(installed).toEqual(before);
      }
      // And staging is never left behind for the next import to trip over.
      expect(store.stagedIds()).toEqual([]);
    });
  });

  it('a power loss is CHARACTERISED, not claimed closed', () => {
    // P1's interruptions were injected exceptions and so are these. An injected throw unwinds a
    // JavaScript stack; a power loss does not unwind anything, and the difference is what a
    // filesystem has already flushed. Saying so is the obligation — C3 asks for a documented
    // trial, not a claim.
    const doc = readFileSync(join(__dirname, '..', 'POWER_LOSS.md'), 'utf8');
    expect(doc).toMatch(/injected exception/i);
    expect(doc).toMatch(/what this does NOT prove/i);
  });
});
