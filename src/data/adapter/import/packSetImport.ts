import {
  openVerifiedPack,
  TRUST_STORE,
  type EnvelopeFailure,
  type PackManifest,
  type SignatureEnvelope,
  type TrustedKey,
} from '@smartcard/data-authority-adapter';

import { APP_IDENTITY } from '../../../config/identity';
import { EXPECTED_DATASET_ID } from '../datasetId';
import { assertPinnedAdapter } from '../index';

/**
 * THE DEVICE IMPORT CLIENT — criteria C1, C3, C5, C7.
 *
 *   > **C1.** *"The device import client implements **all ten OB-4 refusals**, none softened, with
 *   > one test per refusal named by the refusal."*
 *
 *   > **OB-4.** *"Every line below is a refusal P2 may not soften."*
 *
 * The obligations are not listed here. They are parsed from the handoff into
 * `tools/p2/ob4-refusals.json` and the gate matches one test per refusal against that file — a list
 * typed into source is correct on the day it is typed and is a claim about a document nobody
 * re-read thereafter.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE SHAPE THE OBLIGATIONS FORCE
 *
 * Three phases, in this order, and the order is the contract:
 *
 *   1. **VERIFY** — every candidate, completely, writing nothing. *"A refusal must cost the device
 *      nothing but CPU… so 'the prior state is intact' is true by construction rather than by
 *      recovery."*
 *   2. **STAGE** — beside the installed set, never into it. *"A partial file write inside it is
 *      unrecoverable."*
 *   3. **COMMIT** — installed → backup, staged → installed, then discard the backup. Two renames,
 *      because a rename is the only step a filesystem gives that is close to atomic.
 *
 * A crash anywhere in phase 3 leaves a backup on disk, and `recover()` at startup rolls it back.
 * *"The staged set is exactly the one whose promotion failed; rolling forward would promote it
 * again."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS MODULE DOES NOT DO
 *
 * It does not verify anything itself. `openVerifiedPack` is the door and OD-20 is explicit: the app
 * *"does not reimplement any of it"*. This module decides WHAT to verify, in what order, and what to
 * do about a refusal — the sequencing that a device needs and a pipeline does not.
 */

/** One pack set offered for import: the bytes, its manifest, and the detached signature. */
export interface PackSetCandidate {
  readonly packId: string;
  readonly packBytes: Uint8Array;
  readonly manifest: PackManifest;
  readonly envelope: SignatureEnvelope;
}

export interface InstalledPackSet {
  readonly packId: string;
  readonly packVersion: string;
  readonly packFormatVersion: number;
  readonly datasetVersion: string;
}

/**
 * The storage the import drives.
 *
 * Deliberately narrow. A store that could write one pack at a time with no promote step would let a
 * caller build the partial state this module exists to prevent — so the only write verbs are
 * `stage`, `backupInstalled`, `promoteStaged`, and the two ways to end an import.
 */
export interface PackSetStore {
  listInstalled(): Promise<readonly InstalledPackSet[]>;
  clearStaging(): Promise<void>;
  stage(candidate: PackSetCandidate): Promise<void>;
  /** installed → backup. One rename. */
  backupInstalled(): Promise<void>;
  /** staged → installed. The second rename. */
  promoteStaged(): Promise<void>;
  discardBackup(): Promise<void>;
  restoreBackup(): Promise<void>;
  hasBackup(): Promise<boolean>;
}

/**
 * The steps, named, so a test can crash the import at any one of them.
 *
 * P1 could not prove a real power-loss crash — its interruptions were injected exceptions, and this
 * is the same instrument. C3 requires the gap be characterised rather than claimed closed, and
 * `POWER_LOSS.md` is where that characterisation lives.
 */
export const IMPORT_STEPS = [
  'VERIFY_BEGIN',
  'VERIFY_EACH',
  'STAGE_BEGIN',
  'STAGE_EACH',
  'STAGE_COMPLETE',
  'COMMIT_BACKUP',
  'COMMIT_PROMOTE',
  'COMMIT_CLEANUP',
] as const;
export type ImportStep = (typeof IMPORT_STEPS)[number];

export type ImportRefusalCode =
  /** "This is not our data." */
  | 'DATASET_ID_REFUSED'
  /** "This may have been altered." A DIFFERENT problem, and it says so. */
  | 'SIGNATURE_REFUSED'
  | 'INCOMPLETE_SET'
  | 'DUPLICATE_PACK'
  | 'MIXED_PACK_FORMAT'
  | 'MIXED_DATASET_VERSION'
  | 'SHAPE_SKEW_REFUSED'
  | 'RELEASE_REFUSED'
  | 'IMPORT_ALREADY_RUNNING';

export interface ImportRefusal {
  readonly code: ImportRefusalCode;
  readonly packId: string;
  readonly message: string;
  readonly failures?: readonly EnvelopeFailure[];
}

export type ImportOutcome =
  | { readonly ok: true; readonly installed: readonly InstalledPackSet[] }
  | { readonly ok: false; readonly refusals: readonly ImportRefusal[]; readonly wrote: false };

