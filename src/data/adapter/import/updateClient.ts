import {
  openVerifiedPack,
  type EnvelopeFailure,
  type PackManifest,
} from '@smartcard/data-authority-adapter';

import { COMPILED_IN, type PackSetCandidate } from './packSetImport';

/**
 * THE UPDATE CLIENT'S FOUR REFUSALS — criterion C5.
 *
 *   > **C5.** *"The update client verifies signature, `minAppVersion` and `datasetId` **on device**,
 *   > with `EXPECTED_DATASET_ID` and the trust store **compiled in** and provably not loadable from
 *   > a pack; a `smartcard-canonical-v1` pack is refused; `DATASET_ID_REFUSED` is reported
 *   > **distinctly** from a signature failure."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * FOUR CODES, BECAUSE THEY HAVE FOUR DIFFERENT FIXES
 *
 * The adapter refuses all of these — that is its job, and this module does not reimplement any of
 * its checking. What it adds is the **naming**, and the naming is the criterion:
 *
 *   | code | what a person should do about it |
 *   |---|---|
 *   | `DATASET_ID_REFUSED` | nothing is wrong with the file. It is not our data. Stop looking for corruption |
 *   | `MIN_APP_VERSION_REFUSED` | update the app. The pack is fine and this build is too old to read it |
 *   | `SHAPE_SKEW_REFUSED` | update the app. The pack is a format this adapter build cannot read |
 *   | `SIGNATURE_REFUSED` | **this file may have been altered.** Do not install it, and do not retry |
 *
 * Collapsing any of the first three into the fourth sends somebody hunting for corruption that is
 * not there — and, worse, teaches them that a signature failure is a routine thing that happens
 * when your app is out of date. The one refusal that must never become routine is the one that
 * means tampering.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * ORDER: IDENTITY, THEN CAPABILITY, THEN INTEGRITY
 *
 * The dataset id and the app version are checked BEFORE the signature is verified. Not for speed —
 * for the message. A pack from another estate, or one this build is too old to read, produces a
 * signature failure too if you get that far, and reporting that would be a true statement about
 * the wrong link.
 *
 * The adapter makes the same argument about compatibility: *"an adapter that cannot read the pack's
 * shape has no business deciding whether the shape it cannot read is correctly signed."*
 */

export type UpdateRefusalCode =
  | 'DATASET_ID_REFUSED'
  | 'MIN_APP_VERSION_REFUSED'
  | 'SHAPE_SKEW_REFUSED'
  | 'SIGNATURE_REFUSED';

/** The four, in the order they are checked. Exported so a gate counts them rather than trusting a number. */
export const UPDATE_REFUSAL_CODES: readonly UpdateRefusalCode[] = [
  'DATASET_ID_REFUSED',
  'MIN_APP_VERSION_REFUSED',
  'SHAPE_SKEW_REFUSED',
  'SIGNATURE_REFUSED',
];

export interface UpdateRefusal {
  readonly code: UpdateRefusalCode;
  readonly packId: string;
  readonly message: string;
  /** What the adapter said, when it was the adapter that said it. */
  readonly failures?: readonly EnvelopeFailure[];
}

export type UpdateVerdict =
  | { readonly acceptable: true; readonly manifest: PackManifest }
  | { readonly acceptable: false; readonly refusal: UpdateRefusal };

const compare = (a: string, b: string): number => {
  const [x, y] = [a.split('.').map(Number), b.split('.').map(Number)];
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
};

/**
 * Would this pack be accepted as an update?
 *
 * One candidate, one verdict, one refusal — the FIRST one that applies, because the order is the
 * message. A caller that wants every reason has `importPackSets`, which collects them across the
 * whole set; this answers "why can I not install this one?", which is the question a person asks.
 */
export function checkUpdate(candidate: PackSetCandidate): UpdateVerdict {
  const { packId, manifest, envelope, packBytes } = candidate;

  // ── 1. IDENTITY. Is this our data at all? ────────────────────────────────────────
  if (manifest.datasetId !== COMPILED_IN.expectedDatasetId) {
    return {
      acceptable: false,
      refusal: {
        code: 'DATASET_ID_REFUSED',
        packId,
        message:
          `this pack is built from "${manifest.datasetId}" and this app reads ` +
          `"${COMPILED_IN.expectedDatasetId}". It is not our data. Nothing is wrong with the file ` +
          'and there is no corruption to look for — an older estate generation is a different ' +
          'corpus, not a damaged copy of this one.',
      },
    };
  }

  // ── 2. CAPABILITY. Can this build read it? ───────────────────────────────────────
  if (typeof manifest.minAppVersion === 'string'
      && compare(COMPILED_IN.appVersion, manifest.minAppVersion) < 0) {
    return {
      acceptable: false,
      refusal: {
        code: 'MIN_APP_VERSION_REFUSED',
        packId,
        message:
          `this pack requires app version ${manifest.minAppVersion} and this build is ` +
          `${COMPILED_IN.appVersion}. Update the app. The pack is fine: reporting a signature ` +
          'failure here would teach somebody that tampering warnings are routine.',
      },
    };
  }

  // ── 3. INTEGRITY, and the shape it arrives in ────────────────────────────────────
  const opened = openVerifiedPack({
    packBytes,
    manifest,
    envelope,
    // COMPILED IN. Not parameters of this function, and not fields on any options object — there
    // is no argument to pass, so no pack can supply one.
    expectedDatasetId: COMPILED_IN.expectedDatasetId,
    appVersion: COMPILED_IN.appVersion,
    trustStore: COMPILED_IN.trustStore,
    requireRelease: false,
  });

  if (opened.accepted) return { acceptable: true, manifest: opened.manifest };

  const isSkew = opened.failures.some((f) => /FORMAT|format/.test(f.code + f.message));
  return {
    acceptable: false,
    refusal: {
      code: isSkew ? 'SHAPE_SKEW_REFUSED' : 'SIGNATURE_REFUSED',
      packId,
      message: isSkew
        ? `this pack is a format this adapter build cannot read: ${opened.failures.map((f) => f.code).join(', ')}. ` +
          'Update the app. An adapter reading a shape it does not understand either crashes or ' +
          'silently misreads, and misreading a financial field is the worse outcome.'
        : `THIS FILE MAY HAVE BEEN ALTERED: ${opened.failures.map((f) => f.code).join(', ')}. ` +
          'Do not install it and do not retry — a signature failure is not a transient error, and ' +
          'treating it as one is how a device eventually accepts a forged pack.',
      failures: opened.failures,
    },
  };
}

/**
 * A NOTE ON WHAT IS DELIBERATELY ABSENT.
 *
 * An earlier draft of this module exported `signerOf(envelope)`, returning the envelope's `keyId`
 * and `release` flag "for a caller that wants to show it". The `release-gate` gate would have
 * failed it, correctly: reading `envelope.release` anywhere outside `releaseGate.ts` is a second
 * reading of the same flag, and a second reading is a second answer waiting to disagree with the
 * first. Whether a pack may be DELIVERED is one question with one home.
 */
