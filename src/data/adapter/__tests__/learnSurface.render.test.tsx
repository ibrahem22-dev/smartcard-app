import React from 'react';
import { fireEvent, render, type RenderAPI } from '@testing-library/react-native';

import {
  openContentSlices,
  type PackDocument,
  type SourcedValue,
} from '@smartcard/data-authority-adapter';

import { LearnScreen } from '../../../screens/LearnScreen';
import { useLanguageStore } from '../../../store/useLanguageStore';
import { EXPECTED_DATASET_ID } from '../datasetId';
import { LEARN_CONTENT } from '../learn';
import contentPackJson from '../packs/content/pack.json';

type RawContentPack = PackDocument & {
  readonly counts: readonly {
    readonly kind: string;
    readonly rows: number;
    readonly unit: string;
  }[];
};

const pack = contentPackJson as RawContentPack;
const adapterSlices = openContentSlices(pack, { expectedDatasetId: EXPECTED_DATASET_ID });

const allText = (api: RenderAPI): string => JSON.stringify(api.toJSON());

const EXPECTED_VERIFICATION_LABELS: Readonly<Record<string, string>> = {
  VERIFIED_OFFICIAL: 'Verified against an official source',
  CORROBORATED: 'Corroborated by multiple sources',
  SINGLE_SOURCE: 'Based on a single source',
  CONFLICTING: 'Sources conflict',
  DERIVED: 'Derived from existing data',
  DERIVED_FROM_OFFICIAL: 'Derived from an official source',
  NOT_PUBLISHED: 'Not published',
  LOGIN_GATED: 'Requires account access',
  CUSTOMER_SPECIFIC: 'Customer-specific',
  ESTIMATED: 'Estimate',
  HISTORICAL: 'Historical information',
  UNKNOWN_AFTER_RESEARCH: 'Unknown after research',
  UNKNOWN: 'Unknown status',
  N_A: 'Not applicable',
};

const EXPECTED_ARABIC_STATUS_LABELS: Readonly<Record<string, string>> = {
  OFFICIAL_ARABIC: 'Official Arabic term',
  COMMON_USAGE: 'Common Arabic usage',
  TRANSLITERATION: 'Arabic transliteration',
  UNKNOWN_AFTER_RESEARCH: 'Our Arabic rendering; no official term was found',
};

const EXPECTED_LIFECYCLE_LABELS: Readonly<Record<string, string>> = {
  CURRENT: 'Current organisation',
  HISTORICAL_MERGED: 'Historical merged organisation',
};

type StatusOccurrence = {
  readonly rawStatus: string;
  readonly testID: string;
};

const expectSpecificDistinctLabels = (
  api: RenderAPI,
  occurrences: readonly StatusOccurrence[],
  expectedLabels: Readonly<Record<string, string>>,
  renderedText: (label: string) => string,
): void => {
  expect(occurrences.length).toBeGreaterThan(0);
  const shippedStatuses = new Set(occurrences.map(({ rawStatus }) => rawStatus));
  const renderedLabels = new Set<string>();

  for (const { rawStatus, testID } of occurrences) {
    const expectedLabel = expectedLabels[rawStatus];
    if (expectedLabel === undefined) throw new Error(`No expected rendered label for shipped status ${rawStatus}`);
    const expectedText = renderedText(expectedLabel);
    const statusNode = api.getByTestId(testID);
    expect(statusNode).toHaveTextContent(expectedText);
    renderedLabels.add(String(statusNode.props.children));
  }

  expect(renderedLabels.size).toBe(shippedStatuses.size);
};

const mount = (): RenderAPI => {
  useLanguageStore.setState({ languageChoice: 'en', resolvedLanguage: 'en' });
  return render(<LearnScreen />);
};

const sourcedValues = (contact: (typeof LEARN_CONTENT.contacts)[number]): readonly SourcedValue[] =>
  Object.values(contact).filter((value): value is SourcedValue =>
    typeof value === 'object'
      && value !== null
      && ('verificationStatus' in value || 'note' in value || 'value' in value),
  );

