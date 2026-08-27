import React from 'react';
import { View } from 'react-native';

import { AppText } from './AppText';
import { ProvenanceChip } from './ProvenanceChip';
import { RtlRow } from './rtl';
import { SURFACE, TEXT } from '../theme/tokens';
import { useTranslation } from '../hooks/useTranslation';
import { ltrNumerals } from '../utils/calendar';
import { maskLast4 } from '../media/maskLast4';
import { resolveMedia } from '../media/resolveMedia';
import type { GeneratedContext, MediaRecord, MediaSubject } from '../media/types';

const PALETTE_CLASS = {
  neutral: SURFACE.card,
  accent: SURFACE.raised,
  raised: SURFACE.raised,
  sunken: SURFACE.sunken,
} as const;

export interface CardTileProps {
  readonly nickname: string;
  readonly last4?: string;
  readonly subject: MediaSubject;
  readonly mediaSet?: readonly MediaRecord[];
  readonly context?: GeneratedContext;
  readonly nicknameTestID?: string;
  readonly testID?: string;
}

/**
 * User-card tile: the resolver's generated (or generic) surface plus the masked
 * group built from last4 alone. Never a hard-coded image path (M5).
 */
export function CardTile({
  nickname,
  last4,
  subject,
  mediaSet,
  context,
  nicknameTestID,
  testID,
}: CardTileProps): React.ReactElement {
  const { t } = useTranslation();
  const resolution = resolveMedia(subject, mediaSet ?? [], {
    ...(context ? { context } : {}),
  });
  const spec = resolution?.generatedSpec;
  const palette = spec ? PALETTE_CLASS[spec.paletteKey] : SURFACE.card;
  const mask = maskLast4(last4);

  return (
    <View className={`rounded-lg border p-3 ${palette}`} testID={testID ?? 'card-tile'}>
      <View
        accessibilityLabel={resolution ? t(resolution.altTextKey) : t('ייצוג כללי של כרטיס')}
        className="h-16 rounded-md"
        testID="card-tile-surface"
      />
      {resolution?.kind === 'asset' ? (
        <RtlRow className="mt-2 items-center gap-2" testID="card-tile-attribution-row">
          {resolution.attribution ? (
            <AppText className={`text-xs ${TEXT.secondary}`} testID="card-tile-attribution">
              {resolution.attribution}
            </AppText>
          ) : null}
          <ProvenanceChip
            testID="card-tile-attribution-chip"
            view={{ chip: resolution.provenanceChip, stale: false }}
          />
        </RtlRow>
      ) : null}
      <AppText
        className={`mt-2 text-base font-bold ${TEXT.heading}`}
        testID={nicknameTestID ?? 'card-tile-nickname'}
      >
        {nickname}
      </AppText>
      {mask ? (
        <AppText className={`mt-1 text-sm ${TEXT.secondary}`} testID="card-tile-mask">
          {ltrNumerals(mask)}
        </AppText>
      ) : null}
    </View>
  );
}
