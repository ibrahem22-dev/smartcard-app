/**
 * The Data & Privacy surface's single runtime door to bundled artifacts and local storage.
 *
 * The screen receives only these views. It cannot name a manifest, a pack body, MMKV, SQLite, or
 * the vault, which keeps every displayed figure on the runtime side of this seam.
 */
import { MMKV } from 'react-native-mmkv';

import benefitsPackJson from './packs/benefits/pack.json';
import benefitsManifestJson from './packs/benefits/manifest.json';
import benefitsEnvelopeJson from './packs/benefits/manifest.sig.json';
import catalogPackJson from './packs/catalog/pack.json';
import catalogManifestJson from './packs/catalog/manifest.json';
import catalogEnvelopeJson from './packs/catalog/manifest.sig.json';
import contentPackJson from './packs/content/pack.json';
import contentManifestJson from './packs/content/manifest.json';
import contentEnvelopeJson from './packs/content/manifest.sig.json';
import fxSnapshotJson from './packs/fx-rates/snapshot.json';
import fxManifestJson from './packs/fx-rates/manifest.json';
import fxEnvelopeJson from './packs/fx-rates/manifest.sig.json';
import taxonomyPackJson from './packs/taxonomy/pack.json';
import taxonomyManifestJson from './packs/taxonomy/manifest.json';
import taxonomyEnvelopeJson from './packs/taxonomy/manifest.sig.json';

import { PROVENANCE_CHIPS, type ProvenanceChip } from '../../authority/provenanceChip';
import { STORAGE_NAMESPACE } from '../../config/identity';
import { keyVault } from '../../security/keyVault';
import { openPackStore } from '../../store/packStore';
import {
  inventory,
  openAllPackSets,
  openFxSnapshot,
  type PackReader,
} from './packSet';

type JsonObject = Readonly<Record<string, unknown>>;

type BundledFiles = {
  readonly body: JsonObject;
  readonly manifest: JsonObject;
  readonly envelope: JsonObject;
  readonly bodyFile: 'pack.json' | 'snapshot.json';
};

const BUNDLED_FILES: Readonly<Record<string, BundledFiles>> = {
  benefits: {
    body: benefitsPackJson as JsonObject,
    manifest: benefitsManifestJson as JsonObject,
    envelope: benefitsEnvelopeJson as JsonObject,
    bodyFile: 'pack.json',
  },
  catalog: {
    body: catalogPackJson as JsonObject,
    manifest: catalogManifestJson as JsonObject,
    envelope: catalogEnvelopeJson as JsonObject,
    bodyFile: 'pack.json',
  },
  content: {
    body: contentPackJson as JsonObject,
    manifest: contentManifestJson as JsonObject,
    envelope: contentEnvelopeJson as JsonObject,
    bodyFile: 'pack.json',
  },
  'fx-rates': {
    body: fxSnapshotJson as JsonObject,
    manifest: fxManifestJson as JsonObject,
    envelope: fxEnvelopeJson as JsonObject,
    bodyFile: 'snapshot.json',
  },
  taxonomy: {
    body: taxonomyPackJson as JsonObject,
    manifest: taxonomyManifestJson as JsonObject,
    envelope: taxonomyEnvelopeJson as JsonObject,
    bodyFile: 'pack.json',
  },
};

const encoder = new TextEncoder();

const bundledReader: PackReader = {
  sets: (): readonly string[] => Object.keys(BUNDLED_FILES),
  read: (set: string, file: string): Uint8Array => {
    const files = BUNDLED_FILES[set];
    if (files === undefined) throw new Error(`bundled reader has no artifact set "${set}"`);
    const value = file === files.bodyFile
      ? files.body
      : file === 'manifest.json'
        ? files.manifest
        : file === 'manifest.sig.json'
          ? files.envelope
          : undefined;
    if (value === undefined) throw new Error(`bundled reader has no "${file}" in "${set}"`);
    return encoder.encode(JSON.stringify(value));
  },
};

/**
 * THE CHIP VOCABULARY IS NOT RESTATED HERE — criterion B5, and P2's provenance-single-enum gate.
 *
 * This module first declared its own `'VERIFIED' | 'ESTIMATE' | 'UNKNOWN' | 'CONFLICT'`, because
 * the shipped catalog pack really does carry a chip the app's enum does not have. The gate refused
 * it, and its reason is the right one: *"Two enums for one concept is the divergence class the Data
 * Contract exists to prevent — not that either is wrong, but that nothing forces them to agree."*
 *
 * So the vocabulary is IMPORTED from the one place that owns it, and the pack-side set is DERIVED
 * from it: every chip except `USER`, which the Data Contract §2.2 puts in the vault and which no
 * pack row can carry. If a member is ever added or retired there, this follows without being
 * edited.
 *
 * WHAT THE PACKS ACTUALLY CARRY, AND WHY IT IS REPORTED RATHER THAN ABSORBED. Counted from disk:
 * 4,306 chips across benefits, catalog and taxonomy are members of the vocabulary — and exactly
 * ONE, in the catalog pack, reads `CONFLICT`, on a value with two candidate rates and
 * `consumability.axes.conflictStatus: "INLINE"`. It is a real fact in shipped data and it is not a
 * member of the contract's four. Widening a local enum to swallow it would have made the surface
 * agree with the pack by disagreeing with the contract, silently. Instead it is counted separately
 * and rendered AS an outsider, by name — see OQ-MDC-009, which asks whether the pack or the
 * contract should move. C7's job is to state what is there, not to decide that.
 */
