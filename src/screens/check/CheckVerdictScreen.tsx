import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import { NotYetSurface } from '../../components/NotYetSurface';
import { RtlRow, RtlScreen } from '../../components/rtl';
import { useTranslation } from '../../hooks/useTranslation';
import type { ImpactBullet, PurchaseVerdict, PurchaseVerdictResult } from '../../engines/verdict';
import type { SemanticRole } from '../../theme/tokens';
import { BORDER, ROLE_SURFACE, ROLE_TEXT, SURFACE, TEXT } from '../../theme/tokens';

/**
 * CHECK VERDICT — criteria **D1** (four states) and **D2** (one computation).
 *
 *   > **D1.** *"Exactly four verdict states render, each carrying an icon and a word as well
 *   > as a colour."*  (spec §9; colour is never the only carrier)
 *   > **D2.** *"The pill and the Financial Impact panel come from ONE engine computation."*
 *
 * A result is an ENGINE OUTPUT. This screen does not compute one. It paints `result.verdict`
 * as the pill and `result.financialImpact.bullets` as the panel. Those are fields of the
 * same object `runPurchaseCheck` returned. A second path that decided the pill from the
 * panel's numbers (or the other way around) is the Stitch defect — "Good to go" at 41%
 * against a 35% threshold — and D2's gate exists to make that fail.
 *
 * Layout order (D3) is spec §9 top to bottom among sections that exist:
 * pill · context line · Financial Impact · (recommendation / runner-up / FX /
 * impact strip / freshness are later PHASE-2 packages). A section that is not
 * built yet is omitted, not faked.
 *
 * Colour roles come from the token module (A8). Wait uses **neutral / slate**, which is
 * spec §9's word for that state and A8's fourth (non-judgement) role — not a fifth hue.
 *
 * B1: this file must not compare a load to a threshold, name threshold math, or call
 * the engine. Painting an engine number, including scaling a ratio for display, is not
 * a recommendation.
 */

export interface CheckVerdictScreenProps {
  /** The one object `runPurchaseCheck` returned. Absent: nothing to paint yet. */
  readonly result?: PurchaseVerdictResult;
  /**
   * Spec §9 context line: ₪ amount · category · payment plan. User-entered
   * figures, not engine output. Absent: the line is omitted rather than invented.
   */
  readonly contextLine?: {
    readonly amount: number;
    readonly currencySymbol: string;
    readonly categoryLabel: string | null;
    readonly installmentCount: number;
  };
}

type PillCopy = {
  readonly word: string;
  readonly icon: string;
  readonly role: SemanticRole;
};

/**
 * Exhaustive against `PurchaseVerdict`. A fifth engine state is a compile error here
 * rather than a silent unpainted pill.
 */
export const VERDICT_PILL: { readonly [K in PurchaseVerdict]: PillCopy } = {
  good_to_go: { word: 'אפשר לקנות', icon: '✓', role: 'positive' },
  caution: { word: 'זהירות', icon: '!', role: 'advisory' },
  dont_buy_now: { word: 'לא לקנות עכשיו', icon: '✕', role: 'danger' },
  wait_until_billing_passes: { word: 'חכי עד שהחיוב יעבור', icon: '⏳', role: 'neutral' },
};

const BULLET_WORD: { readonly [K in ImpactBullet['kind']]: string } = {
  PURCHASE_MONTHLY_COMMITMENT: 'התחייבות חודשית מהרכישה',
  LOAD_AFTER_PURCHASE: 'עומס אחרי הרכישה',
  HARD_THRESHOLD_HEADROOM: 'מרווח עד הסף הקשיח',
  LOAD_AFTER_BILLING: 'עומס אחרי החיוב',
};

