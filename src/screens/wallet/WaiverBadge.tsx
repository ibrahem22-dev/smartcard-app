import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import { useTranslation } from '../../hooks/useTranslation';
import {
  ROLE_BORDER,
  ROLE_SURFACE_BG,
  ROLE_TEXT,
} from '../../theme/tokens';
import type { CardInput } from '../../types/card.types';

const DAY_IN_MS = 24 * 60 * 60 * 1_000;

export interface WaiverBadgeProps {
  readonly card?: CardInput;
  readonly now?: Date;
}

function waiverExpiry(card: CardInput | undefined): Date | null {
  if (
    card?.cardFee?.discountPercent !== 100
    || card.cardFee.discountEndDate === undefined
  ) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    card.cardFee.discountEndDate,
  );
  if (match === null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const expiry = new Date(Date.UTC(year, month, day));

  return expiry.getUTCFullYear() === year
    && expiry.getUTCMonth() === month
    && expiry.getUTCDate() === day
    ? expiry
    : null;
}

export function WaiverBadge({
  card,
  now = new Date(),
}: WaiverBadgeProps): React.ReactElement | null {
  const { t } = useTranslation();
  const expiry = waiverExpiry(card);

  if (expiry === null) {
    return null;
  }

  const remainingDays = Math.max(
    0,
    Math.ceil((expiry.getTime() - now.getTime()) / DAY_IN_MS),
  );

  return (
    <View
      className={`rounded-full border px-3 py-1 ${ROLE_SURFACE_BG.advisory} ${ROLE_BORDER.advisory}`}
      testID="wallet-waiver-badge"
    >
      <AppText
        accessibilityValue={{ text: String(remainingDays) }}
        className={`text-xs font-bold ${ROLE_TEXT.advisory}`}
        testID="wallet-waiver-badge-countdown"
      >
        {t('{{count}} ימים נותרו לפטור מדמי הכרטיס', {
          count: remainingDays,
        })}
      </AppText>
    </View>
  );
}
