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
    const notes = LEARN_CONTENT.glossary.filter(row => row.notes !== undefined);

    expect(api.getAllByTestId(/-arabic-status$/)).toHaveLength(statuses.length);
    expect(api.getAllByTestId(/-notes$/)).toHaveLength(notes.length);
    for (const row of notes) {
      expect(String(api.getByTestId(`learn-glossary-row-${row.termId}-notes`).props.children)).toContain(row.notes ?? '');
    }
    const renderedStatuses = api.getAllByTestId(/-arabic-status$/)
      .map(node => String(node.props.children))
      .join('\n');
    for (const rawStatus of new Set(statuses.map(row => row.arabicStatus))) {
      expect(renderedStatuses).not.toContain(rawStatus);
    }
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
  });

  it('renders contact lifecycle plus sourced-value verification and notes without provenance labels', () => {
    const api = mount();
    fireEvent.press(api.getByTestId('learn-tab-contacts'));
    const values = LEARN_CONTENT.contacts.flatMap(sourcedValues);
    const verified = values.filter(value => value.verificationStatus !== undefined);
    const noted = values.filter(value => value.note !== undefined);
    const sourceLabels = values
      .map(value => value.sourceLabel)
      .filter((value): value is string => value !== undefined && value.length > 0);

    expect(api.getAllByTestId(/-lifecycle$/)).toHaveLength(LEARN_CONTENT.contacts.length);
    expect(api.getAllByTestId(/-verification$/)).toHaveLength(verified.length);
    expect(api.getAllByTestId(/-note$/)).toHaveLength(noted.length);
    const rendered = allText(api);
    const renderedStatuses = [
      ...api.getAllByTestId(/-lifecycle$/),
      ...api.getAllByTestId(/-verification$/),
    ].map(node => String(node.props.children)).join('\n');
    for (const rawStatus of new Set([
      ...LEARN_CONTENT.contacts.map(row => row.lifecycleStatus),
      ...verified.map(value => value.verificationStatus),
    ])) {
      expect(renderedStatuses).not.toContain(rawStatus);
    }
    for (const label of sourceLabels) {
      expect(rendered).not.toContain(label);
    }
  });
});