/** Display scale of an engine ratio. Not a second load calculation. */
function asDisplayPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function bulletClaim(bullet: ImpactBullet): string {
  switch (bullet.kind) {
    case 'PURCHASE_MONTHLY_COMMITMENT':
    case 'HARD_THRESHOLD_HEADROOM':
      return String(bullet.amountIls.value);
    case 'LOAD_AFTER_PURCHASE':
      return String(bullet.ratioOfIncome.value);
    case 'LOAD_AFTER_BILLING':
      return `${bullet.billingDate}|${bullet.ratioOfIncome.value}`;
  }
}

function bulletVisible(bullet: ImpactBullet): string {
  switch (bullet.kind) {
    case 'PURCHASE_MONTHLY_COMMITMENT':
    case 'HARD_THRESHOLD_HEADROOM':
      return `₪${bullet.amountIls.value}`;
    case 'LOAD_AFTER_PURCHASE':
      return asDisplayPercent(bullet.ratioOfIncome.value);
    case 'LOAD_AFTER_BILLING':
      return `${bullet.billingDate} ${asDisplayPercent(bullet.ratioOfIncome.value)}`;
  }
}

export function CheckVerdictScreen({ result, contextLine }: CheckVerdictScreenProps): React.ReactElement {
  const { t } = useTranslation();

  if (result === undefined) {
    return (
      <RtlScreen className={SURFACE.page} safe>
        <NotYetSurface
          ownedBy="WP-1.5 — Check Verdict pill and Financial Impact from one computation (P4 D1+D2)"
          testID="check-verdict-not-yet"
          title="בדיקה"
        />
      </RtlScreen>
    );
  }

  const pill = VERDICT_PILL[result.verdict];
  const word = t(pill.word);
  const label = `${pill.icon} ${word}`;

  return (
    <RtlScreen className={SURFACE.page} safe>
      <View className={`m-3 rounded-lg border p-4 ${SURFACE.card} ${BORDER.hairline}`}>
        <View
          accessibilityLabel={label}
          accessibilityRole="text"
          className={`rounded-lg border px-4 py-3 ${ROLE_SURFACE[pill.role]}`}
          testID={`check-verdict-pill-${result.verdict}`}
        >
          <RtlRow className="items-center gap-2">
            <AppText
              className={`text-2xl font-extrabold ${ROLE_TEXT[pill.role]}`}
              testID="check-verdict-pill-icon"
            >
              {pill.icon}
            </AppText>
            <AppText
              className={`text-xl font-extrabold ${ROLE_TEXT[pill.role]}`}
              testID="check-verdict-pill-word"
            >
              {word}
            </AppText>
          </RtlRow>
        </View>
        {result.verdict === 'wait_until_billing_passes' && result.waitUntil ? (
          <AppText className={`mt-3 text-sm ${TEXT.body}`} testID="check-verdict-wait-date">
            {result.waitUntil}
          </AppText>
        ) : null}
        {contextLine ? (
          <AppText className={`mt-3 text-sm ${TEXT.body}`} testID="check-verdict-context">
            {`${contextLine.currencySymbol}${contextLine.amount} · ${
              contextLine.categoryLabel ?? t('ללא קטגוריה')
            } · ${
              contextLine.installmentCount <= 1
                ? t('תשלום אחד')
                : `${contextLine.installmentCount} ${t('תשלומים')}`
            }`}
          </AppText>
        ) : null}
        <View className={`mt-4 gap-2`} testID="check-verdict-impact-panel">
          <AppText className={`text-sm font-bold ${TEXT.body}`} testID="check-verdict-impact-title">
            {t('השפעה כלכלית')}
          </AppText>
          {result.financialImpact.bullets.map((bullet) => (
            <AppText
              accessibilityValue={{ text: bulletClaim(bullet) }}
              className={`text-sm ${TEXT.body}`}
              key={bullet.kind}
              testID={`check-verdict-impact-${bullet.kind}`}
            >
              {`${t(BULLET_WORD[bullet.kind])} ${bulletVisible(bullet)}`}
            </AppText>
          ))}
        </View>
      </View>
    </RtlScreen>
  );
}
