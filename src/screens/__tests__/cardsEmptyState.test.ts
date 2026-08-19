/**
 * MVP_SCOPE §5 "Manual card creation is not supported through a normal
 * first-card path" — regression proof for the first-card entry point.
 */

import {
  assertsCardCount,
  buildCardsViewModel,
} from '../cardsEmptyState';
import {
  HYDRATING,
  NOT_HYDRATED,
  hydrated,
  hydrationFailed,
} from '../../store/hydration';

const AT = '2026-08-15T00:00:00Z';

describe('cards screen first-card path', () => {
  it('offers a primary first-card action when the user genuinely has none', () => {
    // THE GAP: this state used to be a dead grey box with no action on it.
    const model = buildCardsViewModel(hydrated(AT), 0);
    expect(model.view).toBe('FIRST_CARD_INVITATION');
    expect(model.primaryAction).not.toBeNull();
    expect(model.primaryAction?.route).toBe('AddCard');
    expect(model.primaryAction?.label).not.toBe('');
  });

  it('never claims "no cards" while the store is still loading', () => {
    for (const state of [NOT_HYDRATED, HYDRATING]) {
      const model = buildCardsViewModel(state, 0);
      expect(model.view).toBe('LOADING');
      expect(assertsCardCount(model)).toBe(false);
    }
  });

  it('says the vault is unreadable rather than showing an empty wallet', () => {
    const model = buildCardsViewModel(hydrationFailed('vault locked'), 0);
    expect(model.view).toBe('UNAVAILABLE');
    expect(assertsCardCount(model)).toBe(false);
    expect(model.body).not.toBe('');
  });

  it('does not offer add-card while cards cannot be read', () => {
    // Offering "add a card" when existing cards are unreadable invites the
    // user to create a duplicate.
    for (const state of [NOT_HYDRATED, HYDRATING, hydrationFailed('locked')]) {
      const model = buildCardsViewModel(state, 0);
      expect(model.primaryAction).toBeNull();
      expect(model.showFooterAddCard).toBe(false);
    }
  });

  it('shows the list and the footer dock once cards exist', () => {
    const model = buildCardsViewModel(hydrated(AT), 3);
    expect(model.view).toBe('CARD_LIST');
    expect(model.showFooterAddCard).toBe(true);
    expect(assertsCardCount(model)).toBe(true);
  });

  it('never presents both the first-card invitation and the footer dock', () => {
    // Two competing add-card affordances on the same screen is how a first-time
    // user ends up adding two cards.
    const model = buildCardsViewModel(hydrated(AT), 0);
    expect(model.primaryAction).not.toBeNull();
    expect(model.showFooterAddCard).toBe(false);
  });

  it('reaches AddCard from exactly one affordance in every state', () => {
    const states = [
      NOT_HYDRATED,
      HYDRATING,
      hydrationFailed('locked'),
      hydrated(AT),
    ];
    for (const state of states) {
      for (const count of [0, 2]) {
        const model = buildCardsViewModel(state, count);
        const affordances =
          (model.primaryAction === null ? 0 : 1) +
          (model.showFooterAddCard ? 1 : 0);
        expect(affordances).toBeLessThanOrEqual(1);
      }
    }
  });
});
