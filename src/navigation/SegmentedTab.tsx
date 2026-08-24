import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScreen } from '../components/rtl';
import { BORDER, SURFACE, TEXT, ACCENT } from '../theme/tokens';
import { useTranslation } from '../hooks/useTranslation';
import type { IaSegment } from './ia';

/**
 * THE INTERNAL SEGMENTED CONTROL — the one Spec §4 gives Wallet and Plan.
 *
 *   > *"**Wallet** contains an internal segmented control: **Cards | Benefits**."*
 *   > *"**Plan** contains an internal segmented control: **Calendar | Commitments**."*
 *
 * ONE COMPONENT, TWO TABS. Wallet and Plan have the same control with different segments, and
 * writing it twice is how they start behaving differently — one animates, one does not; one
 * remembers the last segment, one resets. A segmented control that behaves differently in two
 * places teaches a user it is two different things.
 *
 * IT IS NOT NAVIGATION. The segments swap content inside one tab; they push no route and change no
 * URL. That matters for A1: the spec's bottom navigation has five items, and a segmented control
 * that registered routes would make the route tree disagree with the bar.
 *
 * A9: each segment is a ≥44pt target, and the selected one is marked by `accessibilityState`
 * as well as by colour — a control whose only cue is a tint is one a screen reader cannot report
 * and a colour-blind reader cannot see.
 */
export interface SegmentedTabProps {
  readonly segments: readonly IaSegment[];
  readonly render: (segmentKey: string) => React.ReactElement;
  readonly testID?: string;
}

export function SegmentedTab({
  segments,
  render,
  testID,
}: SegmentedTabProps): React.ReactElement {
  const { t } = useTranslation();
  const [active, setActive] = useState<string>(segments[0]?.key ?? '');

  return (
    <RtlScreen safe className={SURFACE.page}>
      {/* rtl-ok */}
      <RtlRow
        accessibilityRole="tablist"
        className={`m-3 items-center rounded-xl border p-1 ${SURFACE.sunken} ${BORDER.hairline}`}
        testID={testID ?? 'segmented-control'}
      >
        {segments.map((segment) => {
          const selected = segment.key === active;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              className={`min-h-[44px] flex-1 items-center justify-center rounded-lg ${
                selected ? `${SURFACE.card} ${BORDER.hairline}` : ''
              }`}
              key={segment.key}
              onPress={(): void => setActive(segment.key)}
              testID={`segment-${segment.key}`}
            >
              <AppText
                className={`text-sm font-bold ${selected ? ACCENT.text : TEXT.secondary}`}
              >
                {t(segment.label)}
              </AppText>
            </Pressable>
          );
        })}
      </RtlRow>

      <View className="flex-1" testID={`segment-content-${active}`}>
        {render(active)}
      </View>
    </RtlScreen>
  );
}
