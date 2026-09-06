/**
 * MERCHANT RADAR ON THE RENDERED SURFACE — chips, search, aliases and the honest no.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CheckInputScreen, type CheckInputDraft } from '../CheckInputScreen';
import { MerchantRadar } from '../MerchantRadar';
import { merchantAdvice } from '../../../check/merchantRadar';
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

const QUICK = [
  'merch:shufersal',
  'merch:carrefour',
  'merch:rami-levy-stores',
  'merch:super-pharm',
  'merch:sonol',
];

describe('merchant radar surface', () => {
  beforeEach(() => {
    act(() => { useLanguageStore.getState().setLanguageChoice('he'); });
  });

  it('offers the five checkout chips, each resolving to a canonical merchant', () => {
    const tree = render(wrap(<CheckInputScreen />));
    expect(tree.getByTestId('merchant-radar')).toBeTruthy();
    for (const merchantId of QUICK) {
      expect(tree.getByTestId(`merchant-radar-chip-${merchantId}`)).toBeTruthy();
    }
  });

  it('searches by a Hebrew alias and by an Arabic name', () => {
    const tree = render(wrap(<CheckInputScreen />));
    fireEvent.changeText(tree.getByTestId('merchant-radar-search'), 'קרפור');
    expect(tree.getByTestId('merchant-radar-result-merch:carrefour')).toBeTruthy();

    fireEvent.changeText(tree.getByTestId('merchant-radar-search'), 'سونول');
    expect(tree.getByTestId('merchant-radar-result-merch:sonol')).toBeTruthy();
  });

  it('says so when nothing matches, rather than showing the nearest shop', () => {
    const tree = render(wrap(<CheckInputScreen />));
    fireEvent.changeText(tree.getByTestId('merchant-radar-search'), 'חנות שלא קיימת בשום מאגר');
    expect(tree.getByTestId('merchant-radar-no-match')).toBeTruthy();
    expect(tree.queryAllByTestId(/^merchant-radar-result-/)).toHaveLength(0);
  });

  it('carries the chosen merchant into the draft as a canonical id', () => {
    const drafts: CheckInputDraft[] = [];
    const tree = render(wrap(<CheckInputScreen onCheck={(d): void => { drafts.push(d); }} />));
    fireEvent.press(tree.getByTestId('merchant-radar-chip-merch:sonol'));
    fireEvent.changeText(tree.getByTestId('check-input-amount'), '250');
    fireEvent.press(tree.getByTestId('check-input-submit'));
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.merchantId).toBe('merch:sonol');
  });

  it('leaves the merchant null when the user never picks one', () => {
    const drafts: CheckInputDraft[] = [];
    const tree = render(wrap(<CheckInputScreen onCheck={(d): void => { drafts.push(d); }} />));
    fireEvent.changeText(tree.getByTestId('check-input-amount'), '250');
    fireEvent.press(tree.getByTestId('check-input-submit'));
    expect(drafts[0]?.merchantId).toBeNull();
  });

  it('renders the honest absence for a merchant the corpus links to nothing', () => {
    const tree = render(
      wrap(
        <MerchantRadar
          advice={merchantAdvice('merch:shufersal', [])}
          onSelect={(): void => { /* selection is the caller's */ }}
          selectedMerchantId="merch:shufersal"
        />,
      ),
    );
    expect(tree.getByTestId('merchant-radar-answer-absent')).toBeTruthy();
    expect(tree.queryByTestId('merchant-radar-answer-verified')).toBeNull();
    const reason = tree.getByTestId('merchant-radar-absent-reason');
    expect(JSON.stringify(reason.props.children)).toContain('לא נמצאה במאגר');
  });

  it('distinguishes "the record names no card" from "the corpus records nothing"', () => {
    const tree = render(
      wrap(
        <MerchantRadar
          advice={merchantAdvice('merch:super-pharm', [])}
          onSelect={(): void => { /* selection is the caller's */ }}
          selectedMerchantId="merch:super-pharm"
        />,
      ),
    );
    const reason = JSON.stringify(tree.getByTestId('merchant-radar-absent-reason').props.children);
    expect(reason).toContain('אינה משויכת לאף כרטיס');
  });

  it('lets the user swap the merchant back out', () => {
    const chosen: (string | null)[] = [];
    const tree = render(
      wrap(
        <MerchantRadar
          advice={null}
          onSelect={(id): void => { chosen.push(id); }}
          selectedMerchantId="merch:sonol"
        />,
      ),
    );
    fireEvent.press(tree.getByTestId('merchant-radar-clear'));
    expect(chosen).toEqual([null]);
  });

  it('shows recent merchants ahead of the Owner’s chips, without repeating one', () => {
    const tree = render(
      wrap(
        <MerchantRadar
          advice={null}
          onSelect={(): void => { /* not exercised here */ }}
          recentMerchantIds={['merch:sonol', 'merch:7-eleven']}
          selectedMerchantId={null}
        />,
      ),
    );
    expect(tree.getByTestId('merchant-radar-chip-merch:7-eleven')).toBeTruthy();
    /* Sonol is both recent and an Owner chip; it must appear once. */
    expect(tree.queryAllByTestId('merchant-radar-chip-merch:sonol')).toHaveLength(1);
  });

  it('names merchants in the reader’s language', () => {
    act(() => { useLanguageStore.getState().setLanguageChoice('ar'); });
    const tree = render(wrap(<CheckInputScreen />));
    const chip = tree.getByTestId('merchant-radar-chip-merch:carrefour');
    expect(String(chip.props.accessibilityLabel)).toBe('كارفور');

    act(() => { useLanguageStore.getState().setLanguageChoice('en'); });
    const en = render(wrap(<CheckInputScreen />));
    expect(String(en.getByTestId('merchant-radar-chip-merch:carrefour').props.accessibilityLabel))
      .toBe('Carrefour');
  });
});
