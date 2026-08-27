/**
 * D4's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 * Spec §9: recommendation hero is Card Tile + "Best for this purchase"; Match
 * Score is a small secondary chip with a how-scores-work explainer — never a
 * bare hero number. The painted score is `scoreCards` output (the N1 engine),
 * not a rank computed in the screen.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CheckVerdictScreen } from '../CheckVerdictScreen';
import { runPurchaseCheck } from '../../../check/runPurchaseCheck';
import type { CheckInputDraft } from '../CheckInputScreen';
import { scoreCards } from '../../../engines/scoring';
import { Currency } from '../../../types/purchase.types';

const NAMES: { readonly [cardId: string]: string } = {
  best: 'Max',
  middle: 'Club',
  worst: 'Basic',
};

const scored = scoreCards({
  cards: [
    { cardId: 'middle', available: true, costIls: { value: 110, provenance: 'VERIFIED' } },
    { cardId: 'best', available: true, costIls: { value: 100, provenance: 'VERIFIED' } },
    { cardId: 'worst', available: true, costIls: { value: 120, provenance: 'VERIFIED' } },
  ],
});

const best = scored.ranked[0];
if (best === undefined) {
  throw new Error('scoreCards returned no ranked card — D4 has nothing honest to paint');
}

const draft: CheckInputDraft = {
  amount: 1_500,
  currency: Currency.ILS,
  category: null,
  installments: null,
  cardId: null,
};

const result = runPurchaseCheck(draft, {
  monthlyIncomeIls: { value: 10_000, provenance: 'USER' },
  commitments: [{ commitmentId: 'rent', monthlyAmountIls: { value: 2_000, provenance: 'USER' } }],
});

const classOf = (node: { props?: { className?: string } }): string => String(node.props?.className ?? '');

const HERO_SIZE = /\btext-lg\b/;
const CHIP_SIZE = /\btext-xs\b/;
const HERO_FORBIDDEN_ON_CHIP = /\btext-(lg|xl|2xl|3xl|4xl|5xl)\b/;

const mount = (withRecommendation: boolean) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      {withRecommendation ? (
        <CheckVerdictScreen
          result={result}
          recommendation={{
            displayName: NAMES[best.cardId] ?? best.cardId,
            matchScore: best.score,
          }}
        />
      ) : (
        <CheckVerdictScreen result={result} />
      )}
    </SafeAreaProvider>,
  );

describe('Check Verdict — D4: Match Score demoted', () => {
  it("Match Score paints the scoring engine's number, not a surface recomputation", () => {
    expect(best.cardId).toBe('best');
    expect(best.score.value).toBe(100);
    const { getByTestId } = mount(true);
    expect(getByTestId('check-verdict-match-score-value').props.accessibilityValue?.text).toBe(
      String(best.score.value),
    );
  });

  it('Match Score renders as a small secondary chip, never as the hero', () => {
    const { getByTestId } = mount(true);
    const chip = classOf(getByTestId('check-verdict-match-score-value'));
    const hero = classOf(getByTestId('check-verdict-recommendation-hero'));
    expect(chip).toMatch(CHIP_SIZE);
    expect(chip).not.toMatch(HERO_FORBIDDEN_ON_CHIP);
    expect(hero).toMatch(HERO_SIZE);
    const heroWord = String(getByTestId('check-verdict-recommendation-hero').props.children);
    expect(heroWord).not.toBe(String(best.score.value));
    expect(heroWord).not.toBe(String(best.score.value.toFixed(0)));
  });

  it('the chip carries a how-scores-work explainer', () => {
    const { getByTestId } = mount(true);
    const title = String(getByTestId('check-verdict-match-score-explainer-title').props.children);
    const body = String(getByTestId('check-verdict-match-score-explainer').props.children);
    expect(title.length).toBeGreaterThan(0);
    expect(body.length).toBeGreaterThan(20);
    expect(body).not.toBe(String(best.score.value));
  });

  it('the recommendation hero is Best for this purchase plus the card name, not the score', () => {
    const { getByTestId } = mount(true);
    const hero = String(getByTestId('check-verdict-recommendation-hero').props.children);
    const tile = String(getByTestId('check-verdict-recommendation-tile').props.children);
    expect(hero.length).toBeGreaterThan(0);
    expect(tile).toBe('Max');
    expect(tile).not.toBe(String(best.score.value));
    expect(hero).not.toMatch(/^\d+(\.\d+)?$/);
  });

  it('omitting the recommendation omits Match Score rather than inventing one', () => {
    const { queryByTestId } = mount(false);
    expect(queryByTestId('check-verdict-match-score')).toBeNull();
    expect(queryByTestId('check-verdict-recommendation')).toBeNull();
  });
});
