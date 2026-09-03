import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import { RtlRow } from '../../components/rtl';
import { useMoney } from '../../hooks/useMoney';
import { useTranslation, type UseTranslationResult } from '../../hooks/useTranslation';
import { useActivityStore } from '../../store/useActivityStore';
import { useCardsStore } from '../../store/useCardsStore';
import { useLoansStore } from '../../store/useLoansStore';
import { useUserStore } from '../../store/useUserStore';
import {
  evaluateSurfaceEngines,
  type SurfaceContext,
  type SurfaceEngineAbsence,
} from '../../surfaces';
import { safeToCommitFrom } from '../../surfaces/safeToCommit';
import { ACCENT, BORDER, SURFACE, TEXT } from '../../theme/tokens';
import { TABULAR_NUMERALS } from '../../utils/money';

export interface HomeHeroProps {
  readonly context?: SurfaceContext;
}

function absenceText(
  absence: SurfaceEngineAbsence | undefined,
  t: UseTranslationResult['t'],
): string {
  switch (absence?.because) {
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
    case undefined:
      return t('לא הוזנה הכנסה חודשית; ליחס העומס אין מכנה');
  }
}

export function HomeHero({ context }: HomeHeroProps): React.ReactElement {
  const { t } = useTranslation();
  const { money } = useMoney();
  const [explanationVisible, setExplanationVisible] = useState(false);
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
  const results = evaluateSurfaceEngines(context ?? fallbackContext);
  const safeToCommit = safeToCommitFrom(results);

  if (safeToCommit === null) {
    const loadAbsence = results.absent.find((item) => item.engine === 'load');
    return (
      <View
        className={`mb-4 gap-2 rounded-lg border p-4 ${BORDER.hairline} ${SURFACE.card}`}
        testID="home-hero"
      >
        <AppText className={`text-lg font-extrabold ${TEXT.heading}`}>
          {t('בטוח להתחייב החודש')}
        </AppText>
        <AppText className={`text-sm leading-5 ${TEXT.secondary}`} testID="home-hero-absent">
          {absenceText(loadAbsence, t)}
        </AppText>
      </View>
    );
  }

  return (
    <View
      className={`mb-4 gap-3 rounded-lg border p-4 ${ACCENT.borderSubtle} ${ACCENT.surface}`}
      testID="home-hero"
    >
      <AppText className={`text-lg font-extrabold ${TEXT.heading}`}>
        {t('בטוח להתחייב החודש')}
      </AppText>
      <AppText
        accessibilityValue={{ text: String(safeToCommit.amountIls) }}
        className={`text-data-xl font-black ${TEXT.heading}`}
        style={TABULAR_NUMERALS}
        testID="home-hero-amount"
      >
        {money(safeToCommit.amountIls)}
      </AppText>
      <RtlRow className="items-center gap-2" testID="home-hero-chip">
        <ProvenanceChip view={{ chip: 'ESTIMATE', stale: false }} />
        <AppText className={`text-xs font-bold ${TEXT.secondary}`}>
          {t('מהנתונים שלך')}
        </AppText>
      </RtlRow>
      <Pressable
        accessibilityRole="button"
        className="min-h-[44px] justify-center"
        onPress={() => setExplanationVisible((visible) => !visible)}
        testID="home-hero-explain"
      >
        <AppText className={`text-sm font-bold ${TEXT.body}`}>
          {t('לחצו כדי לראות ממה הסכום מורכב')}
        </AppText>
      </Pressable>
      {explanationVisible ? (
        <AppText
          className={`text-sm leading-5 ${TEXT.secondary}`}
          testID="home-hero-explanation"
        >
          {t(
            'הכנסה {{income}} מהפרופיל שלך, פחות התחייבויות {{obligations}} שמנוע העומס אסף למחזור הזה, פחות כרית ביטחון {{buffer}} מהגדרת האפליקציה.',
            {
              income: money(safeToCommit.incomeIls),
              obligations: money(safeToCommit.obligationsIls),
              buffer: money(safeToCommit.bufferIls),
            },
          )}
        </AppText>
      ) : null}
    </View>
  );
}
