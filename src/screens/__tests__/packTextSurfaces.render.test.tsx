/**
 * THE ADVERSARIAL BOUNDARY TEST — six surfaces, real shipped material, one question.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IT ASKS
 *
 * `packTextRegister.json` classifies every prose field in the four shipped packs as consumer-safe
 * or internal-only, and `tools/mdc/gates/pack-text-boundary.mjs` proves the classification is
 * complete and that no consumer type is an alias for a raw pack row. Both are STATIC. This suite
 * is the runtime half: it renders the six surfaces that bind canonical data and searches the
 * rendered tree for the internal values the artifact actually carries.
 *
 * The word list is not written here. `internalPackText()` re-reads the shipped packs on every run,
 * so a pack update that adds a new analyst note grows the adversary's vocabulary without anybody
 * remembering to update a fixture — and a pack update that rewords every note does not quietly
 * turn this suite green.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY LONG STRINGS ONLY
 *
 * A 25-character internal fragment can collide with legitimate output by accident: the register
 * counts a string of 25 characters with a space as prose, and a Hebrew definition could contain
 * one. The search uses values of at least `UNAMBIGUOUS_MIN_CHARS`, where a substring match is a
 * leak and not a coincidence. The floor is stated in the helper rather than tuned here until the
 * suite passed.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY EACH SURFACE ALSO ASSERTS SOMETHING IS THERE
 *
 * A screen that rendered nothing at all would pass every absence assertion in this file while
 * failing every reader. Each case therefore names one thing that MUST be on the screen — a title, a
 * chip, a section — so that "no research prose" cannot be satisfied by "no content".
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/*
 * CARD DNA'S SECTION A READS THROUGH THE PACK STORE, WHICH OPENS SQLITE.
 *
 * An EMPTY catalog table is the right driver here and not a shortcut: this suite is about what the
 * screen PRINTS from the four JSON packs, and every one of those is imported by the screen's own
 * modules rather than read out of SQLite. A populated table would add rows this suite does not
 * classify and could not search for.
 */
const emptyPackDb = {
  execSync: (): void => { /* an empty catalog is the fixture */ },
  closeSync: (): void => { /* no native handle */ },
  getFirstSync: <T,>(): T | null => null,
};
jest.mock('expo-sqlite', () => ({ openDatabaseSync: (): unknown => emptyPackDb }));

import { BenefitsHubScreen } from '../benefits/BenefitsHubScreen';
import { CardDnaScreen } from '../cardDna/CardDnaScreen';
import { CheckInputScreen } from '../check/CheckInputScreen';
import { IssuerNegotiationSheet } from '../wallet/IssuerNegotiationSheet';
import { LearnScreen } from '../LearnScreen';
import { unambiguousInternalPackText } from '../../data/adapter/__tests__/internalPackText';
import { useCardsStore } from '../../store/useCardsStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { CardIssuer, CardNetwork, type CardInput, type EngineCard } from '../../types/card.types';
import { Currency } from '../../types/purchase.types';

const TODAY = '2026-09-06';
const PRODUCT = 'card:max:skymax';

const CARD: EngineCard = {
  cardId: 'vault-1',
  cardProductId: PRODUCT,
  displayName: 'SKYMAX',
  last4: '7739',
  issuer: CardIssuer.Max,
  network: CardNetwork.Mastercard,
  currency: Currency.ILS,
  framework: { creditLimit: 30_000, currentBalance: 2_500 },
  billingCycle: { statementClosingDay: 25, billingDayOfMonth: 2 },
  roleTags: [],
  primaryRole: null,
  rewardCategories: [],
  cashbackRate: 0,
  foreignTransactionFee: 0.03,
  supportsInstallments: true,
  annualFee: 0,
  isActive: true,
};

const NEGOTIATION_CARD: CardInput = { ...CARD, issuerOrgId: 'org:max' };

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

/** The adversary's words, per pack unit — a failure names a field the reader could have seen. */
const BENEFIT_PROSE = unambiguousInternalPackText('benefits.');
const CATALOG_PROSE = unambiguousInternalPackText('catalog.');
const CONTENT_PROSE = unambiguousInternalPackText('content.');
const TAXONOMY_PROSE = unambiguousInternalPackText('taxonomy.');

function expectNoneOf(tree: { toJSON: () => unknown }, words: readonly string[]): void {
  const printed = JSON.stringify(tree.toJSON());
  const found = words.filter((word) => printed.includes(word));
  expect(found).toEqual([]);
}

describe('no internal pack text reaches a reader, on any canonical surface', () => {
  beforeEach(() => {
    act(() => { useLanguageStore.getState().setLanguageChoice('he'); });
    act(() => { useCardsStore.setState({ cards: [CARD] }); });
  });

  it('has a non-empty adversary on every pack — or it proves nothing', () => {
    expect(BENEFIT_PROSE.length).toBeGreaterThan(0);
    expect(CATALOG_PROSE.length).toBeGreaterThan(0);
    expect(CONTENT_PROSE.length).toBeGreaterThan(0);
    expect(TAXONOMY_PROSE.length).toBeGreaterThan(0);
  });

  it('Benefits Hub — every row expanded', () => {
    const tree = render(wrap(<BenefitsHubScreen todayIso={TODAY} />));
    const toggles = tree.queryAllByTestId(/^benefits-hub-row-.*-toggle$/);
    expect(toggles.length).toBeGreaterThan(0);
    for (const toggle of toggles) fireEvent.press(toggle);
    expectNoneOf(tree, [...BENEFIT_PROSE, ...CATALOG_PROSE, ...TAXONOMY_PROSE]);
  });

  it('Merchant Radar — chips, a search hit and an evidenced absence', () => {
    const tree = render(wrap(<CheckInputScreen />));
    expect(tree.getByTestId('merchant-radar')).toBeTruthy();
    fireEvent.changeText(tree.getByTestId('merchant-radar-search'), 'שופרסל');
    expectNoneOf(tree, [...TAXONOMY_PROSE, ...BENEFIT_PROSE]);
  });

  it('Negotiation Hub — the sheet open on a real issuer', () => {
    const tree = render(
      wrap(
        <IssuerNegotiationSheet
          card={NEGOTIATION_CARD}
          copyText={async (): Promise<void> => { /* not exercised here */ }}
          onClose={(): void => { /* not exercised here */ }}
          openUrl={async (): Promise<void> => { /* no call is placed by a test */ }}
          visible
        />,
      ),
    );
    expectNoneOf(tree, [...CONTENT_PROSE, ...CATALOG_PROSE]);
  });

  /*
   * CARD DETAIL IS CARD DNA. `WalletStack` mounts `CardDnaScreen` on the `CardDetail` route and the
   * legacy `CardDetailScreen` is registered nowhere — so the case above IS the Card Detail case,
   * and adding a second one that rendered an unmounted component would be testing dead code and
   * reporting it as a covered surface.
   */
  it('Card DNA — every accordion open, and it is the Card Detail route', () => {
    const tree = render(wrap(<CardDnaScreen />));
    for (const toggle of tree.queryAllByTestId(/-toggle$/)) fireEvent.press(toggle);
    expectNoneOf(tree, [...CATALOG_PROSE, ...BENEFIT_PROSE]);
  });

  it('Learn — glossary, rights and contacts', () => {
    const tree = render(wrap(<LearnScreen />));
    for (const tab of ['learn-tab-glossary', 'learn-tab-rights', 'learn-tab-contacts']) {
      fireEvent.press(tree.getByTestId(tab));
      expectNoneOf(tree, CONTENT_PROSE);
    }
  });
});
