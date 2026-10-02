import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { resolveMedia } from '../resolveMedia';
import { rightsVerdict } from '../rights';
import type { MediaRecord, MediaSubject } from '../types';

const POPULATION = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'smartcard-data-pipeline',
  'campaign-p4',
  'state',
  'MEDIA_POPULATION.json',
);

const card: MediaSubject = { subjectKind: 'card', subjectId: 'card:max:gold', fallbackClass: 'card' };
const groceries: MediaSubject = {
  subjectKind: 'category',
  subjectId: 'groceries',
  fallbackClass: 'benefit',
};

const uncleared: MediaRecord = {
  assetId: 'e1b2c3d4e5f60718',
  mediaKind: 'MERCHANT_LOGO',
  subjectKind: 'merchant',
  subjectId: 'card:max:gold',
  fallbackClass: 'card',
  sourceUrl: 'https://example.com/brand/logo.svg',
  altTextKey: 'media.alt.x',
  aspectRatio: '1:1',
};

describe('resolveMedia — M1 totality and M3 fail-closed rights', () => {
  it('every derived subject resolves on the empty media set', () => {
    expect(existsSync(POPULATION)).toBe(true);
    const pop = JSON.parse(readFileSync(POPULATION, 'utf8')) as {
      total: number;
      subjects: MediaSubject[];
    };
    expect(pop.subjects.length).toBe(pop.total);
    expect(pop.total).toBeGreaterThan(0);
    let resolved = 0;
    for (const subject of pop.subjects) {
      if (resolveMedia(subject, []) !== null) {
        resolved += 1;
      }
    }
    // p4-media.mjs requires this exact phrase in the gate output.
    // eslint-disable-next-line no-console
    console.log(`resolved ${resolved} / ${pop.total}`);
    expect(resolved).toBe(pop.total);
  });

  it('the empty media set still resolves every subject (never null)', () => {
    expect(resolveMedia(card, [])).not.toBeNull();
    expect(resolveMedia(groceries, [])).not.toBeNull();
    expect(resolveMedia(card, [])?.tier).toBe(4);
    expect(resolveMedia(groceries, [])?.tier).toBe(3);
  });

  it('a record with a sourceUrl and no rightsState is refused rather than rendered', () => {
    const merchant: MediaSubject = {
      subjectKind: 'merchant',
      subjectId: 'card:max:gold',
      fallbackClass: 'benefit',
    };
    const planted: MediaRecord = { ...uncleared, fallbackClass: 'benefit', subjectKind: 'merchant' };
    expect(rightsVerdict(planted, true).renderable).toBe(false);
    const resolution = resolveMedia(merchant, [planted]);
    expect(resolution?.kind).toBe('generated');
    expect(resolution?.assetId).toBeNull();
  });

  it('the same subject and media set yield the same tier and assetId twice', () => {
    const a = resolveMedia(card, []);
    const b = resolveMedia(card, []);
    expect(a).toEqual(b);
  });

  it('reordering the media set does not change the resolution', () => {
    const merchant: MediaSubject = {
      subjectKind: 'merchant',
      subjectId: 'merchant:shufersal',
      fallbackClass: 'benefit',
    };
    const cleared: MediaRecord = {
      assetId: 'a1b2c3d4e5f60718',
      mediaKind: 'MERCHANT_LOGO',
      subjectKind: 'merchant',
      subjectId: 'merchant:shufersal',
      fallbackClass: 'benefit',
      rightsState: 'CLEARED',
      rightsBasis: 'commissioned in-house; owned outright',
      rightsDecidedBy: 'Ibrahim Abu Nasser (Owner)',
      rightsDecidedAt: '2026-08-25',
      altTextKey: 'ייצוג הטבה לפי קטגוריה',
      aspectRatio: '8:5',
      provenanceChip: 'VERIFIED',
    };
    const noise: MediaRecord = {
      ...uncleared,
      fallbackClass: 'benefit',
      subjectKind: 'merchant',
      subjectId: 'merchant:other',
    };
    const forward = resolveMedia(merchant, [noise, cleared]);
    const reverse = resolveMedia(merchant, [cleared, noise]);
    expect(forward).toEqual(reverse);
    expect(forward?.kind).toBe('asset');
    expect(forward?.assetId).toBe('a1b2c3d4e5f60718');
  });

  it('removing the generic tier leaves card subjects unresolved', () => {
    expect(resolveMedia(card, [], { omitGeneric: true })).toBeNull();
    expect(resolveMedia(groceries, [], { omitGeneric: true })).not.toBeNull();
  });

  it('generated card tier 3 lights only when catalog context is supplied', () => {
    const withIssuer = resolveMedia(card, [], { context: { issuerId: 'max' } });
    expect(withIssuer?.tier).toBe(3);
    expect(withIssuer?.kind).toBe('generated');
    expect(withIssuer?.generatedSpec?.treatment).toBe('product');
  });
});
