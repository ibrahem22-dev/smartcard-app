import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { CardTile } from '../../components/CardTile';
import { RtlRow } from '../../components/rtl';
import { useMoney } from '../../hooks/useMoney';
import { useTranslation } from '../../hooks/useTranslation';
import { TEXT } from '../../theme/tokens';
import type { EngineCard } from '../../types/card.types';
import { ltrNumerals } from '../../utils/calendar';
import { TABULAR_NUMERALS } from '../../utils/money';

export interface CommitmentPaymentProgress {
  readonly position: number;
  readonly total: number;
}

export interface CommitmentRowProps {
  readonly id: string;
  readonly name: string;
  readonly monthlyIls: number;
  readonly paymentProgress?: CommitmentPaymentProgress;
  readonly linkedCard?: Pick<
    EngineCard,
    'cardId' | 'displayName' | 'issuer' | 'last4'
  >;
}

/** One commitment, displaying only figures and links carried into the row. */
export function CommitmentRow({
  id,
  name,
  monthlyIls,
  paymentProgress,
  linkedCard,
}: CommitmentRowProps): React.ReactElement {
  const { money } = useMoney();
  const { t } = useTranslation();
  const [detailUnbuiltVisible, setDetailUnbuiltVisible] = useState(false);

  return (
    <View className="mt-3" testID={`commitment-row-${id}`}>
      <RtlRow
        className="items-center gap-3"
        testID={`commitments-row-${id}`}
      >
        {linkedCard === undefined ? null : (
          <View className="w-28" testID={`commitment-row-${id}-card`}>
            <CardTile
              context={{ issuerId: linkedCard.issuer }}
              last4={linkedCard.last4}
              nickname={linkedCard.displayName}
              subject={{
                subjectKind: 'card',
                subjectId: linkedCard.cardId,
                fallbackClass: 'card',
              }}
            />
          </View>
        )}

        <View className="flex-1">
          <AppText
            className={`text-sm ${TEXT.body}`}
            testID={`commitment-row-${id}-name`}
          >
            {name}
          </AppText>
          <View
            accessibilityValue={{ text: String(monthlyIls) }}
            testID={`commitment-row-${id}-monthly`}
          >
            <AppText
              accessibilityValue={{ text: String(monthlyIls) }}
              className={`mt-1 text-sm font-bold ${TEXT.heading}`}
              style={TABULAR_NUMERALS}
              testID={`commitments-monthly-${id}`}
            >
              {money(monthlyIls)}
            </AppText>
          </View>
          {paymentProgress === undefined ? null : (
            <AppText
              className={`mt-1 text-xs ${TEXT.secondary}`}
              style={TABULAR_NUMERALS}
              testID={`commitment-row-${id}-remaining`}
            >
              {ltrNumerals(`${paymentProgress.position}/${paymentProgress.total}`)}
            </AppText>
          )}
        </View>

        <Pressable
          accessibilityLabel={t('פתיחת פרטי התחייבות')}
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
          onPress={(): void => setDetailUnbuiltVisible(true)}
          testID={`commitment-row-${id}-chevron`}
        >
          <AppText className={`text-xl ${TEXT.secondary}`}>›</AppText>
        </Pressable>
      </RtlRow>

      {detailUnbuiltVisible ? (
        <AppText
          className={`mt-2 text-xs ${TEXT.muted}`}
          testID={`commitment-row-${id}-detail-unbuilt`}
        >
          {t('פרטי ההתחייבות עדיין לא נבנו')}
        </AppText>
      ) : null}
    </View>
  );
}
