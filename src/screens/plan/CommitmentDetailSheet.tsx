import React from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import { RtlRow } from '../../components/rtl';
import { useMoney } from '../../hooks/useMoney';
import { useTranslation } from '../../hooks/useTranslation';
import { useActivityStore } from '../../store/useActivityStore';
import { useCardsStore } from '../../store/useCardsStore';
import { useLoansStore } from '../../store/useLoansStore';
import { useUserStore } from '../../store/useUserStore';
import {
  deletePurchaseLifecycle,
  editPurchaseLifecycle,
  type PurchaseLifecycleMutationActions,
} from '../../services/purchaseLifecycle';
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
  const updatePurchase = useActivityStore((state) => state.updatePurchase);
  const deletePurchase = useActivityStore((state) => state.deletePurchase);
  const replaceActivity = useActivityStore((state) => state.replaceActivity);
  const updateObligation = useCardsStore((state) => state.updateObligation);
  const deleteObligation = useCardsStore((state) => state.deleteObligation);
  const replaceObligations = useCardsStore((state) => state.replaceObligations);
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
  const purchaseObligation = storedInstallments.find(
    (row) => row.installmentId === id && row.source === 'purchase',
  );
  const [draftTotal, setDraftTotal] = React.useState(
    purchaseObligation === undefined ? '' : String(purchaseObligation.totalAmount),
  );
  const [draftRemaining, setDraftRemaining] = React.useState(
    purchaseObligation === undefined ? '' : String(purchaseObligation.monthsRemaining),
  );
  const [lifecycleFailure, setLifecycleFailure] = React.useState<string | null>(null);
  const actions: PurchaseLifecycleMutationActions = {
    getPurchases: () => useActivityStore.getState().purchases,
    getVerdicts: () => useActivityStore.getState().verdicts,
    getObligations: () => useCardsStore.getState().obligations,
    updatePurchase,
    deletePurchase,
    replaceActivity,
    updateObligation,
    deleteObligation,
    replaceObligations,
  };

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
      {purchaseObligation === undefined ? null : (
        <View className="gap-2" testID={`commitment-detail-${id}-purchase-lifecycle`}>
          <AppText className={`text-sm font-bold ${TEXT.body}`}>{t('עריכת תוכנית תשלומים')}</AppText>
          <TextInput
            accessibilityLabel={t('סכום כולל')}
            keyboardType="decimal-pad"
            onChangeText={setDraftTotal}
            testID={`commitment-detail-${id}-total-input`}
            value={draftTotal}
          />
          <TextInput
            accessibilityLabel={t('מספר תשלומים שנותרו')}
            keyboardType="number-pad"
            onChangeText={setDraftRemaining}
            testID={`commitment-detail-${id}-remaining-input`}
            value={draftRemaining}
          />
          <Pressable
            accessibilityRole="button"
            onPress={(): void => {
              const edited = editPurchaseLifecycle({
                activityId: purchaseObligation.loggedPurchaseActivityId as string,
                totalAmountIls: Number(draftTotal),
                monthsRemaining: Number(draftRemaining),
                actions,
              });
              setLifecycleFailure(edited.ok ? null : `${edited.reason}: ${edited.detail}`);
            }}
            testID={`commitment-detail-${id}-save`}
          >
            <AppText className={`text-sm font-bold ${TEXT.body}`}>{t('שמירת שינויים')}</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={(): void => {
              const deleted = deletePurchaseLifecycle(
                purchaseObligation.loggedPurchaseActivityId as string,
                actions,
              );
              setLifecycleFailure(deleted.ok ? null : `${deleted.reason}: ${deleted.detail}`);
            }}
            testID={`commitment-detail-${id}-delete`}
          >
            <AppText className={`text-sm font-bold ${TEXT.body}`}>
              {t('מחיקת הרכישה וההתחייבות')}
            </AppText>
          </Pressable>
          {lifecycleFailure === null ? null : (
            <AppText className={`text-xs ${TEXT.muted}`} testID={`commitment-detail-${id}-failure`}>
              {lifecycleFailure}
            </AppText>
          )}
        </View>
      )}
    </View>
  );
}
