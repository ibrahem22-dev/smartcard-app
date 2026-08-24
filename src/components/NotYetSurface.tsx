import React from 'react';
import { View } from 'react-native';

import { AppText } from './AppText';
import { RtlRow } from './rtl';
import { BORDER, ROLE_BORDER, ROLE_SURFACE_BG, ROLE_TEXT, SURFACE, TEXT } from '../theme/tokens';
import { useTranslation } from '../hooks/useTranslation';

/**
 * A SURFACE THAT SAYS WHAT IT IS AND WHEN IT ARRIVES — never a spinner, never a blank.
 *
 * Contract §9 sends the Wallet, Card DNA, Plan and Home CONTENT surfaces to P5a/P5b, and this work
 * package is the SHELL. So Benefits and Commitments are real routes in a real segmented control,
 * and what they render is this.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS NOT AN EMPTY STATE AND NOT A LOADING STATE
 *
 * A spinner says "wait". A blank panel says "there is nothing". Both are false here: nothing is
 * loading and the answer is not "none" — the surface has not been built yet, which is a different
 * sentence and the only true one. `P2_COMPLETION_CONTRACT.md` §1 is that P2 renders facts and
 * refusals, and "this is not built yet" is a refusal with a date attached.
 *
 * It names the PHASE that owns it. A user never sees that line, but the person who opens this
 * screen during development does, and a placeholder that cannot tell you who owes it is a
 * placeholder that outlives the plan it came from.
 */
export interface NotYetSurfaceProps {
  /** What this surface will be, as a Hebrew source string. */
  readonly title: string;
  /** The phase or criterion that owns it — shown small, for whoever is building. */
  readonly ownedBy: string;
  readonly testID?: string;
}

export function NotYetSurface({
  title,
  ownedBy,
  testID,
}: NotYetSurfaceProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <View
      className={`m-3 rounded-lg border p-4 ${SURFACE.card} ${BORDER.hairline}`}
      testID={testID ?? 'not-yet-surface'}
    >
      <AppText className={`text-lg font-extrabold ${TEXT.heading}`}>{t(title)}</AppText>

      {/* Advisory, not danger: nothing here is wrong, it is unfinished. rtl-ok */}
      <RtlRow
        className={`mt-3 items-center gap-2 rounded-lg border p-3 ${ROLE_SURFACE_BG.advisory} ${ROLE_BORDER.advisory}`}
      >
        <AppText className={`text-sm font-bold ${ROLE_TEXT.advisory}`}>⌛</AppText>
        <AppText className={`flex-1 text-sm font-bold ${ROLE_TEXT.advisory}`}>
          {t('המסך הזה עדיין לא נבנה. אין כאן נתונים חסרים — יש כאן מסך שטרם נכתב.')}
        </AppText>
      </RtlRow>

      <AppText className={`mt-2 text-xs ${TEXT.muted}`}>{ownedBy}</AppText>
    </View>
  );
}
