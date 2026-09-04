import React, { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import { RtlRow } from '../../components/rtl';
import { useMoney } from '../../hooks/useMoney';
import { useTranslation, type UseTranslationResult } from '../../hooks/useTranslation';
import { useActivityStore } from '../../store/useActivityStore';
import { useCardsStore } from '../../store/useCardsStore';
import { useLoansStore } from '../../store/useLoansStore';
import { useUserStore } from '../../store/useUserStore';
import { suggestedCommitmentCapIls } from '../../surfaces/commitmentCap';
import {
  evaluateSurfaceEngines,
  type SurfaceContext,
  type SurfaceEngineAbsence,
} from '../../surfaces';
import {
  BORDER,
  ROLE_SURFACE_BG,
  SURFACE,
  TEXT,
} from '../../theme/tokens';
import { loadBandLabelKey } from '../../theme/riskPresentation';
import { TABULAR_NUMERALS } from '../../utils/money';

export interface CommitmentsSummaryProps {
  readonly context?: SurfaceContext;
}

const LOAD_BAND_FILL = {
  safe: ROLE_SURFACE_BG.neutral,
  warning: ROLE_SURFACE_BG.advisory,
  strong_warning: ROLE_SURFACE_BG.advisory,
  blocked: ROLE_SURFACE_BG.danger,
} as const;

function absenceText(
  because: SurfaceEngineAbsence['because'],
  t: UseTranslationResult['t'],
): string {
  switch (because) {
    case 'NO_PROFILE':
      return t('לא נטען פרופיל מהכספת, ולכן אין הכנסה שאפשר למדוד מולה');
    case 'NO_INCOME':
      return t('לא הוזנה הכנסה חודשית; ליחס העומס אין מכנה');
    case 'LOAD_UNAVAILABLE':
      return t('תוצאת העומס אינה זמינה');
    case 'NO_CARDS':
      return t('אין כרטיסים בכספת');
    case 'NO_BILLING_DATES':
      return t('אין מועדי חיוב זמינים');
  }
}

export function CommitmentsSummary({
  context,
}: CommitmentsSummaryProps): React.ReactElement {
  const { t } = useTranslation();
  const { money, percent } = useMoney();
  const storedCards = useCardsStore((state) => state.cards);
  const storedInstallments = useCardsStore((state) => state.obligations);
  const storedLoans = useLoansStore((state) => state.loans);
  const storedPurchases = useActivityStore((state) => state.purchases);
  const storedProfile = useUserStore((state) => state.profile);
  const setCommitmentCapIls = useUserStore((state) => state.setCommitmentCapIls);

  const fallbackContext: SurfaceContext = {
    asOfDate: '1970-01-01',
    throughDate: '1970-01-01',
    profile: storedProfile,
    cards: storedCards,
    installments: storedInstallments,
    loans: storedLoans,
    purchases: storedPurchases,
  };
  const results = evaluateSurfaceEngines(context ?? fallbackContext);
  const load = results.load;
  const loadAbsence = results.absent.find((item) => item.engine === 'load');
  const whyUnavailable = loadAbsence === undefined
    ? t('תוצאת העומס אינה זמינה')
    : absenceText(loadAbsence.because, t);
  const suggestedCap = suggestedCommitmentCapIls(results);
  const userCap = storedProfile?.commitmentCapIls
    ?? results.context.profile?.commitmentCapIls;
  const [draftCap, setDraftCap] = useState(userCap === undefined ? '' : String(userCap));

  useEffect(() => {
    setDraftCap(userCap === undefined ? '' : String(userCap));
  }, [userCap]);

  const parsedDraft = Number(draftCap);
  const canSave = draftCap.trim().length > 0
    && Number.isFinite(parsedDraft)
    && parsedDraft >= 0;
  const saveCap = (): void => {
    if (!canSave) return;
    setCommitmentCapIls(parsedDraft);
  };

  const fillFraction = load === null
    ? 0
    : Math.min(1, Math.max(0, load.current.ratioOfIncome.value));

  return (
    <View
      className={`mb-4 gap-4 rounded-lg border p-4 ${SURFACE.card} ${BORDER.hairline}`}
      testID="commitments-summary"
    >
      <View className="gap-1" testID="commitments-summary-total-section">
        <AppText className={`text-sm font-bold ${TEXT.body}`}>
          {t('סך ההתחייבויות החודשיות')}
        </AppText>
        {load === null ? (
          <AppText
            className={`text-sm ${TEXT.secondary}`}
            testID="commitments-summary-total-absence"
          >
            {whyUnavailable}
          </AppText>
        ) : (
          <RtlRow className="items-center gap-2">
            <AppText
              accessibilityValue={{ text: String(load.current.monthlyObligationsIls.value) }}
              className={`text-h1 font-black ${TEXT.heading}`}
              style={TABULAR_NUMERALS}
              testID="commitments-summary-total"
            >
              {money(load.current.monthlyObligationsIls.value)}
            </AppText>
            <ProvenanceChip
              testID="commitments-summary-total-chip"
              view={{ chip: load.current.monthlyObligationsIls.provenance, stale: false }}
            />
          </RtlRow>
        )}
      </View>

      <View className="gap-2" testID="commitments-summary-load-section">
        <AppText className={`text-sm font-bold ${TEXT.body}`}>
          {t('עומס מול הכנסה')}
        </AppText>
        {load === null ? (
          <AppText
            className={`text-sm ${TEXT.secondary}`}
            testID="commitments-summary-load-absence"
          >
            {whyUnavailable}
          </AppText>
        ) : (
          <>
            <RtlRow className="items-center justify-between gap-2">
              <AppText
                accessibilityValue={{ text: String(load.current.ratioOfIncome.value) }}
                className={`text-lg font-extrabold ${TEXT.heading}`}
                style={TABULAR_NUMERALS}
                testID="commitments-summary-load-ratio"
              >
                {percent(load.current.ratioOfIncome.value)}
              </AppText>
              <AppText
                accessibilityValue={{ text: t(loadBandLabelKey(load.current.band)) }}
                className={`text-sm ${TEXT.secondary}`}
                testID="commitments-summary-load-band"
              >
                {t('רצועת עומס')}: {t(loadBandLabelKey(load.current.band))}
              </AppText>
            </RtlRow>
            <RtlRow
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 0,
                max: 1,
                now: load.current.ratioOfIncome.value,
                text: String(load.current.ratioOfIncome.value),
              }}
              className={`h-3 w-full overflow-hidden rounded-full ${SURFACE.sunken}`}
              testID="commitments-summary-load-bar"
            >
              <View
                className={LOAD_BAND_FILL[load.current.band]}
                style={{ flex: fillFraction }}
                testID="commitments-summary-load-fill"
              />
              <View style={{ flex: 1 - fillFraction }} />
            </RtlRow>
            <RtlRow className="justify-between gap-2">
              <AppText
                accessibilityValue={{ text: String(load.thresholds.warningRatio.value) }}
                className={`text-xs ${TEXT.muted}`}
                style={TABULAR_NUMERALS}
                testID="commitments-summary-threshold-warning"
              >
                {t('סף אזהרה')} {percent(load.thresholds.warningRatio.value)}
              </AppText>
              <AppText
                accessibilityValue={{ text: String(load.thresholds.strongWarningRatio.value) }}
                className={`text-xs ${TEXT.muted}`}
                style={TABULAR_NUMERALS}
                testID="commitments-summary-threshold-strong-warning"
              >
                {t('סף אזהרה חזקה')} {percent(load.thresholds.strongWarningRatio.value)}
              </AppText>
              <AppText
                accessibilityValue={{ text: String(load.thresholds.blockedRatio.value) }}
                className={`text-xs ${TEXT.muted}`}
                style={TABULAR_NUMERALS}
                testID="commitments-summary-threshold-blocked"
              >
                {t('סף חסימה')} {percent(load.thresholds.blockedRatio.value)}
              </AppText>
            </RtlRow>
          </>
        )}
      </View>

      <View className="gap-2" testID="commitments-summary-cap">
        <AppText className={`text-sm font-bold ${TEXT.body}`}>
          {t('תקרת התחייבויות חודשית')}
        </AppText>
        {userCap === undefined ? (
          suggestedCap === null ? (
            <AppText
              className={`text-sm ${TEXT.secondary}`}
              testID="commitments-summary-cap-absence"
            >
              {whyUnavailable}
            </AppText>
          ) : (
            <RtlRow className="items-center gap-2" testID="commitments-summary-cap-suggested">
              <AppText
                accessibilityValue={{ text: String(suggestedCap) }}
                className={`text-sm ${TEXT.secondary}`}
                style={TABULAR_NUMERALS}
                testID="commitments-summary-cap-suggested-value"
              >
                {t('הצעה לפי סף האזהרה החזקה')}: {money(suggestedCap)}
              </AppText>
              <ProvenanceChip
                testID="commitments-summary-cap-suggested-chip"
                view={{ chip: 'ESTIMATE', stale: false }}
              />
            </RtlRow>
          )
        ) : (
          <RtlRow className="items-center gap-2" testID="commitments-summary-cap-user">
            <AppText
              accessibilityValue={{ text: String(userCap) }}
              className={`text-lg font-extrabold ${TEXT.heading}`}
              style={TABULAR_NUMERALS}
              testID="commitments-summary-cap-user-value"
            >
              {money(userCap)}
            </AppText>
            <ProvenanceChip
              testID="commitments-summary-cap-user-chip"
              view={{ chip: 'USER', stale: false }}
            />
          </RtlRow>
        )}
        <RtlRow className="items-center gap-2">
          <TextInput
            accessibilityLabel={t('הכנס תקרה בשקלים')}
            className={`min-h-[48px] flex-1 rounded-lg border px-3 ${BORDER.hairline}`}
            keyboardType="decimal-pad"
            onChangeText={setDraftCap}
            placeholder={suggestedCap === null ? undefined : String(suggestedCap)}
            testID="commitments-summary-cap-input"
            value={draftCap}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave }}
            className="min-h-[48px] justify-center px-3"
            disabled={!canSave}
            onPress={saveCap}
            testID="commitments-summary-cap-save"
          >
            <AppText className={`text-sm font-bold ${TEXT.body}`}>
              {t('שמירה')}
            </AppText>
          </Pressable>
        </RtlRow>
      </View>
    </View>
  );
}
