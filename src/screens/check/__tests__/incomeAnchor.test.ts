import { parseStoredProfile } from '../../../store/userProfileParsing';
import { Currency } from '../../../types/purchase.types';
import type { UserProfile } from '../../../types/user.types';
import {
  nextPaydayIso,
  paydayFromChip,
  purchaseContextFromProfile,
} from '../../../check/incomeAnchor';
import type { CommitmentState } from '../../../check/commitmentInput';
import { runPurchaseCheck } from '../../../check/runPurchaseCheck';
import type { CheckInputDraft } from '../CheckInputScreen';

const TODAY = '2026-08-27';

/**
 * A KNOWN-EMPTY commitment state. These cases are about income and payday, and they used to get an
 * empty commitment list because `purchaseContextFromProfile` invented one; now they ask for one, in
 * as many words. That is the difference the OQ-P5-001 repair makes: the empty list is a stated
 * assumption of this test rather than an unstated assumption of the product.
 */
const NO_COMMITMENTS: CommitmentState = { known: true, commitments: [] };

const draft: CheckInputDraft = {
  amount: 1_500,
  currency: Currency.ILS,
  category: null,
  installments: null,
  cardId: null,
};

const profile = (over: Partial<UserProfile> = {}): UserProfile => ({
  id: 'user-1',
  monthlyIncome: 12_000,
  payday: { kind: 'day', day: 10 },
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

describe('O5 — income and payday reach the vault and the engines consume them', () => {
  it('a stored income+payday profile round-trips and becomes engine context', () => {
    const stored = parseStoredProfile(JSON.stringify(profile()));
    expect(stored?.monthlyIncome).toBe(12_000);
    expect(stored?.payday).toEqual({ kind: 'day', day: 10 });

    const resolved = purchaseContextFromProfile(stored, TODAY, NO_COMMITMENTS);
    expect(resolved.kind).toBe('READY');
    if (resolved.kind !== 'READY') throw new Error(resolved.detail);
    expect(resolved.context.monthlyIncomeIls).toEqual({ value: 12_000, provenance: 'USER' });
    expect(resolved.context.nextPayday).toBe('2026-09-10');
  });

  it('skipped income does not invent a zero for the engine, and says which absence it is', () => {
    const noProfile = purchaseContextFromProfile(null, TODAY, NO_COMMITMENTS);
    expect(noProfile).toEqual({ kind: 'ABSENT', because: 'NO_PROFILE', detail: expect.any(String) });

    /* A STORED RECORD WITH NO INCOME DOES NOT PARSE AT ALL, so this arm is NO_PROFILE and not
       NO_INCOME — `parseStoredProfile` refuses it upstream. The old assertion was `toBeNull()` for
       both arms and could not have told them apart; naming them separately is what showed which
       one this actually is. */
    const unparseable = purchaseContextFromProfile(
      parseStoredProfile(JSON.stringify({ id: 'user-1', createdAt: 1, updatedAt: 1 })),
      TODAY,
      NO_COMMITMENTS,
    );
    expect(unparseable).toEqual({ kind: 'ABSENT', because: 'NO_PROFILE', detail: expect.any(String) });

    /* THE NO_INCOME ARM IS THE NON-FINITE ONE. `UserProfile.monthlyIncome` is required, so a
       profile with the field absent is a state the type forbids and the parser refuses; what IS
       reachable is a stored NaN, and that is what the guard in `incomeAnchor` is for. Naming it
       here records that the two arms have different causes rather than being two spellings of one. */
    const noIncome = purchaseContextFromProfile(
      profile({ monthlyIncome: Number.NaN }),
      TODAY,
      NO_COMMITMENTS,
    );
    expect(noIncome).toEqual({ kind: 'ABSENT', because: 'NO_INCOME', detail: expect.any(String) });
  });

  it('the verdict engine consumes the vault income as the load-ratio anchor', () => {
    const high = purchaseContextFromProfile(profile({ monthlyIncome: 12_000 }), TODAY, NO_COMMITMENTS);
    const low = purchaseContextFromProfile(profile({ monthlyIncome: 6_000 }), TODAY, NO_COMMITMENTS);
    if (high.kind !== 'READY' || low.kind !== 'READY') {
      throw new Error('context must exist when income is captured');
    }
    const highResult = runPurchaseCheck(draft, high.context);
    const lowResult = runPurchaseCheck(draft, low.context);
    const highLoad = highResult.financialImpact.thresholdMath.projectedLoadRatio.value;
    const lowLoad = lowResult.financialImpact.thresholdMath.projectedLoadRatio.value;
    expect(lowLoad).toBeCloseTo(highLoad * 2, 5);
    expect(highLoad).not.toBe(lowLoad);
  });

  it('payday chips map to the next ISO date the engine receives', () => {
    expect(paydayFromChip('1')).toEqual({ kind: 'day', day: 1 });
    expect(paydayFromChip('last')).toEqual({ kind: 'last' });
    expect(paydayFromChip(null)).toBeUndefined();
    expect(nextPaydayIso({ kind: 'day', day: 28 }, TODAY)).toBe('2026-08-28');
    expect(nextPaydayIso({ kind: 'last' }, TODAY)).toBe('2026-08-31');
  });
});