export type PackProvenanceState = Exclude<ProvenanceChip, 'USER'>;

/** Derived from the one vocabulary; never typed out. */
const PACK_SIDE_CHIPS: readonly ProvenanceChip[] = PROVENANCE_CHIPS.filter((chip) => chip !== 'USER');

type DataPrivacyArtifactBase = {
  readonly set: string;
  readonly version: string;
  readonly datasetVersion: string;
  readonly formatVersion: number;
  readonly generatedAt: string;
  readonly bytes: number;
  readonly rowCount: number;
  readonly minAppVersion: string;
  readonly staleAfterDays: number;
};

export type DataPrivacyArtifact = DataPrivacyArtifactBase & (
  | { readonly kind: 'PACK' }
  | {
      readonly kind: 'FX_SNAPSHOT';
      readonly snapshotDate: string;
      readonly earliestRateDate: string;
      readonly latestRateDate: string;
      readonly accessedAt: string;
    }
);

export type CountReading =
  | { readonly status: 'AVAILABLE'; readonly count: number }
  | { readonly status: 'UNAVAILABLE'; readonly reason: string };

export type DataPrivacyReading = {
  readonly artifacts: readonly DataPrivacyArtifact[];
  readonly provenanceMix: readonly {
    readonly state: PackProvenanceState;
    readonly count: number;
  }[];
  /** Chips the contract's vocabulary does not contain, counted and named rather than folded in. */
  readonly provenanceOutsideVocabulary: readonly {
    readonly state: string;
    readonly count: number;
  }[];
  readonly local: {
    readonly bundledRows: number;
    readonly encryptedVaultKeys: CountReading;
    readonly preferenceKeys: CountReading;
    readonly importedPackRows: CountReading;
  };
};

export class ArtifactVersionDisagreementError extends Error {
  constructor(set: string, manifestVersion: string, bodyVersion: string) {
    super(
      `the bundled ${set} artifact reports version "${manifestVersion}" in its manifest and ` +
        `"${bodyVersion}" in its body; one fact has diverged between its two homes`,
    );
    this.name = 'ArtifactVersionDisagreementError';
  }
}

export function assertArtifactVersionsAgree(
  set: string,
  manifestVersion: string,
  bodyVersion: string,
): string {
  if (manifestVersion !== bodyVersion) {
    throw new ArtifactVersionDisagreementError(set, manifestVersion, bodyVersion);
  }
  return manifestVersion;
}

const textField = (value: unknown, field: string, set: string): string => {
  if (typeof value !== 'string') throw new Error(`${set} has no string ${field}`);
  return value;
};

