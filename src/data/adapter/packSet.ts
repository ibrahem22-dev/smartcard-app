import {
  openVerifiedFxSnapshot,
  openVerifiedPack,
  TRUST_STORE,
  type EnvelopeFailure,
  type FxSnapshotManifest,
  type OpenFxSnapshotResult,
  type OpenPackInput,
  type PackManifest,
  type SignatureEnvelope,
} from '@smartcard/data-authority-adapter';

import { APP_IDENTITY } from '../../config/identity';

import { EXPECTED_DATASET_ID } from './datasetId';
import { assertPinnedAdapter } from './index';

/**
 * OPENING THE REAL PACK SETS — criterion D2, Gate 7.
 *
 *   > **Gate 7.** *"The app reads **the real packs** through the adapter **at their measured
 *   > shas**."*
 *
 *   > **D2.** *"Nothing outside `data/adapter/**` imports a pack file, a raw JSON dataset, or the
 *   > local DB driver directly."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * BYTES IN, MANIFEST OR REFUSAL OUT
 *
 * This module never touches a filesystem, a bundler asset or a network. It takes a `PackReader` —
 * something that can hand over the bytes of a named file — and returns either the pack's verified
 * manifest or every reason it was refused.
 *
 * That seam is the point. **Where the bytes come from is a different question with a different
 * answer on every surface**: a test reads them from disk, and the device import client that will
 * write them to a device filesystem is criterion C1 and Phase 8. Deciding delivery here would put
 * a native storage dependency inside the one module the whole app must be able to reason about,
 * and would make this code untestable in the environment that actually exercises it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE REFUSAL IS THE PRODUCT
 *
 * `openVerifiedPack` re-derives the entire chain — compatibility, then the manifest's sha, then
 * the detached signature over it, then the dataset id, then `minAppVersion` — and returns
 * `accepted: false` with EVERY failure rather than the first. This module does not soften that and
 * does not reduce it to a boolean: a caller that gets a refusal gets the reasons, because "the
 * pack did not load" is the sentence that sends somebody to read source to find out why.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * `requireRelease` IS FALSE, DELIBERATELY, AND THAT IS NOT A RELAXATION
 *
 *   > **OB-8 / OD-25.** The development key is retired and **no release custody exists**. Every
 *   > shipped envelope carries `release: false`.
 *
 *   > **C7.** *"**No pack reaches a real device while `release: false`.**"*
 *
 * A build tool inspecting a dev-signed pack passes `requireRelease: false` — that is the adapter's
 * own documented use of the flag. A DEVICE passes `true`, and today every pack in this repository
 * would be refused by it, which is the correct outcome and the reason C7 exists. `releaseState()`
 * below reports what was actually signed so a caller can never mistake one for the other.
 */

/** Where the bytes come from. Implemented by a test, and by Phase 8's import client on a device. */
export interface PackReader {
  /** The pack sets this reader can offer, derived from what it actually holds. */
  sets(): readonly string[];
  /** The bytes of one file in one set. Throws if it is not there — an absent pack is not an empty pack. */
  read(set: string, file: string): Uint8Array;
}

export interface PackSetAccepted {
  readonly set: string;
  readonly accepted: true;
  readonly manifest: PackManifest;
  /** What the ENVELOPE said, not what was asked for. */
  readonly release: boolean;
}

export interface PackSetRefused {
  readonly set: string;
  readonly accepted: false;
  readonly failures: readonly EnvelopeFailure[];
}

export type PackSetResult = PackSetAccepted | PackSetRefused;

const decoder = new TextDecoder();

/** The three files every pack set ships: the body, its manifest, and the detached signature. */
const MANIFEST_FILE = 'manifest.json';
const ENVELOPE_FILE = 'manifest.sig.json';

/**
 * THE FX SNAPSHOT IS NOT A PACK, AND THE FIRST READ OF THE REAL ARTIFACTS PROVED IT.
 *
 * Opening `fx-rates` through the pack door produced
 *
 *     REFUSED: pack declares packFormatVersion undefined; adapter 1.1.0 supports {1}.
 *
 * because it has no `packFormatVersion` at all — it declares a `snapshotFormatVersion`. The
 * adapter's own entry point says so in as many words: *"A THIRD ARTIFACT CLASS, not a fifth pack
 * set (`PACK_DELIVERY_MODEL` §1.3, ADR-020). It has its own door, its own manifest type and its own
 * format axis."*
 *
 * A filename test would have hidden this. `fx-rates` ships `snapshot.json` where the others ship
 * `pack.json`, so "try pack.json, then snapshot.json" finds a body for all five and sends one of
 * them through the wrong verifier — a guess that succeeds four times out of five is the shape that
 * survives review. **The manifest declares the artifact's class, so the manifest decides.**
 */
