import React from 'react';
import { render, type RenderAPI } from '@testing-library/react-native';

const mockImportedPackRows = new Map<string, string>();
let mockPackStoreFailure: Error | null = null;

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    closeSync: jest.fn(),
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => {
      if (mockPackStoreFailure !== null) throw mockPackStoreFailure;
      return { rowCount: mockImportedPackRows.size };
    }),
    runSync: jest.fn(),
    withTransactionSync: (operation: () => void) => operation(),
  }),
}));

import { DataPrivacyScreen } from '../DataPrivacyScreen';
import {
  ArtifactVersionDisagreementError,
  assertArtifactVersionsAgree,
  readDataPrivacy,
  type CountReading,
} from '../../data/adapter/dataPrivacy';
import { useLanguageStore } from '../../store/useLanguageStore';

const mount = (): RenderAPI => {
  useLanguageStore.setState({ languageChoice: 'en', resolvedLanguage: 'en' });
  return render(<DataPrivacyScreen />);
};

const containing = (value: string | number): RegExp => new RegExp(
  String(value).replace(/[.*+?${}()|[\]\\]/g, '\\$&'),
);

const expectCountReading = (node: ReturnType<RenderAPI['getByTestId']>, reading: CountReading): void => {
  if (reading.status === 'AVAILABLE') {
    expect(node).toHaveTextContent(containing(reading.count));
    return;
  }
  expect(node).toHaveTextContent(containing(reading.reason));
  expect(node).toHaveTextContent(containing('count unavailable'));
};

