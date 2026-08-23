import React from 'react';
import { View } from 'react-native';

import { AppText } from './AppText';
import { RtlRow } from './rtl';
import { BORDER, ROLE_BORDER, ROLE_SURFACE_BG, ROLE_TEXT, SURFACE, TEXT } from '../theme/tokens';
import { useTranslation } from '../hooks/useTranslation';
import {
  CHIP_LABEL,
  CHIP_STALE_LABEL,
  type ChipState,
  type ChipView,
} from './provenanceChipState';

/**
 * THE PROVENANCE CHIP — criterion A2. One definition, and the only place chip markup exists.
 *
 *   > **A2.** *"The four-state provenance chip (Verified / Your value / Estimate / Unknown) **plus
 *   > the Stale modifier** is one shared primitive; **no screen constructs chip markup locally**."*
 *
 * The forensic recorded that no such component existed (§4.2). Four states were being described in
 * prose across the app and rendered nowhere consistently, which is the condition where two screens
 * eventually disagree about what "verified" looks like — and a user learns that the badge means
 * whatever the screen they are on decided.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * ICON **AND** WORD, NEVER COLOUR ALONE — criterion A9
 *
 *   > **A9.** *"every state cue is **icon + word**, never colour alone."*
 *
 * Each chip carries a glyph and its label, and the colour is the third cue rather than the only
 * one. That is not decoration: red-green colour blindness affects roughly one man in twelve, and a
 * badge distinguishing "verified" from "unknown" by hue alone tells that reader nothing at all. The
 * `a11y` gate reads this component and fails if a state ever loses its glyph or its word.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY `unknown` IS NEUTRAL AND NOT DANGER
 *
 * "We do not know this" is not a warning about the user's money — it is the app declining to make a
 * claim. Painting it red would tell somebody their card is dangerous when the truth is that nobody
 * looked, and A8 reserves red for danger *only*. Estimate is advisory, because an estimate is
 * exactly the "unverified figure" that role names.
 */

/** The glyph each state carries. Text, not an icon font: a chip must survive a missing font. */
const CHIP_GLYPH: Readonly<Record<ChipState, string>> = {
  verified: '✓',
  user: '✎',
  estimate: '≈',
  unknown: '?',
};

/** The A8 role each state wears. `unknown` is neutral — see the header. */
const CHIP_TONE: Readonly<Record<ChipState, 'positive' | 'advisory' | 'neutral'>> = {
  verified: 'positive',
  user: 'neutral',
  estimate: 'advisory',
  unknown: 'neutral',
};

export interface ProvenanceChipProps {
  /** What to show. `null` means no chip is honest here — the caller must render nothing. */
  readonly view: ChipView | null;
  /** Optional test id, so a harness can find one chip among several. */
  readonly testID?: string;
}

export function ProvenanceChip({
  view,
  testID,
}: ProvenanceChipProps): React.ReactElement | null {
  const { t } = useTranslation();

  // A conflict has no single badge that tells the truth. See provenanceChipState.ts.
  if (view === null) return null;

  const role = CHIP_TONE[view.state];
  const label = t(CHIP_LABEL[view.state]);
  const stale = t(CHIP_STALE_LABEL);

  return (
    // RtlRow rather than a hardcoded row direction. The app's own rtlNoHardcodedDirectionClasses
    // test caught the first version, and it was right to: this app ships Hebrew and Arabic, both
    // written from the other side, and a fixed row would put the glyph on the wrong side of its
    // word in the two languages most of its readers use. A badge that reads backwards is a badge
    // nobody trusts.
    <RtlRow
      accessibilityRole="text"
      accessibilityLabel={view.stale ? `${label} · ${stale}` : label}
      // `self-start` is CROSS-AXIS alignment. In a row it controls vertical placement and has
      // nothing to do with reading direction; it stops the chip stretching to the full width of
      // whatever contains it. The scan's list is deliberately broad, and this is the exception it
      // provides a marker for — declared with its reason rather than silently reworded. The marker
      // sits on the line directly above the class, because that is the only place the scan reads it.
      // rtl-ok
      className={`items-center gap-1 self-start rounded-full border px-2 py-0.5 ${ROLE_SURFACE_BG[role]} ${ROLE_BORDER[role]}`}
      testID={testID ?? `provenance-chip-${view.state}`}
    >
      <AppText className={`text-xs font-bold ${ROLE_TEXT[role]}`}>
        {CHIP_GLYPH[view.state]}
      </AppText>
      <AppText className={`text-xs font-bold ${ROLE_TEXT[role]}`}>{label}</AppText>
      {view.stale ? (
        <View
          className={`ms-1 rounded-full border px-1.5 ${SURFACE.sunken} ${BORDER.hairline}`}
          testID="provenance-chip-stale"
        >
          <AppText className={`text-[10px] font-bold ${TEXT.secondary}`}>{stale}</AppText>
        </View>
      ) : null}
    </RtlRow>
  );
}
