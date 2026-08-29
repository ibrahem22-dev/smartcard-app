/**
 * L2 — a logged purchase consumes available limit via the load engine.
 * The next verdict's impact strip is that engine field, not a surface subtraction.
 */
import { evaluateFinancialLoad } from '../../../engines/load';
import { Currency } from '../../../types/purchase.types';
import type { UserProfile } from '../../../types/user.types';
import {
  loadCardsFromVault,
  writeLoggedPurchase,
} from '../../../check/activityMapper';
import { verdictPropsFromDraft } from '../../../check/checkLoop';
import type { CheckInputDraft } from '../CheckInputScreen';

/**
 * A vault with no תשלומים and no loans, KNOWN to be empty — the state these cases have always
 * assumed. Before the OQ-P5-001 repair `verdictPropsFromDraft` assumed it for them; now they say it.
 */
const NO_COMMITMENTS = {
  installments: [] as const,
  loans: [] as const,
  commitmentReadiness: { installments: 'KNOWN_EMPTY', loans: 'KNOWN_EMPTY' },
} as const;


const TODAY = '2026-08-27';

const profile: UserProfile = {
  id: 'user-1',
  monthlyIncome: 10_000,
  createdAt: 1,
  updatedAt: 1,
};

const draft: CheckInputDraft = {
  amount: 1_500,
  currency: Currency.ILS,
  category: null,
  installments: null,
  cardId: 'card-a',
};

const vaultCards = [{ cardId: 'card-a', creditLimit: 10_000 }] as const;

describe('L2 — logged purchase consumes available limit', () => {
  it('the load engine availableAfterChangesIls drops by the logged amount', () => {
    const logged = writeLoggedPurchase({
      activityId: 'activity:l2',
      amountIls: 1_500,
      at: '2026-08-27T10:00:00.000Z',
      cardId: 'card-a',
    });
    const beforeCards = loadCardsFromVault(vaultCards, []);
    const afterCards = loadCardsFromVault(vaultCards, [logged]);
    const income = { value: 10_000, provenance: 'USER' as const };
    const prospective = {
      commitmentId: 'this-purchase',
      monthlyAmountIls: { value: 1_500, provenance: 'USER' as const },
      linkedCardId: 'card-a',
      remainingHoldIls: { value: 1_500, provenance: 'USER' as const },
    };
    const before = evaluateFinancialLoad({
      monthlyIncomeIls: income,
      commitments: [],
      cards: beforeCards,
      prospectiveCommitment: prospective,
    });
    const after = evaluateFinancialLoad({
      monthlyIncomeIls: income,
      commitments: [],
      cards: afterCards,
      prospectiveCommitment: prospective,
    });
    const beforeAvail = before.cardLimits[0]?.availableAfterChangesIls.value;
    const afterAvail = after.cardLimits[0]?.availableAfterChangesIls.value;
    if (beforeAvail === undefined || afterAvail === undefined) {
      throw new Error('load engine returned no cardLimits');
    }
    expect(afterAvail).toBe(beforeAvail - 1_500);
    expect(after.cardLimits[0]?.loggedThisCyclePurchasesIls.value).toBe(1_500);
  });

  it("the next verdict's impact strip reflects the logged purchase", () => {
    const logged = writeLoggedPurchase({
      activityId: 'activity:l2-strip',
      amountIls: 1_500,
      at: '2026-08-27T10:00:00.000Z',
      cardId: 'card-a',
    });
    const before = verdictPropsFromDraft(draft, {
      profile,
      cards: vaultCards,
      purchases: [],
      todayIso: TODAY,
      ...NO_COMMITMENTS,
    });
    const after = verdictPropsFromDraft(draft, {
      profile,
      cards: vaultCards,
      purchases: [logged],
      todayIso: TODAY,
      ...NO_COMMITMENTS,
    });
    const beforeStrip = before.impactStrip?.availableAfterPurchaseIls.value;
    const afterStrip = after.impactStrip?.availableAfterPurchaseIls.value;
    if (beforeStrip === undefined || afterStrip === undefined) {
      throw new Error('checkLoop omitted the impact strip');
    }
    expect(afterStrip).toBe(beforeStrip - 1_500);
  });
});