export type ArtifactClass = 'pack' | 'fx-snapshot';

const classify = (manifest: Record<string, unknown>): ArtifactClass | null => {
  const isPack = typeof manifest.packFormatVersion === 'number';
  const isSnapshot = typeof manifest.snapshotFormatVersion === 'number';
  // Both, or neither, would mean an artifact claiming two classes or none — and no door should
  // accept one of those on a guess.
  if (isPack === isSnapshot) return null;
  return isPack ? 'pack' : 'fx-snapshot';
};

const readManifest = (reader: PackReader, set: string): Record<string, unknown> =>
  JSON.parse(decoder.decode(reader.read(set, MANIFEST_FILE))) as Record<string, unknown>;

/** Which door an artifact belongs to, decided by what it declares about itself. */
export function artifactClassOf(reader: PackReader, set: string): ArtifactClass | null {
  return classify(readManifest(reader, set));
}

/**
 * The lowest app version that can open EVERYTHING this reader holds — derived, never typed.
 *
 * The four pack sets require `1.0.0` and the FX snapshot requires `1.1.0`, and an app between the
 * two ships an artifact its own build refuses. That failure surfaces at a cold start with no
 * network, which is the exact moment the bundled snapshot exists to cover, so it is the worst
 * possible place to discover it.
 *
 * Derived from the manifests so the number follows the pipeline instead of being carried forward by
 * habit: if a future artifact raises the floor, this rises with it and the check fails until
 * somebody looks.
 */
export function requiredAppVersion(reader: PackReader): { floor: string; requiredBy: string } {
  const parse = (v: string): number[] => v.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const higher = (a: string, b: string): boolean => {
    const [x, y] = [parse(a), parse(b)];
    for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
      if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
    }
    return false;
  };

  let floor = '0.0.0';
  let requiredBy = '(nothing)';
  for (const set of reader.sets()) {
    const declared = readManifest(reader, set).minAppVersion;
    if (typeof declared !== 'string') continue;
    if (higher(declared, floor)) {
      floor = declared;
      requiredBy = set;
    }
  }
  return { floor, requiredBy };
}

/** Open one PACK set: verify it end to end, or refuse it with every reason. */
export function openPackSet(reader: PackReader, set: string): PackSetResult {
  // A wrong adapter is not a compatibility question — the same order the seam uses.
  assertPinnedAdapter();

  const raw = readManifest(reader, set);
  const kind = classify(raw);

  /**
   * TWO DIFFERENT WRONGS, AND THEY DO NOT DESERVE THE SAME ANSWER.
   *
   * The FX snapshot arriving at the pack door is a CALLER's mistake: the artifact is fine and the
   * code asked the wrong verifier. That is a programming error, it is fixed by editing a call site,
   * and it throws so nobody catches it and renders it to a user as a data problem.
   *
   * A manifest declaring neither format — or both — is a bad ARTIFACT. It is exactly what a
   * corrupted download or a tampered file looks like, it can arrive on a device at any time, and a
   * load path that threw would take a screen down instead of refusing a pack. So it is a refusal,
   * carrying what was actually found.
   */
  if (kind === 'fx-snapshot') {
    throw new Error(
      `"${set}" is the FX snapshot, not a pack. Sending it through the pack door reports ` +
        '"packFormatVersion undefined" — a message about a missing field rather than about the ' +
        'wrong door. It has its own verifier: openFxSnapshot.',
    );
  }
  if (kind === null) {
    return {
      set,
      accepted: false,
      failures: [{
        code: 'PACK_MISMATCH',
        message:
          `"${set}" declares packFormatVersion ${JSON.stringify(raw.packFormatVersion)} and ` +
          `snapshotFormatVersion ${JSON.stringify(raw.snapshotFormatVersion)}. A manifest must ` +
          'declare exactly one of them, as a number. Neither means nothing decides which verifier ' +
          'reads it; both means the artifact claims two classes, and a door that guessed would ' +
          'sometimes guess right.',
      }],
    };
  }

  const manifest = raw as unknown as PackManifest;
  const envelope = JSON.parse(decoder.decode(reader.read(set, ENVELOPE_FILE))) as SignatureEnvelope;
  const packBytes = reader.read(set, 'pack.json');

  const input: OpenPackInput = {
    packBytes,
    manifest,
    envelope,
    // Compiled in. Never the manifest's own value — a pack that names its own dataset is a pack
    // that cannot be wrong.
    expectedDatasetId: EXPECTED_DATASET_ID,
    appVersion: APP_IDENTITY.version,
    // OB-8: no release custody exists yet, so nothing here is release-eligible. C7 is the criterion
    // that keeps a `release: false` pack off a real device; this flag is not that check.
    requireRelease: false,
  };

  const result = openVerifiedPack(input);
  return result.accepted
    ? { set, accepted: true, manifest: result.manifest, release: result.release }
    : { set, accepted: false, failures: result.failures };
}

