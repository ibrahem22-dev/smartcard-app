/**
 * PLAN — COMMITMENTS. The surface that replaces the evidenced empty state naming it.
 *
 *   > **B2** *(as corrected by assumption A10)*: *"All five P5 surfaces render P5 content and no
 *   > route reaches a placeholder for any of them… **Plan Commitments replaces the evidenced empty
 *   > state that names it**."* A placeholder that is still reachable is still shipped, and *"we
 *   > built the new one beside it"* is how a product ends up with two Wallets and no way to tell
 *   > which one a user saw.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS SCREEN DELIBERATELY DOES NOT DO YET, AND WHY THAT IS NOT A PLACEHOLDER
 *
 * It lists the commitments the vault actually holds, in the group order spec §15 fixes. Its sticky
 * summary now shows J1's engine-reported total, load ratio and editable absolute cap together.
 * **Paid early** remains criterion `J4` and is not part of this package.
 *
 * The difference between this and a placeholder is not tone, it is what the screen is ABOUT. A
 * `NotYetSurface` says *"this surface has not been built"*. This one answers the question the
 * surface exists to answer — **what am I committed to?** — from real vault data, and is honest
 * about the parts that are not here yet. A user with three installments sees three installments.
 *
 * **AND IT SUMS NOTHING.** A monthly total is a number, and every number a P5 surface shows comes
 * from an engine call (criterion `B1`, spec §20). The total is `J1`'s hero and it arrives through
 * the load engine, via `src/surfaces/`, in PHASE-5. Adding `reduce((a, c) => a + c.monthly, 0)`
 * here would be four lines, would look obviously right, and would be the exact defect the whole
 * architecture exists to prevent.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE GROUP ORDER IS FIXED, AND EVERY GROUP RENDERS EVEN WHEN IT IS EMPTY
 *
 * Spec §15 and criterion `J2`: **Installments / Loans / Mortgage / Fixed orders**. A group that
 * vanished when empty would make "you have no loans" and "this app does not track loans"
 * indistinguishable, and the second is false.
 *
 * **Fixed orders (הוראות קבע) has no store yet.** Nothing in the vault holds them, so the group
 * renders its empty line and says so. That is a true statement about today, and it is why the group
 * is here rather than added later: a reader can see what the surface covers.
 */
import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import { RtlRow, RtlScreen, RtlScrollView } from '../../components/rtl';
import { useMoney } from '../../hooks/useMoney';
import { useTranslation } from '../../hooks/useTranslation';
import { useCardsStore } from '../../store/useCardsStore';
import { useLoansStore } from '../../store/useLoansStore';
import { BORDER, SURFACE, TEXT } from '../../theme/tokens';
import { TABULAR_NUMERALS } from '../../utils/money';
import { CommitmentsSummary } from './CommitmentsSummary';

/** One line in a group: what it is, and what it costs a month. */
interface CommitmentRow {
  readonly id: string;
  readonly name: string;
  readonly monthlyIls: number;
}

interface CommitmentGroup {
  readonly key: string;
  /**
   * ALREADY TRANSLATED, AND `t()` WAS CALLED WITH A LITERAL.
   *
   * The first version held Hebrew source strings here and called `t(group.title)` at the render
   * site. Every string then resolved through a VARIABLE, and `arabicCoverage.test.ts` collects
   * `t('…')` calls with literal arguments — so eight of the nine new strings were invisible to the
   * one test that exists to catch exactly this, and would have fallen back to Hebrew for every
   * Arabic and English reader. The coverage test reported one missing key and was right about all
   * nine; it simply could not see the other eight.
   */
  readonly title: string;
  readonly rows: readonly CommitmentRow[];
  /** What an empty group means. Never a blank, never a spinner. */
  readonly emptyLine: string;
}

export function CommitmentsScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { money } = useMoney();
  const obligations = useCardsStore((s) => s.obligations);
  const loans = useLoansStore((s) => s.loans);

  /* THE ORDER IS SPEC §15's, NOT THIS FILE'S PREFERENCE — criterion J2. */
  const groups: readonly CommitmentGroup[] = [
    {
      key: 'installments',
      title: t('תשלומים'),
      emptyLine: t('אין תשלומים פעילים'),
      rows: obligations.map((o) => ({
        id: o.installmentId,
        name: o.merchantName,
        monthlyIls: o.monthlyPayment,
      })),
    },
    {
      key: 'loans',
      title: t('הלוואות'),
      emptyLine: t('אין הלוואות'),
      rows: loans
        .filter((l) => l.loanType !== 'mortgage')
        .map((l) => ({ id: l.id, name: l.lenderName, monthlyIls: l.monthlyPayment })),
    },
    {
      key: 'mortgage',
      title: t('משכנתא'),
      emptyLine: t('אין משכנתא'),
      rows: loans
        .filter((l) => l.loanType === 'mortgage')
        .map((l) => ({ id: l.id, name: l.lenderName, monthlyIls: l.monthlyPayment })),
    },
    {
      key: 'fixed-orders',
      title: t('הוראות קבע'),
      /* Not "you have none" — nothing records them yet, and those are different sentences. */
      emptyLine: t('הוראות קבע עדיין לא נשמרות באפליקציה'),
      rows: [],
    },
  ];

  return (
    <RtlScreen className={SURFACE.page} testID="plan-commitments">
      <RtlScrollView contentContainerStyle={{ padding: 20 }} stickyHeaderIndices={[0]}>
        <CommitmentsSummary />
        {groups.map((group) => (
          <View
            className={`mb-4 rounded-lg border p-4 ${SURFACE.card} ${BORDER.hairline}`}
            key={group.key}
            testID={`commitments-group-${group.key}`}
          >
            <AppText className={`text-base font-extrabold ${TEXT.heading}`}>
              {group.title}
            </AppText>
            {group.rows.length === 0 ? (
              <AppText
                className={`mt-2 text-sm ${TEXT.muted}`}
                testID={`commitments-empty-${group.key}`}
              >
                {group.emptyLine}
              </AppText>
            ) : (
              group.rows.map((row) => (
                <RtlRow className="mt-3 items-center justify-between" key={row.id}>
                  <AppText className={`text-sm ${TEXT.body}`} testID={`commitments-row-${row.id}`}>
                    {row.name}
                  </AppText>
                  <AppText
                    accessibilityValue={{ text: String(row.monthlyIls) }}
                    className={`text-sm font-bold ${TEXT.heading}`}
                    style={TABULAR_NUMERALS}
                    testID={`commitments-monthly-${row.id}`}
                  >
                    {money(row.monthlyIls)}
                  </AppText>
                </RtlRow>
              ))
            )}
          </View>
        ))}
        <AppText className={`mt-2 text-xs ${TEXT.muted}`} testID="commitments-not-yet-summary">
          {t('הסכום המוחלט והאחוז מוצגים יחד כדי להמחיש את העומס')}
        </AppText>
      </RtlScrollView>
    </RtlScreen>
  );
}
