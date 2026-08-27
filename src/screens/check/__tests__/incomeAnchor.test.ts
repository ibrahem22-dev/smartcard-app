import { parseStoredProfile } from '../../../store/userProfileParsing';
import { Currency } from '../../../types/purchase.types';
import type { UserProfile } from '../../../types/user.types';
import {
  nextPaydayIso,
  paydayFromChip,
  purchaseContextFromProfile,
} from '../../../check/incomeAnchor';
import { runPurchaseCheck } from '../../../check/runPurchaseCheck';
import type { CheckInputDraft } from '../CheckInputScreen';

const TODAY = '2026-08-27';

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

    const context = purchaseContextFromProfile(stored, TODAY);
    expect(context).not.toBeNull();
    expect(context?.monthlyIncomeIls).toEqual({ value: 12_000, provenance: 'USER' });
    expect(context?.nextPayday).toBe('2026-09-10');
  });

  it('skipped income does not invent a zero for the engine', () => {
    expect(purchaseContextFromProfile(null, TODAY)).toBeNull();
    expect(
      purchaseContextFromProfile(
        parseStoredProfile(
          JSON.stringify({ id: 'user-1', createdAt: 1, updatedAt: 1 }),
        ),
        TODAY,
      ),
    ).toBeNull();
  });

  it('the verdict engine consumes the vault income as the load-ratio anchor', () => {
    const high = purchaseContextFromProfile(profile({ monthlyIncome: 12_000 }), TODAY);
    const low = purchaseContextFromProfile(profile({ monthlyIncome: 6_000 }), TODAY);
    if (high === null || low === null) {
      throw new Error('context must exist when income is captured');
    }
    const highResult = runPurchaseCheck(draft, high);
    const lowResult = runPurchaseCheck(draft, low);
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