describe('MDC C7 — Data & Privacy reads manifests and stores at runtime', () => {
  beforeEach(() => {
    mockImportedPackRows.clear();
    mockPackStoreFailure = null;
  });

  it('renders every verified artifact version and manifest figure from the runtime seam', () => {
    const expected = readDataPrivacy();
    const api = mount();

    expect(expected.artifacts.length).toBeGreaterThan(0);
    expect(new Set(expected.artifacts.map(artifact => (
      api.getByTestId(`data-privacy-artifact-${artifact.set}`).props.testID
    ))).size).toBe(expected.artifacts.length);
    for (const artifact of expected.artifacts) {
      const rowId = `data-privacy-artifact-${artifact.set}`;
      expect(api.getByTestId(`${rowId}-version`)).toHaveTextContent(containing(artifact.version));
      expect(api.getByTestId(`${rowId}-dataset-version`)).toHaveTextContent(containing(artifact.datasetVersion));
      expect(api.getByTestId(`${rowId}-format-version`)).toHaveTextContent(containing(artifact.formatVersion));
      expect(api.getByTestId(`${rowId}-generated-at`)).toHaveTextContent(containing(artifact.generatedAt));
      expect(api.getByTestId(`${rowId}-bytes`)).toHaveTextContent(containing(artifact.bytes));
      expect(api.getByTestId(`${rowId}-rows`)).toHaveTextContent(containing(artifact.rowCount));
      expect(api.getByTestId(`${rowId}-min-app-version`)).toHaveTextContent(containing(artifact.minAppVersion));
    }
  });

  it('refuses a version that diverges between manifest and body', () => {
    expect(() => assertArtifactVersionsAgree('test-pack', 'manifest-version', 'body-version'))
      .toThrow(ArtifactVersionDisagreementError);
  });

  it('renders declared freshness and the FX date range without a staleness verdict', () => {
    const expected = readDataPrivacy();
    const api = mount();

    for (const artifact of expected.artifacts) {
      expect(api.getByTestId(`data-privacy-artifact-${artifact.set}-stale-after-days`))
        .toHaveTextContent(containing(artifact.staleAfterDays));
    }
    const fx = expected.artifacts.find(artifact => artifact.kind === 'FX_SNAPSHOT');
    if (fx === undefined) throw new Error('runtime seam returned no FX snapshot');
    const fxId = `data-privacy-artifact-${fx.set}`;
    expect(api.getByTestId(`${fxId}-snapshot-date`)).toHaveTextContent(containing(fx.snapshotDate));
    expect(api.getByTestId(`${fxId}-earliest-rate-date`)).toHaveTextContent(containing(fx.earliestRateDate));
    expect(api.getByTestId(`${fxId}-latest-rate-date`)).toHaveTextContent(containing(fx.latestRateDate));
    expect(api.getByTestId(`${fxId}-accessed-at`)).toHaveTextContent(containing(fx.accessedAt));
    expect(JSON.stringify(api.toJSON())).not.toContain('Stale:');
  });

  it('renders the complete pack-side provenance mix in its distinct vocabulary', () => {
    const expected = readDataPrivacy();
    const api = mount();

    expect(expected.provenanceMix.length).toBeGreaterThan(0);
    expect(api.getAllByTestId(/^data-privacy-provenance-(?:VERIFIED|ESTIMATE|UNKNOWN|CONFLICT)$/))
      .toHaveLength(expected.provenanceMix.length);
    for (const item of expected.provenanceMix) {
      expect(api.getByTestId(`data-privacy-provenance-${item.state}`)).toHaveTextContent(containing(item.count));
    }
    expect(api.getByTestId('data-privacy-provenance')).toHaveTextContent(containing('USER belongs to vault data'));

    // The catalog pack really does carry one chip the contract's vocabulary does not contain.
    // It must be NAMED on the surface, not folded into a neighbouring member and not dropped.
    expect(expected.provenanceOutsideVocabulary.length).toBeGreaterThan(0);
    for (const item of expected.provenanceOutsideVocabulary) {
      expect(expected.provenanceMix.some(member => member.state === item.state)).toBe(false);
      expect(api.getByTestId(`data-privacy-provenance-outside-${item.state}`))
        .toHaveTextContent(containing(item.count));
      expect(api.getByTestId(`data-privacy-provenance-outside-${item.state}`))
        .toHaveTextContent(containing(item.state));
    }
  });

  it('reports bundled JSON separately from the empty SQLite import store', () => {
    const expected = readDataPrivacy();
    const api = mount();

    expect(expected.local.bundledRows).toBe(expected.artifacts.reduce(
      (sum, artifact) => sum + artifact.rowCount,
      mockImportedPackRows.size,
    ));
    expect(api.getByTestId('data-privacy-bundled-rows')).toHaveTextContent(containing(expected.local.bundledRows));
    expect(expected.local.importedPackRows).toEqual({
      status: 'AVAILABLE',
      count: mockImportedPackRows.size,
    });
    expect(api.getByTestId('data-privacy-imported-rows')).toHaveTextContent(containing(mockImportedPackRows.size));
    expect(api.getByTestId('data-privacy-empty-pack-store-explanation'))
      .toHaveTextContent(containing('no production path imports into it yet'));
  });

  it('reports all three stores and renders a failed store read as unavailable rather than zero', () => {
    const available = readDataPrivacy();
    const api = mount();
    expectCountReading(api.getByTestId('data-privacy-vault-keys'), available.local.encryptedVaultKeys);
    expectCountReading(api.getByTestId('data-privacy-preference-keys'), available.local.preferenceKeys);
    expectCountReading(api.getByTestId('data-privacy-imported-rows'), available.local.importedPackRows);

    mockPackStoreFailure = new Error('pack store unavailable for the runtime test');
    const unavailable = readDataPrivacy();
    const failedApi = mount();
    expect(unavailable.local.importedPackRows.status).toBe('UNAVAILABLE');
    expectCountReading(failedApi.getByTestId('data-privacy-imported-rows'), unavailable.local.importedPackRows);
    expect(failedApi.getByTestId('data-privacy-imported-rows'))
      .not.toHaveTextContent(containing(`: ${mockImportedPackRows.size}`));
    expect(failedApi.queryByTestId('data-privacy-empty-pack-store-explanation')).toBeNull();
  });
});
