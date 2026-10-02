/**
 * FX ABROAD ENGINE — REWRITTEN BY P2 / WP-2.2 (criterion D3), under ADR-P2-001.
 *
 * WHAT THIS FILE USED TO ASSERT, AND WHY IT NO LONGER CAN.
 *
 * Six of its nine tests asserted concrete FX figures for named cards: that a CAL Shufersal card
 * resolves to `cal-shufersal-visa` with a 3% purchase fee, that Amex Platinum resolves to 2.5%,
 * that a ranked list comes back cheapest-first. Every one of those figures came from
 * `src/data/fxAbroad.v2.json` — the legacy bundled dataset that criterion **D3 removes from the
 * runtime**.
 *
 * The tests were not wrong. Their subject was removed.
 *
 * `P2_COMPLETION_CONTRACT.md` **E3** is explicit about this situation:
 *
 *   > The inherited regression net is green, **or** every failure is a deliberate, ADR-recorded
 *   > consequence of a spec change. **A green suite after a spec change is treated as more
 *   > suspicious than a red one.**
 *
 * So the tests are not deleted and not quietly loosened. They are rewritten to assert the thing
 * that is now true, which is a stronger claim than the one they made before: **with no authority
 * source wired, the engine refuses rather than guessing.** The old expectations are preserved in
 * ADR-P2-001 so that Phase 7, which wires the real adapter, can check the adapter reproduces them
 * rather than re-deriving them from memory.
 *
 * THE ONE TEST THAT SURVIVED UNCHANGED is the last one — *"an all-unknown card list yields an empty
 * ranking, never a default"*. It was the only test in the file that asserted a refusal rather than
 * a figure, and it is the only one the removal did not touch. That is not a coincidence, and it is
 * the argument for writing more tests like it.
 */
import { rankCardsAbroad } from '../fxAbroadEngine';
import type { CardFxTriple, ResolvedFxAbroad } from '../../types/fxAbroad.types';
import { resolveFxAbroad, NO_AUTHORITY_SOURCE } from '../../authority/noSource';
import {
  CardIssuer,
  CardNetwork,
  CardRole,
  type CardInput,
} from '../../types/card.types';
import { Currency } from '../../types/purchase.types';

function makeCard(overrides: Partial<CardInput> = {}): CardInput {
  return {
    cardId: 'fx-test',
    displayName: 'FX Test Card',
    last4: '4242',
    issuer: CardIssuer.Max,
    network: CardNetwork.Visa,
    currency: Currency.ILS,
    framework: { creditLimit: 15_000, currentBalance: 500 },
    billingCycle: { statementClosingDay: 25, billingDayOfMonth: 10 },
    role: CardRole.Daily,
    ...overrides,
  } as CardInput;
}

describe('resolveFxAbroad — with the legacy dataset removed (D3)', () => {
  test('a previously covered card now resolves to unknown, not to its old figure', () => {
    // This card resolved to `cal-shufersal-visa` at 3% from the bundled dataset. That dataset is
    // archived out of the runtime, so the honest answer is that nothing is known about it.
    const card = makeCard({ issuer: CardIssuer.Cal, displayName: 'שופרסל' });
    const result = resolveFxAbroad(card);

    expect(result.status).toBe('unknown');
  });

  test('the refusal names WHY, so "unknown" is distinguishable from "broken"', () => {
    const result = resolveFxAbroad(makeCard());

    expect(result.status).toBe('unknown');
    if (result.status === 'unknown') {
      expect(result.reason).toBe(NO_AUTHORITY_SOURCE);
    }
  });

  test('an uncovered card also resolves to unknown — the answer does not depend on the card', () => {
    // Before D3 this passed because the card was absent from the dataset. It passes now because
    // there is no dataset. The assertion is the same and the reason is different, which is exactly
    // what ADR-P2-001 records.
    const result = resolveFxAbroad(makeCard({ displayName: 'Nonexistent Card 9000' }));

    expect(result.status).toBe('unknown');
  });

  test('NO card resolves to verified — there is no source that could verify one', () => {
    const cards = [
      makeCard({ issuer: CardIssuer.Cal, displayName: 'שופרסל' }),
      makeCard({ issuer: CardIssuer.Isracard, displayName: 'American Express Platinum' }),
      makeCard({ issuer: CardIssuer.Max, displayName: 'Max Back' }),
    ];

    // A loop rather than three assertions: the claim is about every card, and a claim about every
    // card should not be satisfied by three that happen to be listed.
    for (const card of cards) {
      expect(resolveFxAbroad(card).status).toBe('unknown');
    }
  });
});

describe('rankCardsAbroad — refuses rather than defaulting (D3)', () => {
  test('ranks nothing when no card can be resolved', () => {
    const cards = [
      makeCard({ cardId: 'a', issuer: CardIssuer.Cal, displayName: 'שופרסל' }),
      makeCard({ cardId: 'b', issuer: CardIssuer.Isracard, displayName: 'American Express Platinum' }),
    ];

    const { ranked } = rankCardsAbroad(cards, 'purchase', resolveFxAbroad);

    expect(ranked).toHaveLength(0);
  });

  test('an empty ranking is returned for cashWithdrawal too — no mode has a fallback', () => {
    const { ranked } = rankCardsAbroad([makeCard()], 'cashWithdrawal', resolveFxAbroad);

    expect(ranked).toHaveLength(0);
  });

  test('an all-unknown card list yields an empty ranking, never a default', () => {
    // UNCHANGED from before D3. It was the only test in this file asserting a refusal rather than
    // a figure, and it is the only one the removal did not touch.
    const { ranked } = rankCardsAbroad([makeCard({ displayName: 'Unknown Card' })], 'purchase', resolveFxAbroad);

    expect(ranked).toHaveLength(0);
  });

  test('IT ACTUALLY RANKS when a resolver supplies data — the control for the four refusals', () => {
    // Every other assertion in this describe block is `toHaveLength(0)`. All four would still pass
    // if rankCardsAbroad returned an empty array unconditionally, so the block could not tell a
    // correct refusal from a broken function. Injecting the resolver makes the positive case
    // expressible for the first time, and this is it.
    const cheap = makeCard({ cardId: 'cheap', displayName: 'Cheap Abroad' });
    const dear = makeCard({ cardId: 'dear', displayName: 'Dear Abroad' });
    const triple = (pct: number): CardFxTriple => ({
      fxPurchasePct: { value: pct, unit: 'percent', verified: true },
      fxCashWithdrawalForeign: { value: pct, unit: 'percent', verified: true },
      fxCashWithdrawalDomestic: { value: pct, unit: 'percent', verified: true },
    } as unknown as CardFxTriple);

    const stub = (card: CardInput): ResolvedFxAbroad =>
      ({ status: 'verified', triple: triple(card.cardId === 'cheap' ? 1.5 : 3.5) } as unknown as ResolvedFxAbroad);

    const { ranked, unknown } = rankCardsAbroad([dear, cheap], 'purchase', stub);

    expect(unknown).toHaveLength(0);
    expect(ranked.map((r) => r.card.cardId)).toEqual(['cheap', 'dear']);
  });

  test('an empty card list is empty, not an error', () => {
    const { ranked } = rankCardsAbroad([], 'purchase', resolveFxAbroad);

    expect(ranked).toHaveLength(0);
  });
});
