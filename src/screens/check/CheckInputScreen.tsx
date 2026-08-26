import React from 'react';

import { NotYetSurface } from '../../components/NotYetSurface';
import { RtlScreen } from '../../components/rtl';
import { SURFACE } from '../../theme/tokens';

/**
 * CHECK INPUT — the root of the P4 Check stack.
 *
 * THIS SCREEN IS THIN ON PURPOSE. WP-1.1 replaces what `CheckModal` mounts; **WP-1.2** gives this
 * surface its contract (C1: an amount above zero, a currency defaulting to ₪). Writing that contract
 * here would be this work package deciding a question the next one owns, and a guess committed early
 * is indistinguishable in a diff from a decision made properly.
 *
 * So it renders the refusal the codebase already has a component for: this is not built yet, and the
 * work package that builds it is named on the surface. That is a true sentence. An input form with
 * invented fields would not be.
 *
 * **No number appears here, and none is computed here.** Every number a P4 surface shows comes from
 * an engine call — the seam is WP-1.3. Showing almost nothing is the correct thin state; computing
 * something to have something to show is the defect the boundary gate exists to catch.
 */
export function CheckInputScreen(): React.ReactElement {
  return (
    <RtlScreen className={SURFACE.page} safe>
      <NotYetSurface
        ownedBy="WP-1.2 — Check Input contract (P4 criterion C1)"
        testID="check-input-not-yet"
        title="בדיקה"
      />
    </RtlScreen>
  );
}
