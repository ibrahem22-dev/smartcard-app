/**
 * The Learn surface's single door to the shipped content pack.
 *
 * Only this adapter-boundary module names the pack or the published adapter package. The screen
 * receives the adapter's views and the adapter slice sizes; it never reads, projects, or counts
 * raw pack rows itself.
 */
import {
  openContentSlices,
  type AdapterContact,
  type AdapterGlossaryTerm,
  type AdapterRight,
  type PackDocument,
  type SourcedValue,
} from '@smartcard/data-authority-adapter';

import contentPackJson from './packs/content/pack.json';

import { EXPECTED_DATASET_ID } from './datasetId';
import { assertPinnedAdapter } from './index';

export type LearnContact = AdapterContact;
export type LearnGlossaryTerm = AdapterGlossaryTerm;
export type LearnRight = AdapterRight;
export type LearnSourcedValue = SourcedValue;

export type LearnContent = {
  readonly glossary: readonly LearnGlossaryTerm[];
  readonly rights: readonly LearnRight[];
  readonly contacts: readonly LearnContact[];
  readonly counts: {
    readonly glossary: number;
    readonly rights: number;
    readonly contacts: number;
  };
};

const contentPack = contentPackJson as PackDocument;

export function readLearnContent(): LearnContent {
  assertPinnedAdapter();
  const slices = openContentSlices(contentPack, {
    expectedDatasetId: EXPECTED_DATASET_ID,
  });

  return {
    glossary: slices.glossary.all(),
    rights: slices.rights.all(),
    contacts: slices.contacts.all(),
    counts: {
      glossary: slices.glossary.size,
      rights: slices.rights.size,
      contacts: slices.contacts.size,
    },
  };
}

export const LEARN_CONTENT = readLearnContent();
