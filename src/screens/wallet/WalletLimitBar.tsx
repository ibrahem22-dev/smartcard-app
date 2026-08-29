import React from 'react';
import { View } from 'react-native';

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
import { BORDER, ROLE_SURFACE_BG, SURFACE, TEXT } from '../../theme/tokens';
import { TABULAR_NUMERALS } from '../../utils/money';

export interface WalletLimitBarProps {
  readonly cardId: string;
  readonly context?: SurfaceContext;
}

/** A bounded presentation value for layout only; it is never formatted or announced as a figure. */
function limitFillFraction(available: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(1, Math.max(0, available / limit));
}

export function WalletLimitBar({
  cardId,
  context,
}: WalletLimitBarProps): React.ReactElement {
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
  const load = evaluateSurfaceEngines(context ?? fallbackContext).load;
  const position = load?.cardLimits.find((row) => row.cardId === cardId);

  if (position === undefined) {
    return (
      <View
        className={`rounded-lg border p-3 ${SURFACE.raised} ${BORDER.subtle}`}
        testID="wallet-limit-bar-unknown"
      >
        <AppText className={`text-sm ${TEXT.secondary}`}>
          {t('המסגרת הפנויה אינה ידועה')}
        </AppText>
      </View>
    );
  }

  /* `availableAfterEarlyPayoffIls`, not `availableBeforeChangesIls` — Owner ruling OQ-P5-001,
     2026-08-29. W2's sentence is "limit minus ACTIVE holds minus logged-this-cycle purchases", and a
     hold the user has paid early is not active. Reading the before-changes field made this bar the
     one surface that could not show a freed limit, which contract §J4 requires in as many words:
     the effect "must be visible in the same run to Wallet's limit bar and the Verdict's impact
     strip". It is still not `availableAfterChangesIls`: that one also subtracts a prospective Check
     purchase, which belongs to the Verdict's strip and not to Wallet. */
  const fillFraction = limitFillFraction(
    position.availableAfterEarlyPayoffIls.value,
    position.creditLimitIls.value,
  );

  return (
    <View className="gap-2 py-2">
      <RtlRow className="items-center justify-between gap-3">
        <AppText className={`flex-1 text-sm ${TEXT.body}`}>
          {t('מסגרת פנויה')}
        </AppText>
        <View className="gap-1">
          <AppText
            accessibilityValue={{
              text: String(position.availableAfterEarlyPayoffIls.value),
            }}
            className={`text-sm font-extrabold ${TEXT.heading}`}
            style={TABULAR_NUMERALS}
            testID="wallet-limit-bar-available"
          >
            {money(position.availableAfterEarlyPayoffIls.value)}
          </AppText>
          <ProvenanceChip
            testID="wallet-limit-bar-chip"
            view={{ chip: 'ESTIMATE', stale: false }}
          />
        </View>
      </RtlRow>

      <RtlRow
        accessibilityRole="progressbar"
        className={`h-2 w-full overflow-hidden rounded-full ${SURFACE.sunken}`}
        testID="wallet-limit-bar-track"
      >
        <View
          className={ROLE_SURFACE_BG.advisory}
          style={{
            flex: fillFraction,
          }}
          testID="wallet-limit-bar-fill"
        />
        <View
          style={{
            flex: 1 - fillFraction,
          }}
        />
      </RtlRow>
    </View>
  );
}
