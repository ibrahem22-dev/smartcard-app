import React from 'react';

import { NotYetSurface } from '../../components/NotYetSurface';
import { RtlScreen } from '../../components/rtl';
import { SURFACE } from '../../theme/tokens';

/**
 * CHECK VERDICT — where the P4 Check flow ends.
 *
 * THIS SCREEN IS THIN ON PURPOSE, for the reason its sibling states: **WP-1.4** gives it its
 * contract (D1: the four verdict states, each an icon, a word and a colour), and WP-1.5 makes the
 * pill and the panel come from one computation. Until then there is no verdict to render, because a
 * verdict is an ENGINE OUTPUT and this screen has no engine result to show.
 *
 * A canned verdict would be worse than nothing. `DecisionScreen`'s own header records what that
 * costs: four plausible per-verdict sentences that read exactly like findings about the user's money
 * and were not produced by any engine. This screen starts without them rather than removing them
 * later.
 */
export function CheckVerdictScreen(): React.ReactElement {
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
