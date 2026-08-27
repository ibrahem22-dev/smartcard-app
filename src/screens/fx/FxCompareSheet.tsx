import React, { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import { RtlScreen } from '../../components/rtl';
import { useTranslation } from '../../hooks/useTranslation';
import type { FxComparison } from '../../engines/fx';
import { ACCENT, BORDER, ROLE_BORDER, ROLE_SURFACE_BG, ROLE_TEXT, SURFACE, TEXT } from '../../theme/tokens';

/**
 * FX COMPARE SHEET — criterion **X2** (spec §17).
 *
 * Paints `compareAbroad` output. Ranked rows stay in engine order (ascending
 * estimated total). Unknown-leg cards are listed separately and never ranked.
 * Deltas are omitted unless the engine supplied them — this file does not subtract.
 * The winner is ranked[0]; a floor reason is the engine's exemption, not a surface one.
 *
 * X3 (spec §17): the BOI reference-rate chip is a NEUTRAL badge. It is not the
 * dashed Estimate chip, and it is never labelled as the real card cost. The
 * Estimate chip sits on the "estimated real cost" heading. The settlement
 * caveat is persistent copy, not a computed number.
 *
 * X4: the expander paints the winner quote's engine fields and that quote's
 * own reason-trace steps. It does not subtract a markup ILS on the surface.
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
  const [explainerOpen, setExplainerOpen] = useState(false);
  const winnerId = comparison?.ranked[0]?.cardId;
  const winnerQuote = comparison?.ranked[0]?.quote;
  const rateUsed = winnerQuote?.rateUsed;
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
        {rateUsed ? (
          <View
            // rtl-ok: chip must not stretch; self-start is cross-axis, not reading direction
            className={`mt-3 self-start rounded-full border px-2 py-0.5 ${ROLE_SURFACE_BG.neutral} ${ROLE_BORDER.neutral}`}
            testID="fx-compare-reference"
          >
            <AppText
              accessibilityValue={{
                text: `${rateUsed.rateIlsPerQuoteUnit}|${rateUsed.rateDate}`,
              }}
              className={`text-xs font-bold ${ROLE_TEXT.neutral}`}
              testID="fx-compare-reference-rate"
            >
              {`${t('שער בנק ישראל')} ${rateUsed.rateIlsPerQuoteUnit} · ${rateUsed.rateDate}`}
            </AppText>
          </View>
        ) : null}
        <View className="mt-3" testID="fx-compare-estimate-heading">
          <AppText className={`text-sm font-bold ${TEXT.heading}`}>{t('עלות משוערת')}</AppText>
          <View
            // rtl-ok: dashed frame around the shared Estimate chip; self-start is cross-axis
            className={`mt-1 self-start rounded-full border border-dashed ${ROLE_BORDER.advisory}`}
            testID="fx-compare-estimate-frame"
          >
            <ProvenanceChip
              testID="fx-compare-estimate-chip"
              view={{ chip: 'ESTIMATE', stale: false }}
            />
          </View>
        </View>
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
        {winnerQuote ? (
          <View className="mt-4" testID="fx-compare-explainer">
            <AppText
              accessibilityRole="button"
              className={`text-sm font-bold ${TEXT.body}`}
              onPress={() => setExplainerOpen((open) => !open)}
              testID="fx-compare-explainer-toggle"
            >
              {t('איך זה מחושב')}
            </AppText>
            {explainerOpen ? (
              <View testID="fx-compare-explainer-body">
                <View testID="fx-compare-explainer-figures">
                <AppText
                  accessibilityValue={{ text: String(winnerQuote.referenceIls) }}
                  className={`mt-2 text-sm ${TEXT.body}`}
                  testID="fx-compare-explainer-base"
                >
                  {`${t('בסיס')} ₪${winnerQuote.referenceIls}`}
                </AppText>
                <AppText
                  accessibilityValue={{ text: String(winnerQuote.fxPercentApplied) }}
                  className={`mt-1 text-sm ${TEXT.body}`}
                  testID="fx-compare-explainer-markup"
                >
                  {`${t('עמלה')} ${winnerQuote.fxPercentApplied}`}
                </AppText>
                <AppText
                  accessibilityValue={{ text: String(winnerQuote.fixedFeeIlsApplied) }}
                  className={`mt-1 text-sm ${TEXT.body}`}
                  testID="fx-compare-explainer-fixed"
                >
                  {`${t('עמלה קבועה')} ₪${winnerQuote.fixedFeeIlsApplied}`}
                </AppText>
                <AppText
                  accessibilityValue={{ text: String(winnerQuote.effectiveIls) }}
                  className={`mt-1 text-sm ${TEXT.body}`}
                  testID="fx-compare-explainer-total"
                >
                  {`${t('סה״כ')} ₪${winnerQuote.effectiveIls}`}
                </AppText>
                <ProvenanceChip
                  testID="fx-compare-explainer-chip"
                  view={{ chip: winnerQuote.provenance, stale: false }}
                />
                </View>
                {winnerQuote.trace.steps.map((item, index) => (
                  <AppText
                    className={`mt-1 text-xs ${TEXT.muted}`}
                    key={`${item.rule}:${index}`}
                    testID={`fx-compare-explainer-step-${index}`}
                  >
                    {item.detail}
                  </AppText>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
        <AppText className={`mt-4 text-xs ${TEXT.muted}`} testID="fx-compare-settlement-caveat">
          {t('הערכה — ויזה ומאסטרקארד מיישבים לפי שערי הרשת שלהם, שעשויים להיות שונים משער בנק ישראל')}
        </AppText>
          </>
        )}
      </View>
    </RtlScreen>
  );
}
