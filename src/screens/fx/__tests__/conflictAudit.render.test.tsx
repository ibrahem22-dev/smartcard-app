import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { PackConflict } from '@smartcard/data-authority-adapter';

import { numericConflictAuthorityFromPack } from '../../../authority/packConflict';
import { runPurchaseCheck } from '../../../check/runPurchaseCheck';
import { compareAbroad } from '../../../engines/fx';
import { provenanced } from '../../../engines/provenance';
import { keyVault } from '../../../security/keyVault';
import { cardCostOverrideKey } from '../../../store/cardOverrides';
import { CARD_COST_PACK_SET } from '../../../store/cardCostResolution';
import { closePackStore, putPackRow, type PackRow } from '../../../store/packStore';
import { MMKV_KEYS } from '../../../store/keys';
import { CardIssuer, CardNetwork, type EngineCard } from '../../../types/card.types';
import { Currency } from '../../../types/purchase.types';
import { SectionACosts } from '../../cardDna/SectionACosts';
import { CheckVerdictScreen } from '../../check/CheckVerdictScreen';
import { FxCompareSheet } from '../FxCompareSheet';

const catalog = require('../../../data/adapter/packs/catalog/pack.json') as {
  readonly conflicts: readonly PackConflict[];
};

let storedPackRow: PackRow | null = null;
const fakeDb = {
  execSync: (): void => { /* schema creation is outside this render property */ },
  closeSync: (): void => { /* no native handle exists in Jest */ },
  runSync: (_sql: string, params?: readonly unknown[]): void => {
    if (params === undefined || params.length !== 4) return;
    storedPackRow = {
      packSet: String(params[0]),
      key: String(params[1]),
      value: String(params[2]),
      packVersion: String(params[3]),
    };
  },
  getFirstSync: <T,>(_sql: string, params?: readonly unknown[]): T | null => {
    if (storedPackRow === null || params === undefined) return null;
    if (params[0] !== storedPackRow.packSet || params[1] !== storedPackRow.key) return null;
    return {
      pack_set: storedPackRow.packSet,
      key: storedPackRow.key,
      value: storedPackRow.value,
      pack_version: storedPackRow.packVersion,
    } as T;
  },
};

// Native database only: the conflict authority, adapter decision, engine and surfaces stay real.
jest.mock('expo-sqlite', () => ({ openDatabaseSync: (): unknown => fakeDb }));

const valuedRecord = catalog.conflicts.find((record) =>
  record.participants.some((participant) =>
    participant.field === 'FX_COMMISSION_PCT' && typeof participant.value === 'number'));
const valuelessRecord = catalog.conflicts.find((record) =>
  record.participants.every((participant) => participant.value === undefined));
const widestRecord = catalog.conflicts.reduce((widest, record) =>
  record.participants.filter((participant) => typeof participant.value === 'number').length
    > widest.participants.filter((participant) => typeof participant.value === 'number').length
    ? record
    : widest);

if (valuedRecord === undefined || valuelessRecord === undefined) {
  throw new Error('the shipped conflict corpus no longer exercises both valued and valueless plans');
}

const valuedConflict = numericConflictAuthorityFromPack(valuedRecord);
const valuelessConflict = numericConflictAuthorityFromPack(valuelessRecord);
const widestConflict = numericConflictAuthorityFromPack(widestRecord);

const rate = {
  currency: 'EUR',
  quoteUnit: 1,
  rateIlsPerQuoteUnit: 4.02,
  rateDate: '2026-08-24',
  fetchDate: '2026-08-24',
  source: 'BUNDLED',
  provenance: 'ESTIMATE',
  rateBasis: 'BOI_REPRESENTATIVE',
} as const;

const comparisonFor = (cardId: string, conflict: typeof valuedConflict, withKnown = false) =>
  compareAbroad({
    amount: 1_000,
    currency: 'EUR',
    mode: 'purchase',
    rate,
    cards: [
      ...(withKnown ? [{ cardId: 'known-card', fxPercent: 2 }] : []),
      { cardId, conflict },
    ],
  });

const result = runPurchaseCheck({
  amount: 1_500,
  currency: Currency.ILS,
  category: null,
  installments: null,
  cardId: null,
}, {
  monthlyIncomeIls: provenanced(10_000, 'USER'),
  commitments: [],
});

const wrap = (node: React.ReactElement): React.ReactElement => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}
  >
    {node}
  </SafeAreaProvider>
);

function textsInTree(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(textsInTree);
  if (node === null || typeof node !== 'object') return [];
  return textsInTree((node as { readonly children?: unknown }).children);
}

