/**
 * THE PROJECTION HOLDS NOTHING INTERNAL — checked against every shipped row, at runtime.
 *
 * The gate checks the FIELD LISTS against the register, which is a statement about names. This
 * checks the OBJECTS the projections actually build, which is a statement about values — and it is
 * the half that catches nesting. `benefits.benefits.value.text` is internal and `value` is
 * projected: whether the internal part survives depends on what the adapter's own slice puts inside
 * `value`, which no list can say and no type can promise, because a pack row is data.
 *
 * So this walks every projected object to its leaves and asserts that no internal prose value from
 * the shipped packs is anywhere inside it.
 */
import {
  openBenefitsSlices,
  openContentSlices,
  openTaxonomySlices,
  type PackDocument,
} from '@smartcard/data-authority-adapter';

import {
  BENEFIT_CONSUMER_FIELDS,
  GLOSSARY_CONSUMER_FIELDS,
  MERCHANT_CONSUMER_FIELDS,
  RIGHT_CONSUMER_FIELDS,
  projectBenefit,
  projectContact,
  projectGlossaryTerm,
  projectMerchant,
  projectRight,
} from '../consumerProjection';
import { EXPECTED_DATASET_ID } from '../datasetId';
import benefitsPackJson from '../packs/benefits/pack.json';
import contentPackJson from '../packs/content/pack.json';
import taxonomyPackJson from '../packs/taxonomy/pack.json';
import { distinctiveInternalPackText } from './internalPackText';

const options = { expectedDatasetId: EXPECTED_DATASET_ID };
const benefits = openBenefitsSlices(benefitsPackJson as PackDocument, options);
const content = openContentSlices(contentPackJson as PackDocument, options);
const taxonomy = openTaxonomySlices(taxonomyPackJson as PackDocument, options);

const INTERNAL = new Set(distinctiveInternalPackText());

function leaves(value: unknown, out: string[]): string[] {
  if (typeof value === 'string') {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) leaves(item, out);
    return out;
  }
  if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) leaves(item, out);
  }
  return out;
}

function internalInside(rows: readonly unknown[]): readonly string[] {
  const found = new Set<string>();
  for (const row of rows) {
    for (const leaf of leaves(row, [])) {
      if (INTERNAL.has(leaf)) found.add(leaf);
    }
  }
  return [...found];
}

describe('the consumer projections carry no internal pack text', () => {
  it('has a non-empty internal vocabulary — or it proves nothing', () => {
    expect(INTERNAL.size).toBeGreaterThan(100);
  });

  it('benefits', () => {
    expect(internalInside(benefits.benefits.all().map(projectBenefit))).toEqual([]);
  });

  it('merchants', () => {
    expect(internalInside(taxonomy.merchants.all().map(projectMerchant))).toEqual([]);
  });

  it('glossary terms', () => {
    expect(internalInside(content.glossary.all().map(projectGlossaryTerm))).toEqual([]);
  });

  it('rights', () => {
    expect(internalInside(content.rights.all().map(projectRight))).toEqual([]);
  });

  it('contacts', () => {
    expect(internalInside(content.contacts.all().map(projectContact))).toEqual([]);
  });

  it('the RAW rows do carry it — so the assertions above are about the projection', () => {
    const raw = [
      ...internalInside(benefits.benefits.all()),
      ...internalInside(taxonomy.merchants.all()),
      ...internalInside(content.glossary.all()),
      ...internalInside(content.contacts.all()),
    ];
    expect(raw.length).toBeGreaterThan(0);
  });

  it('projects a new object rather than the row it was given', () => {
    const row = benefits.benefits.all()[0];
    expect(row).toBeDefined();
    const projected = projectBenefit(row!);
    expect(projected).not.toBe(row);
    for (const key of Object.keys(projected)) {
      expect(BENEFIT_CONSUMER_FIELDS as readonly string[]).toContain(key);
    }
  });

  it('every projected key is declared, on every row of every unit', () => {
    const cases: readonly (readonly [readonly unknown[], readonly string[]])[] = [
      [benefits.benefits.all().map(projectBenefit), BENEFIT_CONSUMER_FIELDS],
      [taxonomy.merchants.all().map(projectMerchant), MERCHANT_CONSUMER_FIELDS],
      [content.glossary.all().map(projectGlossaryTerm), GLOSSARY_CONSUMER_FIELDS],
      [content.rights.all().map(projectRight), RIGHT_CONSUMER_FIELDS],
    ];
    for (const [rows, declared] of cases) {
      const seen = new Set<string>();
      for (const row of rows) for (const key of Object.keys(row as object)) seen.add(key);
      expect([...seen].filter((key) => !declared.includes(key))).toEqual([]);
    }
  });
});
