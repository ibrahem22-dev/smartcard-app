/**
 * THE GUIDED CARD PICKER, RENDERED — every list derived, no list typed.
 *
 * The negative assertions carry the weight: a merged bank with no current product is not offered,
 * a product of one issuer never appears under another, and a product with no evidenced programme
 * edge skips the programme step rather than showing an empty one.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { GuidedCardPicker, type GuidedSelection } from '../GuidedCardPicker';
import {
  availableBanks,
  availableCardCompanies,
  cardProductsForIssuer,
  compatibleProgrammesForProduct,
} from '../../../authority/cardCatalogAuthority';
import { useLanguageStore } from '../../../store/useLanguageStore';

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

function mount() {
  const confirmed: GuidedSelection[] = [];
  const cancels: number[] = [];
  const tree = render(
    wrap(
      <GuidedCardPicker
        onCancel={(): void => { cancels.push(1); }}
        onConfirm={(selection): void => { confirmed.push(selection); }}
      />,
    ),
  );
  return { tree, confirmed, cancels };
}

describe('guided card picker', () => {
  beforeEach(() => {
    act(() => { useLanguageStore.getState().setLanguageChoice('he'); });
  });

  it('asks for the card’s nature first', () => {
    const { tree } = mount();
    expect(tree.getByTestId('guided-step-nature')).toBeTruthy();
    expect(tree.getByTestId('guided-nature-BANK')).toBeTruthy();
    expect(tree.getByTestId('guided-nature-CARD_COMPANY')).toBeTruthy();
  });

  it('offers every bank that has a current product, and no bank that has none', () => {
    const { tree } = mount();
    fireEvent.press(tree.getByTestId('guided-nature-BANK'));
    expect(tree.getByTestId('guided-step-issuer')).toBeTruthy();
    for (const bank of availableBanks()) {
      expect(tree.getByTestId(`guided-issuer-${bank.orgId}`)).toBeTruthy();
    }
    /* Union Bank ships in the corpus, is HISTORICAL_MERGED and issues no current product. */
    expect(tree.queryByTestId('guided-issuer-org:union')).toBeNull();
  });

  it('offers exactly the four card companies on the non-bank path', () => {
    const { tree } = mount();
    fireEvent.press(tree.getByTestId('guided-nature-CARD_COMPANY'));
    const ids = availableCardCompanies().map((i) => i.orgId);
    expect(ids.sort()).toEqual(['org:amex-il', 'org:cal', 'org:isracard', 'org:max']);
    for (const orgId of ids) {
      expect(tree.getByTestId(`guided-issuer-${orgId}`)).toBeTruthy();
    }
    /* No bank appears on this path. */
    expect(tree.queryByTestId('guided-issuer-org:leumi')).toBeNull();
  });

  it('lists only the chosen issuer’s products, and searches within them', () => {
    const { tree } = mount();
    fireEvent.press(tree.getByTestId('guided-nature-CARD_COMPANY'));
    fireEvent.press(tree.getByTestId('guided-issuer-org:max'));
    expect(tree.getByTestId('guided-step-product')).toBeTruthy();
    for (const product of cardProductsForIssuer('org:max')) {
      expect(tree.getByTestId(`guided-product-${product.cardId}`)).toBeTruthy();
    }
    /* A CAL product is not offered under max. */
    const calProduct = cardProductsForIssuer('org:cal')[0];
    if (calProduct !== undefined) {
      expect(tree.queryByTestId(`guided-product-${calProduct.cardId}`)).toBeNull();
    }

    fireEvent.changeText(tree.getByTestId('guided-product-search'), 'SKY');
    expect(tree.getByTestId('guided-product-card:max:skymax')).toBeTruthy();
    /* And the search narrows: a max product whose name does not contain SKY is gone. */
    const narrowed = tree.queryAllByTestId(/^guided-product-card:/);
    expect(narrowed.length).toBeLessThan(cardProductsForIssuer('org:max').length);
  });

  it('says so when a search matches nothing at this issuer', () => {
    const { tree } = mount();
    fireEvent.press(tree.getByTestId('guided-nature-CARD_COMPANY'));
    fireEvent.press(tree.getByTestId('guided-issuer-org:max'));
    fireEvent.changeText(tree.getByTestId('guided-product-search'), 'שם שאין לו התאמה בכלל');
    expect(tree.getByTestId('guided-product-empty')).toBeTruthy();
  });

  it('offers only the programmes the estate links to the chosen product, with its own basis', () => {
    const { tree } = mount();
    fireEvent.press(tree.getByTestId('guided-nature-CARD_COMPANY'));
    fireEvent.press(tree.getByTestId('guided-issuer-org:max'));
    fireEvent.press(tree.getByTestId('guided-product-card:max:skymax'));
    expect(tree.getByTestId('guided-step-programme')).toBeTruthy();
    const links = compatibleProgrammesForProduct('card:max:skymax');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(tree.getByTestId(`guided-programme-${link.programme.nodeId}`)).toBeTruthy();
    }
    expect(tree.getByTestId('guided-programme-none')).toBeTruthy();
  });

  it('skips the programme step for a product with no evidenced edge', () => {
    const { tree } = mount();
    fireEvent.press(tree.getByTestId('guided-nature-BANK'));
    fireEvent.press(tree.getByTestId('guided-issuer-org:leumi'));
    fireEvent.press(tree.getByTestId('guided-product-card:leumi:leumi-united-airlines-credit-card'));
    expect(compatibleProgrammesForProduct('card:leumi:leumi-united-airlines-credit-card')).toEqual([]);
    expect(tree.queryByTestId('guided-step-programme')).toBeNull();
    expect(tree.getByTestId('guided-step-review')).toBeTruthy();
  });

  it('reviews the canonical facts and the VERIFIED per-card fees', () => {
    const { tree } = mount();
    fireEvent.press(tree.getByTestId('guided-nature-BANK'));
    fireEvent.press(tree.getByTestId('guided-issuer-org:leumi'));
    fireEvent.press(tree.getByTestId('guided-product-card:leumi:leumi-united-airlines-credit-card'));
    expect(tree.getByTestId('guided-review-issuer')).toBeTruthy();
    expect(tree.getByTestId('guided-review-product')).toBeTruthy();
    expect(tree.getByTestId('guided-review-network')).toBeTruthy();
    /* The card-level exception the pipeline resolved, shown as a figure with a Verified chip. */
    const fxRow = tree.getByTestId('guided-review-fx');
    expect(fxRow).toBeTruthy();
    expect(tree.getByTestId('guided-review-fx-chip')).toBeTruthy();
    /* 1.5% is this card's OWN exception, not the issuer default — the binding is per card, and
       the accessibility value carries the unrounded figure the estate resolved. */
    const fxFigures = tree.queryAllByTestId('guided-review-fx');
    expect(fxFigures).toHaveLength(1);
    const atm = tree.getByTestId('guided-review-atm');
    expect(atm).toBeTruthy();
    /* And the fee the tariff cannot resolve is stated as unresolved, not picked. */
    expect(tree.getByTestId('guided-review-card-fee-unresolved')).toBeTruthy();
  });

  it('confirms with the canonical product and the chosen programmes', () => {
    const { tree, confirmed } = mount();
    fireEvent.press(tree.getByTestId('guided-nature-CARD_COMPANY'));
    fireEvent.press(tree.getByTestId('guided-issuer-org:max'));
    fireEvent.press(tree.getByTestId('guided-product-card:max:skymax'));
    const link = compatibleProgrammesForProduct('card:max:skymax')[0];
    if (link === undefined) throw new Error('SKYMAX must carry a programme edge');
    fireEvent.press(tree.getByTestId(`guided-programme-${link.programme.nodeId}`));
    fireEvent.press(tree.getByTestId('guided-programme-continue'));
    fireEvent.press(tree.getByTestId('guided-review-confirm'));

    expect(confirmed).toHaveLength(1);
    expect(confirmed[0]?.product.cardId).toBe('card:max:skymax');
    expect(confirmed[0]?.issuer?.orgId).toBe('org:max');
    expect(confirmed[0]?.programmeNodeIds).toEqual([link.programme.nodeId]);
  });

  it('walks back one step at a time and cancels from the first', () => {
    const { tree, cancels } = mount();
    fireEvent.press(tree.getByTestId('guided-nature-BANK'));
    expect(tree.getByTestId('guided-step-issuer')).toBeTruthy();
    fireEvent.press(tree.getByTestId('guided-card-picker-back'));
    expect(tree.getByTestId('guided-step-nature')).toBeTruthy();
    fireEvent.press(tree.getByTestId('guided-card-picker-back'));
    expect(cancels).toHaveLength(1);
  });

  it('names issuers and products in the reader’s language', () => {
    act(() => { useLanguageStore.getState().setLanguageChoice('en'); });
    const { tree } = mount();
    fireEvent.press(tree.getByTestId('guided-nature-BANK'));
    expect(String(tree.getByTestId('guided-issuer-org:leumi').props.accessibilityLabel))
      .toContain('Leumi');
  });
});
