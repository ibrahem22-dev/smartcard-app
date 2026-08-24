import { join } from 'node:path';

import {
  CardsAdapter,
  coverageSlice,
  type AdapterCard,
  type CardsPack,
} from '@smartcard/data-authority-adapter';

import { EXPECTED_DATASET_ID } from '../datasetId';
import { resolveAll, resolveReference, versionsDiffer, type OwningPackSet } from '../crossSet';
import { fsPackReader } from '../fsPackReader';
import { openPackSet } from '../packSet';

/**
 * CRITERION C4 / OBLIGATION OB-2, at GENUINELY MIXED PACK VERSIONS.
 *
 *   > **C4.** *"A cross-pack-set reference miss renders as **absent, never as an error**, proven at
 *   > genuinely mixed pack versions (`catalog` at one `packVersion`, `benefits` at a newer one)."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE MIX IS REAL, AND THE MISS IS MODELLED — THE TWO ARE DIFFERENT AND BOTH ARE SAID
 *
 * The shipped set is already at mixed versions: `catalog` and `benefits` at `2026.08.22+3`,
 * `content` and `taxonomy` at `+2`, every one of them signed at the version it carries. So "mixed
 * pack versions" is not staged here — it is measured, and the test asserts it before relying on it.
 *
 * What is not available is a real OLDER `catalog` that is missing cards. Producing one would mean
 * signing a pack, and the signing key's private half lives outside both repositories (ADR-017), so
 * this campaign cannot make one and must not pretend otherwise.
 *
 * So the older catalog is modelled by **dropping rows from the verified pack after it is opened**.
 * That is exactly the content difference an older `catalog` would present — a card absent from the
 * set the device holds — and it is honest because the artifact is verified first and the
 * modification happens to the parsed rows, never to the bytes. A test that edited the pack file
 * would have failed its signature, which is the right outcome and the wrong experiment.
 */

const PACKS = join(__dirname, '..', 'packs');
const reader = fsPackReader(PACKS);
const decoder = new TextDecoder();

const manifestOf = (set: string): { packVersion: string; packId: string } =>
  JSON.parse(decoder.decode(reader.read(set, 'manifest.json')));

/**
 * The catalog the device holds, read through the ADAPTER'S OWN DOOR.
 *
 * `missing` models an older pack by leaving rows out of the document handed to `CardsAdapter.open`.
 * The bytes are untouched and already verified; what changes is which verified rows the device is
 * modelled as holding, which is exactly the content difference an older `catalog` presents.
 */
const openCatalog = (missing: readonly string[] = []): { adapter: CardsAdapter; ids: string[] } => {
  const pack = JSON.parse(decoder.decode(reader.read('catalog', 'pack.json')));
  const all = pack.units.cards as CardsPack['cards'];
  const rows = all.filter((r) => !missing.includes(r.cardId));
  const adapter = CardsAdapter.open(
    { datasetId: pack.datasetId, datasetVersion: pack.datasetVersion, cards: rows },
    { expectedDatasetId: EXPECTED_DATASET_ID },
  );
  return { adapter, ids: rows.map((r) => r.cardId) };
};

const coverageRows = (): { cardId: string }[] => {
  const pack = JSON.parse(decoder.decode(reader.read('benefits', 'pack.json')));
  return [...coverageSlice(pack, { expectedDatasetId: EXPECTED_DATASET_ID }).all()];
};

const catalogHeld = (missing: readonly string[] = []): OwningPackSet<AdapterCard> => {
  const { adapter } = openCatalog(missing);
  return {
    packId: 'catalog',
    packVersion: manifestOf('catalog').packVersion,
    // The adapter's own read. This module never looks inside a pack itself.
    lookup: (id) => adapter.read(id),
  };
};

describe('C4 — a cross-pack-set reference miss is an expected state', () => {
  it('the shipped pack sets really are at mixed versions — measured, not staged', () => {
    const versions = new Set(reader.sets().map((s) => manifestOf(s).packVersion));
    expect(versions.size).toBeGreaterThan(1);
    // And they verify at those versions, so the mix is a real published state and not an edit.
    for (const set of ['catalog', 'benefits']) {
      expect(openPackSet(reader, set).accepted).toBe(true);
    }
  });

  it('has real cross-set references to resolve — an empty population would prove nothing', () => {
    const rows = coverageRows();
    expect(rows.length).toBeGreaterThan(100);
    expect(rows.every((r) => typeof r.cardId === 'string')).toBe(true);
    expect(openCatalog().ids.length).toBeGreaterThan(100);
  });

  it('every benefits reference resolves against the catalog the device actually holds', () => {
    // The control. Without it, "absent" would be indistinguishable from a resolver that never
    // finds anything.
    const { present, absent, unresolvable } = resolveAll(
      coverageRows().map((r) => r.cardId),
      catalogHeld(),
    );
    expect(`${present} present, ${absent} absent, ${unresolvable} unresolvable`)
      .toBe(`${present} present, 0 absent, 0 unresolvable`);
    expect(present).toBeGreaterThan(100);
  });

  it('a card the older catalog does not carry resolves as ABSENT_IN_THIS_VERSION', () => {
    const dropped = coverageRows()[0]!.cardId;
    const resolution = resolveReference(dropped, catalogHeld([dropped]));

    expect(resolution.state).toBe('ABSENT_IN_THIS_VERSION');
    // Not an error object, not a throw, and no value a caller could accidentally read.
    expect(resolution.value).toBeUndefined();
    // It names the pack set that owns the referent and the version held, because "absent" is a
    // statement about two pack versions rather than about a fault.
    expect(resolution.ownedBy).toBe('catalog');
    expect(resolution.heldVersion).toBe(manifestOf('catalog').packVersion);
  });

  it('resolving many reports the skew as a MEASUREMENT, not a failure', () => {
    const rows = coverageRows();
    const dropped = rows.slice(0, 5).map((r) => r.cardId);
    const { present, absent, unresolvable } = resolveAll(
      rows.map((r) => r.cardId),
      catalogHeld(dropped),
    );

    expect(absent).toBe(new Set(dropped).size);
    expect(unresolvable).toBe(0);
    expect(present).toBe(rows.length - absent);
  });

  it('NEVER throws, whatever it is handed', () => {
    const catalog = catalogHeld();
    for (const id of ['', '   ', 'card:does-not-exist', 'not-an-id-at-all']) {
      expect(() => resolveReference(id, catalog)).not.toThrow();
    }
  });

  it('distinguishes a MALFORMED reference from a legal miss', () => {
    // Collapsing these would hide a corrupt artifact behind a legal state: a pack that verified and
    // carries an empty reference is a defect, and skew is not.
    expect(resolveReference('', catalogHeld()).state).toBe('UNRESOLVABLE_REFERENCE');
    expect(resolveReference('card:not-in-this-catalog', catalogHeld()).state)
      .toBe('ABSENT_IN_THIS_VERSION');
  });

  it('says plainly when two pack sets are at different versions', () => {
    const catalog = manifestOf('catalog');
    const content = manifestOf('content');
    expect(versionsDiffer(catalog, content)).toBe(true);
    expect(versionsDiffer(catalog, catalog)).toBe(false);
  });
});