export interface ImportPolicy {
  /** The pack sets a complete installation holds. A candidate list missing one is not importable. */
  readonly requiredPackSets: readonly string[];
  /** A device sets this true. Today every envelope is `release: false`, and C7 is that criterion. */
  readonly requireRelease?: boolean;
  /** Test-only. Throwing from here simulates a crash at that step. */
  readonly onStep?: (step: ImportStep, detail?: string) => void;
}

/**
 * `EXPECTED_DATASET_ID` and the trust store are COMPILED IN, and this is where that is enforced.
 *
 *   > *"Keep `EXPECTED_DATASET_ID` compiled in — **a constant a pack can influence is not a
 *   > check**."*
 *   > *"Keep the trust store compiled in — same reason. **A trust store a pack could supply answers
 *   > 'is this signed by whoever signed it?'**"*
 *
 * Neither is a parameter of `importPackSets`, and `ImportPolicy` has no field for either. That is
 * the enforcement: there is no argument to pass, so no caller — and no pack — can supply one.
 */
export const COMPILED_IN = {
  expectedDatasetId: EXPECTED_DATASET_ID,
  trustStore: TRUST_STORE as readonly TrustedKey[],
  appVersion: APP_IDENTITY.version,
} as const;

/**
 * ONE IMPORT AT A TIME.
 *
 *   > *"Concurrent importers — **one at a time is assumed**. A P2 runtime that can start an import
 *   > while another runs needs a lock."*
 *
 * A module-level flag, because that is exactly the scope of the risk: one JavaScript runtime, one
 * app. It is not a filesystem lock and does not claim to be — two processes are not a thing a React
 * Native app has, and a lock file would be a defence against a threat that does not exist here
 * while adding a stale-lock failure mode that does.
 *
 * The flag is cleared in a `finally`, so a refusal, a throw, or a crash inside the import all leave
 * it unlocked. A lock that survived an exception would brick imports until the app restarted.
 */
let importInFlight = false;

/** Visible for a test that must prove the lock is released. Never for a caller to set. */
export const importLockHeld = (): boolean => importInFlight;

const refusal = (
  code: ImportRefusalCode,
  packId: string,
  message: string,
  failures?: readonly EnvelopeFailure[],
): ImportRefusal => ({ code, packId, message, ...(failures ? { failures } : {}) });

/**
 * Import a whole pack set, or nothing.
 *
 * Returns refusals rather than throwing them: a device that cannot import an update is not a device
 * in an error state, it is a device still running correctly on the data it had. The caller needs
 * every reason, so the verify phase collects them all instead of stopping at the first.
 */
export async function importPackSets(
  store: PackSetStore,
  candidates: readonly PackSetCandidate[],
  policy: ImportPolicy,
): Promise<ImportOutcome> {
  if (importInFlight) {
    return {
      ok: false,
      wrote: false,
      refusals: [refusal('IMPORT_ALREADY_RUNNING', '(none)',
        'another import is already running in this runtime. Two imports interleaving their stage ' +
        'and promote steps could promote one set over another\'s backup, which is the partial ' +
        'state the whole three-phase shape exists to prevent.')],
    };
  }
  importInFlight = true;
  try {
    return await runImport(store, candidates, policy);
  } finally {
    // Always. A lock that survived a throw would brick every later import until the app restarted.
    importInFlight = false;
  }
}