describe('MDC C6 — Learn reads and renders the shipped content pack', () => {
  it('reads glossary, rights and contacts through the adapter', () => {
    expect(LEARN_CONTENT.glossary.map(row => row.termId)).toEqual(adapterSlices.glossary.ids());
    expect(LEARN_CONTENT.rights.map(row => row.topicId)).toEqual(adapterSlices.rights.ids());
    expect(LEARN_CONTENT.contacts.map(row => row.orgId)).toEqual(adapterSlices.contacts.ids());
    expect(adapterSlices.glossary.size).toBeGreaterThan(0);
    expect(adapterSlices.rights.size).toBeGreaterThan(0);
    expect(adapterSlices.contacts.size).toBeGreaterThan(0);
  });

  it('derives rendered counts from adapter slices and agrees with declared and actual pack rows', () => {
    const declaredByUnit = new Map(pack.counts.map(count => [count.unit, count.rows]));
    const actualByUnit = new Map(
      Object.entries(pack.units).map(([unit, rows]) => [unit, rows.length]),
    );
    const derivedByUnit = new Map([
      ['glossary', LEARN_CONTENT.counts.glossary],
      ['rights', LEARN_CONTENT.counts.rights],
      ['contacts', LEARN_CONTENT.counts.contacts],
    ]);

    for (const [unit, derived] of derivedByUnit) {
      expect(derived).toBeGreaterThan(0);
      expect(derived).toBe(declaredByUnit.get(unit));
      expect(derived).toBe(actualByUnit.get(unit));
    }

    const api = mount();
    expect(api.getByTestId('learn-tab-glossary').props.accessibilityValue?.text).toBe(String(derivedByUnit.get('glossary')));
    expect(api.getByTestId('learn-tab-rights').props.accessibilityValue?.text).toBe(String(derivedByUnit.get('rights')));
    expect(api.getByTestId('learn-tab-contacts').props.accessibilityValue?.text).toBe(String(derivedByUnit.get('contacts')));
  });

  it('renders every glossary Arabic status and every evidenced note', () => {
    const api = mount();
    const statuses = LEARN_CONTENT.glossary.filter(row => row.arabicStatus !== undefined);
    const verificationStatuses = LEARN_CONTENT.glossary.filter(row => row.verificationStatus !== undefined);
    const notes = LEARN_CONTENT.glossary.filter(row => row.notes !== undefined);

    expect(api.getAllByTestId(/-arabic-status$/)).toHaveLength(statuses.length);
    expect(api.getAllByTestId(/-verification$/)).toHaveLength(verificationStatuses.length);
    expect(api.getAllByTestId(/-notes$/)).toHaveLength(notes.length);
    for (const row of notes) {
      expect(String(api.getByTestId(`learn-glossary-row-${row.termId}-notes`).props.children)).toContain(row.notes ?? '');
    }
    expectSpecificDistinctLabels(
      api,
      statuses.map(row => ({
        rawStatus: row.arabicStatus ?? '',
        testID: `learn-glossary-row-${row.termId}-arabic-status`,
      })),
      EXPECTED_ARABIC_STATUS_LABELS,
      label => `Arabic term status: ${label}`,
    );
    expectSpecificDistinctLabels(
      api,
      verificationStatuses.map(row => ({
        rawStatus: row.verificationStatus ?? '',
        testID: `learn-glossary-row-${row.termId}-verification`,
      })),
      EXPECTED_VERIFICATION_LABELS,
      label => `Verification: ${label}`,
    );
  });

  it('renders every right caveat and verification status', () => {
    const api = mount();
    fireEvent.press(api.getByTestId('learn-tab-rights'));
    const caveats = LEARN_CONTENT.rights.filter(row => row.caveat !== undefined);
    const statuses = LEARN_CONTENT.rights.filter(row => row.verificationStatus !== undefined);

    expect(api.getAllByTestId(/-caveat$/)).toHaveLength(caveats.length);
    expect(api.getAllByTestId(/-verification$/)).toHaveLength(statuses.length);
    for (const row of caveats) {
      expect(api.getByTestId(`learn-right-row-${row.topicId}-caveat`)).toHaveTextContent(row.caveat ?? '');
    }
    expectSpecificDistinctLabels(
      api,
      statuses.map(row => ({
        rawStatus: row.verificationStatus ?? '',
        testID: `learn-right-row-${row.topicId}-verification`,
      })),
      EXPECTED_VERIFICATION_LABELS,
      label => `Verification: ${label}`,
    );
  });

  it('renders contact lifecycle plus sourced-value verification and notes without provenance labels', () => {
    const api = mount();
    fireEvent.press(api.getByTestId('learn-tab-contacts'));
    const values = LEARN_CONTENT.contacts.flatMap(sourcedValues);
    const verified = values.filter(value => value.verificationStatus !== undefined);
    const noted = values.filter(value => value.note !== undefined);
    const visibleEvidence = values.flatMap(value => [value.value, value.note]
      .filter((item): item is string => item !== undefined && item.length > 0));
    const provenanceFields = ['sourceLabel', 'sourceUrl', 'quote'] as const;

    expect(api.getAllByTestId(/-lifecycle$/)).toHaveLength(LEARN_CONTENT.contacts.length);
    expect(api.getAllByTestId(/-verification$/)).toHaveLength(verified.length);
    expect(api.getAllByTestId(/-note$/)).toHaveLength(noted.length);
    const rendered = allText(api);
    expectSpecificDistinctLabels(
      api,
      LEARN_CONTENT.contacts.map(row => ({
        rawStatus: row.lifecycleStatus,
        testID: `learn-contact-row-${row.orgId}-lifecycle`,
      })),
      EXPECTED_LIFECYCLE_LABELS,
      label => label,
    );
    const verificationOccurrences = LEARN_CONTENT.contacts.flatMap(contact => {
      const rowId = `learn-contact-row-${contact.orgId}`;
      return Object.entries(contact).flatMap(([field, value]) => {
        if (typeof value !== 'object'
          || value === null
          || !('verificationStatus' in value)
          || typeof value.verificationStatus !== 'string') return [];
        return [{ rawStatus: value.verificationStatus, testID: `${rowId}-${field}-verification` }];
      });
    });
    expectSpecificDistinctLabels(
      api,
      verificationOccurrences,
      EXPECTED_VERIFICATION_LABELS,
      label => `Verification: ${label}`,
    );
    for (const field of provenanceFields) {
      const population = values
        .map(value => value[field])
        .filter((value): value is string => value !== undefined && value.length > 0);
      expect(population.length).toBeGreaterThan(0);
      const guardedPopulation = [...new Set(population.filter(value => (
        !visibleEvidence.some(visible => visible.includes(value))
      )))];
      expect(guardedPopulation.length).toBeGreaterThan(0);
      for (const provenance of guardedPopulation) expect(rendered).not.toContain(provenance);
    }
  });

  it('renders N_A as not applicable and never as the pack-authored unknown status', () => {
    const api = mount();
    fireEvent.press(api.getByTestId('learn-tab-contacts'));
    const nAOccurrences = LEARN_CONTENT.contacts.flatMap(contact => {
      const rowId = `learn-contact-row-${contact.orgId}`;
      return Object.entries(contact).flatMap(([field, value]) => (
        typeof value === 'object'
        && value !== null
        && 'verificationStatus' in value
        && value.verificationStatus === 'N_A'
          ? [`${rowId}-${field}-verification`]
          : []
      ));
    });

    expect(nAOccurrences.length).toBeGreaterThan(0);
    for (const testID of nAOccurrences) {
      expect(api.getByTestId(testID)).toHaveTextContent('Verification: Not applicable');
      expect(api.getByTestId(testID)).not.toHaveTextContent('Unknown status');
    }
  });
});