/**
 * Open the FX snapshot through ITS door.
 *
 * Verification only. What a rate MEANS — carry-forward, staleness, the rate's own date always
 * rendered, *"a cold-start fallback and not a rate feed"* — is criterion C8 and Phase 9. This
 * proves the artifact opens; it deliberately does not decide how a screen reads it.
 */
export function openFxSnapshot(reader: PackReader, set: string): OpenFxSnapshotResult {
  assertPinnedAdapter();

  const manifest = readManifest(reader, set) as unknown as FxSnapshotManifest;
  const envelope = JSON.parse(decoder.decode(reader.read(set, ENVELOPE_FILE))) as SignatureEnvelope;

  return openVerifiedFxSnapshot({
    snapshotBytes: reader.read(set, 'snapshot.json'),
    manifest,
    envelope,
    // Compiled in, like the dataset id. The FX door takes the trust store as a REQUIRED input
    // rather than defaulting to one, so a caller cannot forget to decide which keys it trusts.
    trustStore: TRUST_STORE,
    expectedDatasetId: EXPECTED_DATASET_ID,
    appVersion: APP_IDENTITY.version,
    requireRelease: false,
  });
}

/**
 * Open every PACK set the reader holds, routed by what each manifest declares.
 *
 * The population is the reader's, never a list written here — and the FX snapshot is excluded by
 * its own manifest rather than by name, so a sixth artifact class would be classified rather than
 * swept into the pack door because nobody updated a filter.
 */
export function openAllPackSets(reader: PackReader): readonly PackSetResult[] {
  const sets = reader.sets().filter((set) => artifactClassOf(reader, set) === 'pack');
  if (sets.length === 0) {
    throw new Error(
      'the reader offers no pack sets. An empty read is not a successful read: every caller below ' +
        'would see "no failures" and conclude the packs verified.',
    );
  }
  return sets.map((set) => openPackSet(reader, set));
}

/**
 * Does this build meet the floor everything it carries demands?
 *
 * At or above, never equal to: the app moving ahead of the artifacts is ordinary, and an equality
 * check would fail the day somebody shipped 1.2.0 against a 1.1.0 floor — a green check turning red
 * for the one change that was definitely safe.
 */
export function appVersionMeetsFloor(reader: PackReader): {
  ok: boolean;
  floor: string;
  requiredBy: string;
  appVersion: string;
} {
  const { floor, requiredBy } = requiredAppVersion(reader);
  const parse = (v: string): number[] => v.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const [app, need] = [parse(APP_IDENTITY.version), parse(floor)];
  let ok = true;
  for (let i = 0; i < Math.max(app.length, need.length); i += 1) {
    if ((app[i] ?? 0) !== (need[i] ?? 0)) {
      ok = (app[i] ?? 0) > (need[i] ?? 0);
      break;
    }
  }
  return { ok, floor, requiredBy, appVersion: APP_IDENTITY.version };
}

/** Every artifact the reader holds, with the door each one belongs to. Derived, for a gate to read. */
export function inventory(reader: PackReader): readonly { set: string; kind: ArtifactClass | null }[] {
  return reader.sets().map((set) => ({ set, kind: artifactClassOf(reader, set) }));
}

/**
 * Whether every accepted set was signed by a key with release custody.
 *
 * Reported rather than assumed, so C7's check has something to read: today this is false for
 * every pack in the repository, and a surface that showed a "verified" badge without consulting it
 * would be telling a user the estate is release-signed when OD-25 says no such custody exists.
 */
export function releaseState(results: readonly PackSetResult[]): {
  readonly allAccepted: boolean;
  readonly allRelease: boolean;
  readonly refused: readonly string[];
} {
  const refused = results.filter((r): r is PackSetRefused => !r.accepted).map((r) => r.set);
  const accepted = results.filter((r): r is PackSetAccepted => r.accepted);
  return {
    allAccepted: refused.length === 0 && accepted.length > 0,
    allRelease: accepted.length > 0 && accepted.every((r) => r.release),
    refused,
  };
}
