import React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import { RtlRow } from '../../components/rtl';
import { useMoney } from '../../hooks/useMoney';
import { useTranslation } from '../../hooks/useTranslation';
import { useActivityStore } from '../../store/useActivityStore';
import { useCardsStore } from '../../store/useCardsStore';
import { useLoansStore } from '../../store/useLoansStore';
import { useUserStore } from '../../store/useUserStore';
import { evaluateSurfaceEngines, type SurfaceContext } from '../../surfaces';
import { usePaidEarly } from '../../surfaces/usePaidEarly';
import { BORDER, SURFACE, TEXT } from '../../theme/tokens';
import { TABULAR_NUMERALS } from '../../utils/money';

export interface CommitmentDetailSheetProps {
  readonly id: string;
  readonly linkedCardId?: string;
  readonly context?: SurfaceContext;
}

/** Detail for one commitment. Paid early changes the shared engine input and paints its result. */
export function CommitmentDetailSheet({
  id,
  linkedCardId,
  context,
}: CommitmentDetailSheetProps): React.ReactElement {
  const { t } = useTranslation();
  const { money } = useMoney();
  const storedCards = useCardsStore((state) => state.cards);
  const storedInstallments = useCardsStore((state) => state.obligations);
  const storedLoans = useLoansStore((state) => state.loans);
  const storedPurchases = useActivityStore((state) => state.purchases);
  const storedProfile = useUserStore((state) => state.profile);
  const fallbackContext: SurfaceContext = {
    asOfDate: '1970-01-01',
    throughDate: '1970-01-01',
    profile: storedProfile,
    cards: storedCards,
    installments: storedInstallments,
    loans: storedLoans,
    purchases: storedPurchases,
  };
  const {
    context: activeContext,
    markPaidEarly,
    paidEarlyCommitmentIds,
  } = usePaidEarly(context ?? fallbackContext);
  const load = evaluateSurfaceEngines(activeContext).load;
  const released = linkedCardId === undefined
    ? undefined
    : load?.cardLimits.find((position) => position.cardId === linkedCardId)
      ?.releasedByEarlyPayoffIls;
  const isPaidEarly = paidEarlyCommitmentIds.includes(id);

  return (
    <View
      className={`mt-3 gap-3 rounded-lg border p-4 ${SURFACE.raised} ${BORDER.subtle}`}
      testID={`commitment-detail-${id}`}
    >
      <AppText className={`text-base font-extrabold ${TEXT.heading}`}>
        {t('פרטי התחייבות')}
      </AppText>
      <Pressable
        accessibilityRole="button"
        className="min-h-[44px] justify-center"
        onPress={(): void => markPaidEarly(id)}
        testID={`commitment-detail-${id}-paid-early`}
      >
        <AppText className={`text-sm font-bold ${TEXT.body}`}>
          {t('שולם מוקדם')}
        </AppText>
      </Pressable>
      {!isPaidEarly || released === undefined ? null : (
        <RtlRow className="items-center justify-between gap-3">
          <AppText className={`flex-1 text-sm ${TEXT.body}`}>
            {t('מסגרת ששוחררה בתשלום מוקדם')}
          </AppText>
          <View className="gap-1">
            <AppText
              accessibilityValue={{ text: String(released.value) }}
              className={`text-sm font-extrabold ${TEXT.heading}`}
              style={TABULAR_NUMERALS}
              testID={`commitment-detail-${id}-freed`}
            >
              {money(released.value)}
            </AppText>
            <ProvenanceChip
              testID={`commitment-detail-${id}-freed-provenance`}
              view={{ chip: released.provenance, stale: false }}
            />
          </View>
        </RtlRow>
      )}
    </View>
  );
}
