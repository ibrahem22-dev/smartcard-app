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

import {
  projectContact,
  projectGlossaryTerm,
  projectRight,
  type ContactConsumerView,
  type GlossaryConsumerView,
  type RightConsumerView,
} from './consumerProjection';

import { EXPECTED_DATASET_ID } from './datasetId';
import { assertPinnedAdapter } from './index';

/**
 * The three Learn rows, as PROJECTIONS rather than raw pack rows.
 *
 * PD-MDC-082 was a leak on this very screen: the pack's research annotations reached a reader. The
 * aliases these three replaced (`= AdapterGlossaryTerm` and friends) are how that was possible —
 * `arabicSource.quote`, `definitionSource.quote` and `notes` were all one keystroke away. See
 * consumerProjection.ts.
 */
export type LearnContact = ContactConsumerView;
export type LearnGlossaryTerm = GlossaryConsumerView;
export type LearnRight = RightConsumerView;
export type LearnSourcedValue = SourcedValue;
export type LearnVerificationStatus = NonNullable<AdapterGlossaryTerm['verificationStatus']> | 'N_A';

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
    glossary: slices.glossary.all().map(projectGlossaryTerm),
    rights: slices.rights.all().map(projectRight),
    contacts: slices.contacts.all().map(projectContact),
    counts: {
      glossary: slices.glossary.size,
      rights: slices.rights.size,
      contacts: slices.contacts.size,
    },
  };
}

export const LEARN_CONTENT = readLearnContent();