async function runImport(
  store: PackSetStore,
  candidates: readonly PackSetCandidate[],
  policy: ImportPolicy,
): Promise<ImportOutcome> {
  // A wrong adapter is not an import question. Same order the seam uses.
  assertPinnedAdapter();

  const step = (s: ImportStep, detail?: string): void => policy.onStep?.(s, detail);
  const refusals: ImportRefusal[] = [];

  // ── PHASE 1 — VERIFY. WRITES NOTHING. ────────────────────────────────────────────
  step('VERIFY_BEGIN');

  const seen = new Set<string>();
  for (const c of candidates) {
    if (seen.has(c.packId)) {
      refusals.push(refusal('DUPLICATE_PACK', c.packId,
        `"${c.packId}" appears twice in one import. Which one would be installed is decided by ` +
        'iteration order, and an installation whose contents depend on array order is not one ' +
        'anybody can reason about.'));
    }
    seen.add(c.packId);
  }

  const missing = policy.requiredPackSets.filter((id) => !seen.has(id));
  if (missing.length > 0) {
    refusals.push(refusal('INCOMPLETE_SET', missing.join(', '),
      `${missing.length} required pack set(s) are absent from this import: ${missing.join(', ')}. ` +
      'Three of four is a state no packVersion names and nothing has validated. A half-imported ' +
      'graph is worse than no import: no import leaves a device on data it has been running ' +
      'correctly on.'));
  }
  const unexpected = [...seen].filter((id) => !policy.requiredPackSets.includes(id));
  if (unexpected.length > 0) {
    refusals.push(refusal('INCOMPLETE_SET', unexpected.join(', '),
      `this import carries pack set(s) no installation expects: ${unexpected.join(', ')}. The ` +
      'required set is compiled in; an artifact that adds to it is describing a different estate.'));
  }

  // One estate generation at a time, and one shape.
  const datasetVersions = new Set(candidates.map((c) => c.manifest.datasetVersion));
  if (datasetVersions.size > 1) {
    refusals.push(refusal('MIXED_DATASET_VERSION', [...seen].join(', '),
      `this import mixes datasetVersion ${[...datasetVersions].join(' and ')}. Two packs can carry ` +
      'the right datasetId and describe different corpora — a cross-set reference resolved against ' +
      'the wrong generation is a wrong answer that looks like a right one.'));
  }
  const packFormats = new Set(candidates.map((c) => c.manifest.packFormatVersion));
  if (packFormats.size > 1) {
    refusals.push(refusal('MIXED_PACK_FORMAT', [...seen].join(', '),
      `this import mixes packFormatVersion ${[...packFormats].join(' and ')}. One installation is ` +
      'read by one adapter build, and a set the adapter half understands is the shape skew OB-4 ' +
      'refuses.'));
  }

  for (const c of candidates) {
    step('VERIFY_EACH', c.packId);

    // The dataset id is checked HERE, before openVerifiedPack, so its refusal cannot be reported as
    // a signature failure. "This is not our data" and "this may have been altered" are different
    // problems, and reporting the second for the first sends somebody hunting for corruption that
    // is not there.
    if (c.manifest.datasetId !== COMPILED_IN.expectedDatasetId) {
      refusals.push(refusal('DATASET_ID_REFUSED', c.packId,
        `"${c.packId}" declares datasetId "${c.manifest.datasetId}" and this build is compiled for ` +
        `"${COMPILED_IN.expectedDatasetId}". This is not our data. It is not a signature problem ` +
        'and must not be reported as one.'));
      continue;
    }

    const opened = openVerifiedPack({
      packBytes: c.packBytes,
      manifest: c.manifest,
      envelope: c.envelope,
      expectedDatasetId: COMPILED_IN.expectedDatasetId,
      appVersion: COMPILED_IN.appVersion,
      trustStore: COMPILED_IN.trustStore,
      requireRelease: policy.requireRelease ?? false,
      // No adapterVersion override: the pinned build decides, and assertPinnedAdapter already ran.
    });

    if (!opened.accepted) {
      // Shape skew has its own code. An adapter that cannot read a format has no honest behaviour
      // available, and calling that "signature refused" would be a true statement about the wrong
      // link.
      const isSkew = opened.failures.some((f) => /FORMAT|format/.test(f.code + f.message));
      refusals.push(refusal(
        isSkew ? 'SHAPE_SKEW_REFUSED' : 'SIGNATURE_REFUSED',
        c.packId,
        `"${c.packId}" did not verify: ${opened.failures.map((f) => f.code).join(', ')}.`,
        opened.failures,
      ));
      continue;
    }

    if (policy.requireRelease === true && !opened.release) {
      refusals.push(refusal('RELEASE_REFUSED', c.packId,
        `"${c.packId}" is signed by a key with no release custody. OD-25: no HARDWARE_BACKED ` +
        'custody exists yet, so nothing may reach a real device — and a device that accepted a ' +
        'development signature would accept anything signed with a key that leaked.'));
    }
  }

  if (refusals.length > 0) {
    // Nothing was written. Not "nothing was written that matters" — the verify phase has no write
    // verb available to it, which is why this is true by construction.
    return { ok: false, wrote: false, refusals };
  }

  // ── PHASE 2 — STAGE. BESIDE THE INSTALLED SET, NEVER INTO IT. ────────────────────
  step('STAGE_BEGIN');
  await store.clearStaging();
  for (const c of candidates) {
    step('STAGE_EACH', c.packId);
    await store.stage(c);
  }
  step('STAGE_COMPLETE');

  // ── PHASE 3 — COMMIT. TWO RENAMES. ──────────────────────────────────────────────
  step('COMMIT_BACKUP');
  await store.backupInstalled();

  step('COMMIT_PROMOTE');
  await store.promoteStaged();

  step('COMMIT_CLEANUP');
  await store.discardBackup();

  return { ok: true, installed: await store.listInstalled() };
}

/**
 * ROLL BACK AT STARTUP WHEN A BACKUP IS PRESENT.
 *
 *   > *"The staged set is exactly the one whose promotion failed; **rolling forward would promote
 *   > it again**."*
 *
 * A backup on disk means an import began phase 3 and did not finish it. There is no information
 * available at startup about how far it got — that is what a power loss takes away — so the only
 * safe reading is that the installed directory may be incomplete, and the backup is known good
 * because it was complete before the import started.
 */
export async function recoverAtStartup(store: PackSetStore): Promise<'ROLLED_BACK' | 'NOTHING_TO_DO'> {
  const hadBackup = await store.hasBackup();
  if (hadBackup) await store.restoreBackup();

  // ALWAYS, backup or not. An import interrupted during phase 2 leaves a partial staging directory
  // and no backup, and a later import that found those files still there could promote a set that
  // was never verified as a whole. Clearing is cheap; the alternative is a promote of a set nobody
  // ever finished writing.
  await store.clearStaging();

  return hadBackup ? 'ROLLED_BACK' : 'NOTHING_TO_DO';
}
