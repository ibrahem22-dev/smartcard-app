import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';

import { useLanguageStore } from '../../../store/useLanguageStore';
import { evaluateSurfaceEngines, type SurfaceContext } from '../../../surfaces';
import { safeToCommitFrom } from '../../../surfaces/safeToCommit';
import { HomeHero } from '../HomeHero';

const context = (monthlyIncome: number): SurfaceContext => ({
  asOfDate: '2026-08-28',
  throughDate: '2026-09-28',
  profile: {
    id: 'profile:home-hero',
    monthlyIncome,
    createdAt: 1,
    updatedAt: 1,
  },
  cards: [],
  installments: [{
    installmentId: 'installment:home-hero',
    merchantName: 'Fixture store',
    totalAmount: 9_000,
    monthsRemaining: 5,
    monthlyPayment: 1_800,
    billingCardId: 'card:not-required-for-total',
    source: 'imported',
  }],
  loans: [],
  purchases: [],
});

function renderedAmount(tree: ReturnType<typeof render>): number {
  return Number(tree.getByTestId('home-hero-amount').props.accessibilityValue?.text);
}

describe('Home Safe to commit hero', () => {
  beforeEach(() => {
    useLanguageStore.setState({ languageChoice: 'en', resolvedLanguage: 'en' });
  });

  it('renders the amount the seam derived', () => {
    const ctx = context(13_700);
    const derived = safeToCommitFrom(evaluateSurfaceEngines(ctx));
    if (derived === null) throw new Error('the hero fixture must produce a safe-to-commit result');

    const tree = render(<HomeHero context={ctx} />);

    expect(renderedAmount(tree)).toBe(derived.amountIls);
  });

  it('renders an Estimate chip', () => {
    const tree = render(<HomeHero context={context(13_700)} />);

    expect(within(tree.getByTestId('home-hero-chip')).getByText('Estimate')).toBeTruthy();
    expect(within(tree.getByTestId('home-hero-chip')).getByText('From your data')).toBeTruthy();
  });

  it('cannot render a Verified chip', () => {
    const tree = render(<HomeHero context={context(13_700)} />);

    expect(within(tree.getByTestId('home-hero-chip')).queryByText('Verified')).toBeNull();
  });

  it('explains what the number is made of when tapped', () => {
    const tree = render(<HomeHero context={context(13_700)} />);
    expect(tree.queryByTestId('home-hero-explanation')).toBeNull();

    fireEvent.press(tree.getByTestId('home-hero-explain'));

    const explanation = tree.getByTestId('home-hero-explanation');
    const explanationText = String(explanation.props.children);
    expect(explanationText).toContain('Income');
    expect(explanationText).toContain('obligations');
    expect(explanationText).toContain('buffer');
    expect(explanationText).toContain('profile');
    expect(explanationText).toContain('load engine');
    expect(explanationText).toContain('app configuration');
  });

  it('says what is missing when income is unknown', () => {
    const tree = render(<HomeHero context={context(0)} />);

    expect(String(tree.getByTestId('home-hero-absent').props.children)).toContain(
      'monthly income',
    );
  });

  it('renders no figure when income is unknown', () => {
    const tree = render(<HomeHero context={context(0)} />);

    expect(tree.queryByTestId('home-hero-amount')).toBeNull();
  });
});