describe('C3 conflict audit — real pack, engine and render path', () => {
  it('a conflicted FX cost reaches Check/Verdict as a conflict, not a number or unknown', () => {
    const comparison = comparisonFor(valuedRecord.conflictId, valuedConflict);
    const tree = render(wrap(<CheckVerdictScreen result={result} fxComparison={comparison} />));

    expect(comparison.conflictedCards.map((card) => card.cardId)).toEqual([valuedRecord.conflictId]);
    expect(comparison.ranked).toEqual([]);
    expect(comparison.unknownCards).toEqual([]);
    expect(tree.getByTestId(`fx-compare-conflict-${valuedRecord.conflictId}`)).toBeTruthy();
    expect(tree.queryByTestId('check-verdict-fx-fee')).toBeNull();
  });

  it('FxCompareSheet renders every valued candidate with its scope and source', () => {
    const tree = render(wrap(
      <FxCompareSheet comparison={comparisonFor(valuedRecord.conflictId, valuedConflict)} />,
    ));
    const painted = textsInTree(
      tree.getByTestId(`fx-compare-conflict-${valuedRecord.conflictId}`),
    ).join(' ');

    for (const candidate of valuedConflict.candidates) {
      expect(painted).toContain(candidate.scope);
      expect(painted).toContain(candidate.sourceId);
      expect(painted).toContain(String(candidate.value));
    }
  });

  it('a valueless shipped conflict renders the disputed mark and invents no value', () => {
    const tree = render(wrap(
      <FxCompareSheet comparison={comparisonFor(valuelessRecord.conflictId, valuelessConflict)} />,
    ));
    const surface = tree.getByTestId(`fx-compare-conflict-${valuelessRecord.conflictId}`);

    expect(textsInTree(surface).join(' ')).toContain(valuelessRecord.conflictId);
    expect(tree.queryByTestId('conflicted-value-candidates')).toBeNull();
    expect(tree.queryByTestId('conflicted-value-candidate-0')).toBeNull();
    expect(valuelessConflict.candidates).toEqual([]);
  });

  it('a conflicted card is absent from ranked and unknownCards', () => {
    const comparison = comparisonFor(valuedRecord.conflictId, valuedConflict, true);

    expect(comparison.ranked.map((entry) => entry.cardId)).toEqual(['known-card']);
    expect(comparison.unknownCards).toEqual([]);
    expect(comparison.conflictedCards.map((card) => card.cardId)).toEqual([valuedRecord.conflictId]);
  });

  it('ordering-dependent saves claims are suppressed when a conflicted card is present', () => {
    const comparison = comparisonFor(valuedRecord.conflictId, valuedConflict, true);
    const tree = render(wrap(
      <CheckVerdictScreen
        fxComparison={comparison}
        result={result}
        runnerUp={{ displayName: 'runner-up', deltaFromBestIls: provenanced(14, 'ESTIMATE') }}
      />,
    ));

    expect(comparison.deltasSuppressed).toBe(true);
    expect(tree.queryByTestId('fx-compare-winner')).toBeNull();
    expect(textsInTree(tree.getByTestId('check-verdict-runner-up')).join(' ')).not.toContain('14');
  });

  it('candidate order is preserved exactly as the shipped participants supplied it', () => {
    const tree = render(wrap(
      <FxCompareSheet comparison={comparisonFor(valuedRecord.conflictId, valuedConflict)} />,
    ));
    const renderedSources = valuedConflict.candidates.map((_, index) =>
      textsInTree(tree.getByTestId(`conflicted-value-candidate-${String(index)}`)).join(' '));

    expect(renderedSources.map((text, index) =>
      text.includes(valuedConflict.candidates[index]?.sourceId ?? ''))).toEqual(
      valuedConflict.candidates.map(() => true),
    );
  });

  it('no candidate is truncated', () => {
    const tree = render(wrap(
      <FxCompareSheet comparison={comparisonFor(widestRecord.conflictId, widestConflict)} />,
    ));

    expect(tree.getAllByTestId(/conflicted-value-candidate-/)).toHaveLength(
      widestConflict.candidates.length,
    );
  });

  it('SectionACosts still renders its conflict through ConflictedValue', () => {
    const card: EngineCard = {
      cardId: 'section-a-regression-card',
      cardProductId: 'section-a-regression-product',
      displayName: 'Section A regression',
      last4: '2468',
      issuer: CardIssuer.Max,
      network: CardNetwork.Visa,
      currency: Currency.ILS,
      framework: { creditLimit: 10_000, currentBalance: 1_000 },
      billingCycle: { statementClosingDay: 5, billingDayOfMonth: 10 },
      roleTags: [],
      primaryRole: null,
      rewardCategories: [],
      cashbackRate: 0,
      foreignTransactionFee: 0,
      supportsInstallments: true,
      annualFee: 250,
      isActive: true,
    };
    const envelope = JSON.stringify({
      kind: 'card-cost-conflict',
      version: 1,
      reason: valuedConflict.reason,
      candidates: valuedConflict.candidates.map((candidate) => ({
        ...candidate,
        value: String(candidate.value),
      })),
    });
    keyVault.getEncryptedStorage().set(MMKV_KEYS.activeProfileId, 'conflict-audit-profile');
    storedPackRow = null;
    closePackStore();
    putPackRow({
      packSet: CARD_COST_PACK_SET,
      key: cardCostOverrideKey(card.cardId, 'fx-commission'),
      value: envelope,
      packVersion: 'shipped-conflict-regression',
    });

    const tree = render(wrap(<SectionACosts card={card} onCompareFx={(): void => undefined} />));
    expect(tree.getByTestId('card-dna-cost-fx-commission-conflict')).toBeTruthy();
    expect(tree.queryByTestId('card-dna-cost-fx-commission-value')).toBeNull();
  });
});
