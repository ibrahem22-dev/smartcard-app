import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { CardTile } from '../../components/CardTile';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import type { ChipView } from '../../components/provenanceChipState';
import { RtlRow } from '../../components/rtl';
import { useMoney } from '../../hooks/useMoney';
import { useTranslation } from '../../hooks/useTranslation';
import { TEXT } from '../../theme/tokens';
import type { EngineCard } from '../../types/card.types';
import { ltrNumerals } from '../../utils/calendar';
import { TABULAR_NUMERALS } from '../../utils/money';
import type { SurfaceContext } from '../../surfaces';
import { CommitmentDetailSheet } from './CommitmentDetailSheet';

export interface CommitmentPaymentProgress {
  readonly position: number;
  readonly total: number;
}

export interface CommitmentRowProps {
  readonly id: string;
  readonly name: string;
  readonly monthlyIls: number;
  readonly monthlyChipView?: ChipView;
  readonly monthlyAsOfDate?: string;
  readonly paymentProgress?: CommitmentPaymentProgress;
  readonly linkedCard?: Pick<
    EngineCard,
    'cardId' | 'displayName' | 'issuer' | 'last4'
  >;
  readonly context?: SurfaceContext;
}

/** One commitment, displaying only figures and links carried into the row. */
export function CommitmentRow({
  id,
  name,
  monthlyIls,
  monthlyChipView,
  monthlyAsOfDate,
  paymentProgress,
  linkedCard,
  context,
}: CommitmentRowProps): React.ReactElement {
  const { money } = useMoney();
  const { t } = useTranslation();
  const [detailVisible, setDetailVisible] = useState(false);

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
            {monthlyChipView === undefined ? null : (
              <ProvenanceChip
                {...(monthlyAsOfDate === undefined ? {} : { asOfDate: monthlyAsOfDate })}
                testID={`commitment-row-${id}-provenance`}
                view={monthlyChipView}
              />
            )}
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
          className="min-h-[48px] min-w-[48px] items-center justify-center"
          onPress={(): void => setDetailVisible(true)}
          testID={`commitment-row-${id}-chevron`}
        >
          <AppText className={`text-xl ${TEXT.secondary}`}>›</AppText>
        </Pressable>
      </RtlRow>

      {detailVisible ? (
        <View testID={`commitment-row-${id}-detail-unbuilt`}>
          <CommitmentDetailSheet
            id={id}
            {...(context === undefined ? {} : { context })}
            {...(linkedCard === undefined ? {} : { linkedCardId: linkedCard.cardId })}
          />
        </View>
      ) : null}
    </View>
  );
}
