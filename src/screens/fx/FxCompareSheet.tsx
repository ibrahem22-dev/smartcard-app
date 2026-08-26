import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import { RtlScreen } from '../../components/rtl';
import { useTranslation } from '../../hooks/useTranslation';
import type { FxComparison } from '../../engines/fx';
import { ACCENT, BORDER, SURFACE, TEXT } from '../../theme/tokens';

/**
 * FX COMPARE SHEET — criterion **X2** (spec §17).
 *
 * Paints `compareAbroad` output. Ranked rows stay in engine order (ascending
 * estimated total). Unknown-leg cards are listed separately and never ranked.
 * Deltas are omitted unless the engine supplied them — this file does not subtract.
 * The winner is ranked[0]; a floor reason is the engine's exemption, not a surface one.
 */

export interface FxCompareSheetProps {
  readonly comparison?: FxComparison;
  readonly displayNames?: Readonly<Record<string, string>>;
}

export function FxCompareSheet({
  comparison,
  displayNames,
}: FxCompareSheetProps): React.ReactElement {
  const { t } = useTranslation();
  const winnerId = comparison?.ranked[0]?.cardId;
  const nameOf = (cardId: string): string => displayNames?.[cardId] ?? cardId;

  return (
    <RtlScreen className={SURFACE.page} safe>
      <View className={`m-3 rounded-lg border p-4 ${SURFACE.card} ${BORDER.hairline}`}>
        <AppText className={`text-lg font-extrabold ${TEXT.heading}`} testID="fx-compare-title">
          {t('השוואת מטח')}
        </AppText>
        {!comparison ? (
          <AppText className={`mt-3 text-sm ${TEXT.muted}`} testID="fx-compare-empty">
            {t('אין השוואה עדיין')}
          </AppText>
        ) : (
          <>
        <View testID="fx-compare-ranked">
          {comparison.ranked.map((entry) => {
            const winner = entry.cardId === winnerId;
            return (
              <View
                className={`mt-3 rounded-lg border p-3 ${
                  winner ? `${ACCENT.surface} ${ACCENT.border}` : `${SURFACE.sunken} ${BORDER.hairline}`
                }`}
                key={entry.cardId}
                testID={`fx-compare-row-${entry.cardId}`}
              >
                <AppText className={`text-base font-bold ${TEXT.body}`}>
                  {nameOf(entry.cardId)}
                </AppText>
                {winner ? (
                  <AppText className={`mt-1 text-xs font-bold ${ACCENT.text}`} testID="fx-compare-winner">
                    {t('המנצחת')}
                  </AppText>
                ) : null}
                {entry.floor ? (
                  <AppText
                    className={`mt-1 text-xs ${TEXT.muted}`}
                    testID={`fx-compare-exemption-${entry.cardId}`}
                  >
                    {entry.floor.reason}
                  </AppText>
                ) : null}
                <AppText
                  accessibilityValue={{ text: String(entry.quote.effectiveIls) }}
                  className={`mt-1 text-sm ${TEXT.body}`}
                  testID={`fx-compare-total-${entry.cardId}`}
                >
                  {`₪${entry.quote.effectiveIls}`}
                </AppText>
                <ProvenanceChip
                  testID={`fx-compare-total-${entry.cardId}-chip`}
                  view={{ chip: entry.quote.provenance, stale: false }}
                />
              </View>
            );
          })}
        </View>
        {comparison.unknownCards.length > 0 ? (
          <View className="mt-4" testID="fx-compare-unknown">
            <AppText className={`text-sm font-bold ${TEXT.secondary}`}>
              {t('כרטיסים בלי רגל מטח')}
            </AppText>
            {comparison.unknownCards.map((cardId) => (
              <AppText
                className={`mt-1 text-sm ${TEXT.muted}`}
                key={cardId}
                testID={`fx-compare-unknown-${cardId}`}
              >
                {nameOf(cardId)}
              </AppText>
            ))}
          </View>
        ) : null}
          </>
        )}
      </View>
    </RtlScreen>
  );
}
