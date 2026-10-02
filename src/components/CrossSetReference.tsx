import React from 'react';

import type { ReferenceResolution } from '../data/adapter/crossSet';

/**
 * RENDERING A CROSS-PACK-SET REFERENCE — criterion C4, obligation OB-2.
 *
 *   > **OB-2.** *"A `benefits` row naming a card the device's older `catalog` does not carry must
 *   > render as **absent, never as an error**."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * ABSENT MEANS NOTHING IS DRAWN, AND THAT IS THE HARD PART
 *
 * The instinct on a missing referent is to draw *something*: a placeholder, a dash, a "not
 * available" chip, a skeleton that never resolves. Every one of those tells a user that the app
 * expected something and did not get it — which is an error message in a costume, and OB-2 says
 * never an error.
 *
 * A device holding Tuesday's `catalog` and Friday's `benefits` is **working correctly**. There is
 * nothing to report, nothing to retry, and nothing for a person to do. So this component renders
 * `null`, and the row around it is simply shorter.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE CALLER MAY SUPPLY A FALLBACK, AND IT MAY NOT BE AN ERROR
 *
 * `whenAbsent` exists because a list of three benefits where one silently vanishes can read as a
 * bug. A caller may pass a quiet, honest node — the benefit's own title without the card name, say.
 * What it may not pass is an error, a retry, or a spinner, and `crossSetAbsence` is the gate that
 * checks nobody did.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * `UNRESOLVABLE_REFERENCE` RENDERS THE SAME AND IS NOT THE SAME
 *
 * A malformed reference is a defect in a pack that verified — rare, and worth knowing about. It
 * still renders as nothing, because a user cannot act on it either and showing them a corruption
 * notice would be worse than showing them a shorter row. `onUnresolvable` lets a diagnostic surface
 * count them without any of that reaching the screen.
 */

export interface CrossSetReferenceProps<T> {
  readonly resolution: ReferenceResolution<T>;
  /** Rendered only when the referent is actually present. */
  readonly render: (value: T) => React.ReactElement | null;
  /**
   * Optional, quiet, and never an error. A dash is fine. "Unavailable — retry" is not, and the
   * `ob2-skew` gate refuses it.
   */
  readonly whenAbsent?: React.ReactElement | null;
  /** Diagnostics only. Never a path to a user-visible message. */
  readonly onUnresolvable?: (id: string) => void;
}

export function CrossSetReference<T>({
  resolution,
  render,
  whenAbsent,
  onUnresolvable,
}: CrossSetReferenceProps<T>): React.ReactElement | null {
  switch (resolution.state) {
    case 'PRESENT':
      return resolution.value === undefined ? null : render(resolution.value);

    case 'ABSENT_IN_THIS_VERSION':
      // Nothing. Not a placeholder, not a dash by default, not a skeleton — a device with content
      // skew is a device working correctly, and drawing anything here says otherwise.
      return whenAbsent ?? null;

    case 'UNRESOLVABLE_REFERENCE':
      onUnresolvable?.(resolution.id);
      return null;
  }
}