const numberField = (value: unknown, field: string, set: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${set} has no finite numeric ${field}`);
  }
  return value;
};

const versionFromBothHomes = (
  set: string,
  manifest: JsonObject,
  body: JsonObject,
  field: 'packVersion' | 'snapshotVersion',
): string => {
  const manifestVersion = textField(manifest[field], field, set);
  const bodyVersion = textField(body[field], field, set);
  return assertArtifactVersionsAgree(set, manifestVersion, bodyVersion);
};

const isPackProvenanceState = (value: unknown): value is PackProvenanceState =>
  typeof value === 'string' && (PACK_SIDE_CHIPS as readonly string[]).includes(value);

const provenanceMix = (bodies: readonly JsonObject[]): {
  readonly mix: DataPrivacyReading['provenanceMix'];
  readonly outside: DataPrivacyReading['provenanceOutsideVocabulary'];
} => {
  const counts = new Map<PackProvenanceState, number>();
  const outside = new Map<string, number>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    for (const [field, child] of Object.entries(value)) {
      if (field === 'chip' || field === 'provenanceChip') {
        /* A chip the contract's vocabulary does not contain is COUNTED AND NAMED, never folded
           into a neighbouring member and never silently dropped. Throwing here would have been
           the other tempting answer, and it would have taken the whole screen down over one row
           in one pack — reporting it is what lets somebody act on it. */
        if (isPackProvenanceState(child)) {
          counts.set(child, (counts.get(child) ?? 0) + 1);
        } else {
          const name = String(child);
          outside.set(name, (outside.get(name) ?? 0) + 1);
        }
      }
      visit(child);
    }
  };
  bodies.forEach(visit);
  if (counts.size === 0 && outside.size === 0) {
    throw new Error('no pack-side provenance chips were found; absence cannot be reported as a mix');
  }
  return {
    mix: [...counts].map(([state, count]) => ({ state, count })),
    outside: [...outside].map(([state, count]) => ({ state, count })),
  };
};

const countOrUnavailable = (read: () => number): CountReading => {
  try {
    const count = read();
    if (!Number.isInteger(count) || count < 0) {
      return { status: 'UNAVAILABLE', reason: 'the store returned an invalid count' };
    }
    return { status: 'AVAILABLE', count };
  } catch (error) {
    return {
      status: 'UNAVAILABLE',
      reason: error instanceof Error ? error.message : 'the store read failed for an unknown reason',
    };
  }
};

const preferences = new MMKV({ id: `${STORAGE_NAMESPACE}.preferences` });

const readLocalHoldings = (bundledRows: number): DataPrivacyReading['local'] => ({
  bundledRows,
  encryptedVaultKeys: countOrUnavailable(() => keyVault.getEncryptedStorage().getAllKeys().length),
  preferenceKeys: countOrUnavailable(() => preferences.getAllKeys().length),
  importedPackRows: countOrUnavailable(() => {
    const row = openPackStore().getFirstSync<{ readonly rowCount: number }>(
      'SELECT COUNT(*) AS rowCount FROM pack_rows',
    );
    if (row === null) throw new Error('the pack store returned no COUNT row');
    return row.rowCount;
  }),
});

/**
 * Reads backing stores directly. `isCountTrustworthy()` protects in-memory Zustand collection
 * defaults before hydration; it does not apply to MMKV key enumeration or SQLite COUNT queries.
 * Failed backing-store reads become UNAVAILABLE and never a confident zero.
 */
export function readDataPrivacy(): DataPrivacyReading {
  const packResults = openAllPackSets(bundledReader);
  const refused = packResults.filter(result => !result.accepted);
  if (refused.length > 0) {
    throw new Error(`bundled pack verification refused ${refused.map(result => result.set).join(', ')}`);
  }

  const artifacts: DataPrivacyArtifact[] = packResults.map(result => {
    if (!result.accepted) throw new Error(`${result.set} was refused after the refusal check`);
    const files = BUNDLED_FILES[result.set];
    if (files === undefined) throw new Error(`verified set ${result.set} has no bundled files`);
    const manifest = result.manifest;
    return {
      set: result.set,
      kind: 'PACK',
      version: versionFromBothHomes(result.set, files.manifest, files.body, 'packVersion'),
      datasetVersion: manifest.datasetVersion,
      formatVersion: manifest.packFormatVersion,
      generatedAt: manifest.generatedAt,
      bytes: manifest.bytes,
      rowCount: manifest.rowCounts.totalRows,
      minAppVersion: manifest.minAppVersion,
      staleAfterDays: manifest.provenanceContract.staleAfterDays,
    };
  });

  const fxSets = inventory(bundledReader).filter(item => item.kind === 'fx-snapshot');
  if (fxSets.length !== 1) {
    throw new Error(`expected one bundled FX snapshot; found ${fxSets.length}`);
  }
  const fxSet = fxSets[0];
  if (fxSet === undefined) throw new Error('the bundled reader has no FX snapshot');
  const fxFiles = BUNDLED_FILES[fxSet.set];
  if (fxFiles === undefined) throw new Error(`FX set ${fxSet.set} has no bundled files`);
  const openedFx = openFxSnapshot(bundledReader, fxSet.set);
  const fx = openedFx.manifest;
  artifacts.push({
    set: fxSet.set,
    kind: 'FX_SNAPSHOT',
    version: versionFromBothHomes(fxSet.set, fxFiles.manifest, fxFiles.body, 'snapshotVersion'),
    datasetVersion: fx.datasetVersion,
    formatVersion: fx.snapshotFormatVersion,
    generatedAt: fx.generatedAt,
    bytes: fx.bytes,
    rowCount: fx.currencyCount,
    minAppVersion: fx.minAppVersion,
    staleAfterDays: fx.provenanceContract.staleAfterDays,
    snapshotDate: fx.snapshotDate,
    earliestRateDate: fx.earliestRateDate,
    latestRateDate: fx.latestRateDate,
    accessedAt: fx.attribution.accessedAt,
  });

  const bundledRows = artifacts.reduce((total, artifact) => total + artifact.rowCount, 0);
  const chips = provenanceMix(Object.values(BUNDLED_FILES).map(files => files.body));
  return {
    artifacts,
    provenanceMix: chips.mix,
    provenanceOutsideVocabulary: chips.outside,
    local: readLocalHoldings(bundledRows),
  };
}
