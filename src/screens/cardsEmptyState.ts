/**
 * MVP_SCOPE §5 — "Manual card creation is not supported through a normal
 * first-card path."
 *
 * The Cards screen rendered `cards.length === 0 ? <dead grey box> : <list>`.
 * Two problems with that for a local-first app whose entire value depends on
 * having a card registered:
 *
 *   1. The empty state was a dead end. A first-time user's most important
 *      moment showed a static "no cards found" panel with no action on it. The
 *      only route to AddCard was a footer dock button that reads as a
 *      secondary action next to an apparently-final statement.
 *   2. `cards.length === 0` ignored hydration, so a user who owned cards was
 *      told they had none while the store was still loading — or while the
 *      vault was locked, when the honest answer is "we cannot read them".
 *
 * This module decides what the screen shows. It is deliberately pure and
 * React-free so it is actually testable: the jest config only matches .test.ts
 * files under __tests__, so logic left inside a .tsx is untested logic.
 */

import {
  classifyCollection,
  type CollectionReadiness,
  type HydrationState,
} from '../store/hydration';

export const CARDS_VIEWS = [
  'LOADING',
  'UNAVAILABLE',
  'FIRST_CARD_INVITATION',
  'CARD_LIST',
] as const;

export type CardsView = (typeof CARDS_VIEWS)[number];

export interface CardsViewModel {
  readonly view: CardsView;
  /** Heading text key/string for the state. */
  readonly title: string;
  /** Supporting copy. Empty string when the view needs none. */
  readonly body: string;
  /**
   * The primary action, when the state has one. `null` for LOADING and
   * UNAVAILABLE — offering "add a card" while we cannot read existing cards
   * invites a duplicate.
   */
  readonly primaryAction: CardsPrimaryAction | null;
  /** True when the footer add-card dock should be shown. */
  readonly showFooterAddCard: boolean;
}

export interface CardsPrimaryAction {
  readonly label: string;
  readonly route: 'AddCard';
  readonly testID: string;
}

const ADD_CARD_ACTION: CardsPrimaryAction = {
  label: 'הוסף את הכרטיס הראשון שלך',
  route: 'AddCard',
  testID: 'cards-first-card-cta',
};

/**
 * Decide the Cards screen state from the store's real lifecycle.
 *
 * Note what is NOT here: a branch that treats an unloaded store as empty.
 * `classifyCollection` makes that impossible to express by accident.
 */
export function buildCardsViewModel(
  hydration: HydrationState,
  cardCount: number,
): CardsViewModel {
  const readiness: CollectionReadiness = classifyCollection(hydration, cardCount);

  switch (readiness) {
    case 'PENDING':
      return {
        view: 'LOADING',
        title: 'טוען את הכרטיסים שלך…',
        body: '',
        primaryAction: null,
        // Hiding the dock prevents adding a duplicate of a card that is about
        // to appear.
        showFooterAddCard: false,
      };
    case 'UNAVAILABLE':
      return {
        view: 'UNAVAILABLE',
        title: 'לא ניתן לקרוא את הכרטיסים',
        body: 'ייתכן שהכספת נעולה. פתח את האפליקציה מחדש כדי לנסות שוב.',
        primaryAction: null,
        showFooterAddCard: false,
      };
    case 'KNOWN_EMPTY':
      // The first-card moment: an invitation with a primary action, not a
      // statement of absence.
      return {
        view: 'FIRST_CARD_INVITATION',
        title: 'בוא נוסיף את הכרטיס הראשון',
        body: 'SmartCard עובד על הכרטיסים שלך בלבד. הכל נשמר מוצפן במכשיר.',
        primaryAction: ADD_CARD_ACTION,
        showFooterAddCard: false,
      };
    case 'KNOWN_POPULATED':
      return {
        view: 'CARD_LIST',
        title: 'הכרטיסים שלי',
        body: 'כל הכרטיסים שנשמרו במכשיר.',
        primaryAction: null,
        showFooterAddCard: true,
      };
    default: {
      const exhaustive: never = readiness;
      throw new Error(`unhandled cards readiness: ${String(exhaustive)}`);
    }
  }
}

/**
 * True when the screen is presenting a definitive statement about how many
 * cards the user has. Used to keep "no cards found" out of loading states.
 */
export function assertsCardCount(model: CardsViewModel): boolean {
  return model.view === 'FIRST_CARD_INVITATION' || model.view === 'CARD_LIST';
}
