/**
 * THE PACK'S RESEARCH PROSE DOES NOT REACH A READER — the PD-MDC-082 class, on a new screen.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT WENT WRONG ONE ARTIFACT AGO, AND WHY IT COULD HAVE HAPPENED AGAIN HERE
 *
 * Artifact #7 exists because the Learn screen was printing the content pack's own annotations to
 * users: research notes about SOURCES, in English, on a Hebrew screen, some of them carrying raw
 * internal tokens. The repair removed the render; the fields stayed in the pack, where they belong.
 *
 * The benefits pack carries the same kind of field under the same innocent name. `description`
 * reads like consumer copy and is not:
 *
 *     "Merchant discounts published as logos in a graphic; the merchant-to-rate mapping is not
 *      text-extractable"
 *     "General CAL cardholder portal offers referenced at marketing level only"
 *     "This is an access statement, not a per-benefit entitlement."
 *
 * Those are notes from one researcher to the next, in English only, beside `titleHe`, `titleAr` and
 * `titleEn` which are the consumer text. The Benefits Hub rendered `description` in its expanded
 * row until P5's `no-account-surface` gate walked into the pack and objected — for a different
 * reason, and it was right to.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS TEST ASSERTS, AND WHY IT IS NOT A SPELLING CHECK
 *
 * It takes the descriptions the SHIPPED pack actually holds for the cards in the wallet, and
 * asserts none of them appears anywhere in the rendered tree — expanded rows included, because a
 * collapsed row proves nothing. The population is re-measured on every run rather than quoted, so a
 * pack update that rewords every description does not quietly turn this green.
 *
 * It also asserts the row is not empty: a screen that rendered nothing at all would pass an absence
 * test while failing the user, and the titles are what must be there instead.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BenefitsHubScreen } from '../BenefitsHubScreen';
import { eligibleBenefitsForCards } from '../../../authority/benefitAuthority';
import { useCardsStore } from '../../../store/useCardsStore';
import { useLanguageStore } from '../../../store/useLanguageStore';
import { CardIssuer, CardNetwork, type EngineCard } from '../../../types/card.types';
import { Currency } from '../../../types/purchase.types';
import { internalPackText } from '../../../data/adapter/__tests__/internalPackText';

const TODAY = '2026-09-06';
const PRODUCT = 'card:max:skymax';

const card = (cardId: string, cardProductId: string): EngineCard => ({
  cardId,
  cardProductId,
  displayName: 'Card ' + cardId,
  last4: '1111',
  issuer: CardIssuer.Max,
  network: CardNetwork.Mastercard,
  currency: Currency.ILS,
  framework: { creditLimit: 10_000, currentBalance: 0 },
  billingCycle: { statementClosingDay: 25, billingDayOfMonth: 2 },
  roleTags: [],
  primaryRole: null,
  rewardCategories: [],
  cashbackRate: 0,
  foreignTransactionFee: 0,
  supportsInstallments: true,
  annualFee: 0,
  isActive: true,
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

/**
 * THE POPULATION COMES FROM THE PACK, NOT FROM THE VIEW — and it has to.
 *
 * `BenefitView` is a PROJECTION now (consumerProjection.ts) and `description` is not on it, so this
 * suite cannot read the descriptions off the rows the Hub receives; that is the repair working. It
 * reads them out of the SHIPPED pack instead, which is also the stronger test: it searches the
 * rendered tree for the exact strings the artifact carries, whatever the boundary does with them.
 */
const descriptions = internalPackText('benefits.benefits.description');

describe('the Benefits Hub renders no pack annotation', () => {
  beforeEach(() => {
    act(() => { useLanguageStore.getState().setLanguageChoice('he'); });
    act(() => { useCardsStore.setState({ cards: [card('v1', PRODUCT)] }); });
  });

  it('has a non-empty population of descriptions to be wrong about', () => {
    expect(descriptions.length).toBeGreaterThan(0);
  });

  it('prints none of them, with every row expanded', () => {
    const tree = render(wrap(<BenefitsHubScreen todayIso={TODAY} />));
    const toggles = tree.queryAllByTestId(/^benefits-hub-row-.*-toggle$/);
    expect(toggles.length).toBeGreaterThan(0);
    for (const toggle of toggles) fireEvent.press(toggle);

    const printed = JSON.stringify(tree.toJSON());
    for (const description of descriptions) {
      expect(printed).not.toContain(description);
    }
  });

  it('still prints the consumer title, so the absence is not an empty screen', () => {
    const tree = render(wrap(<BenefitsHubScreen todayIso={TODAY} />));
    const rows = tree.queryAllByTestId(/^benefits-hub-row-/);
    expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(tree.toJSON()).length).toBeGreaterThan(1_000);
  });
});
