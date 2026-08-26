import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import { NotYetSurface } from '../../components/NotYetSurface';
import { RtlRow, RtlScreen } from '../../components/rtl';
import { useTranslation } from '../../hooks/useTranslation';
import type { PurchaseVerdict, PurchaseVerdictResult } from '../../engines/verdict';
import type { SemanticRole } from '../../theme/tokens';
import { BORDER, ROLE_SURFACE, ROLE_TEXT, SURFACE, TEXT } from '../../theme/tokens';

/**
 * CHECK VERDICT — criterion **D1 and nothing else**.
 *
 *   > **D1.** *"Exactly four verdict states render, each carrying an icon and a word as well
 *   > as a colour."*  (spec §9; colour is never the only carrier)
 *
 * A result is an ENGINE OUTPUT. This screen does not compute one. It paints the pill the
 * seam already produced. Financial Impact, recommendation, FX, provenance chips and the
 * rest of §9's layout are WP-1.5+ (D2–D8). Until a result is supplied the screen stays
 * honestly empty — a canned pill would be a second computation.
 *
 * Colour roles come from the token module (A8). Wait uses **neutral / slate**, which is
 * spec §9's word for that state and A8's fourth (non-judgement) role — not a fifth hue.
 */

export interface CheckVerdictScreenProps {
  /** The one object `runPurchaseCheck` returned. Absent: nothing to paint yet. */
  readonly result?: PurchaseVerdictResult;
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

export function CheckVerdictScreen({ result }: CheckVerdictScreenProps): React.ReactElement {
  const { t } = useTranslation();

  if (result === undefined) {
    return (
      <RtlScreen className={SURFACE.page} safe>
        <NotYetSurface
          ownedBy="WP-1.4 — Check Verdict states (P4 criterion D1)"
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
      </View>
    </RtlScreen>
  );
}
