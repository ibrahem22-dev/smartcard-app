import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import { CardTile } from '../../components/CardTile';
import { NotYetSurface } from '../../components/NotYetSurface';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import type { ChipView } from '../../components/provenanceChipState';
import { RtlButton, RtlRow, RtlScreen } from '../../components/rtl';
import { useActivityStore } from '../../store/useActivityStore';
import type { LoggedPurchase } from '../../types/activity.types';
import { writeLoggedPurchase, writeVerdictHistory } from '../../check/activityMapper';
import { useTranslation } from '../../hooks/useTranslation';
import { FxCompareFromCheckVerdict } from '../fx/FxCompareFromCheckVerdict';
import type { ConvertedAmount } from '../../engines/currency';
import type { FxComparison } from '../../engines/fx';
import type { ProvenancedNumber } from '../../engines/provenance';
import type { ReasonTrace } from '../../engines/reasonTrace';
import type { RecommendationEmphasis } from '../../check/recommendation';
import type { ImpactBullet, PurchaseVerdict, PurchaseVerdictResult } from '../../engines/verdict';
import type { SemanticRole } from '../../theme/tokens';
import { ACCENT, BORDER, ROLE_SURFACE, ROLE_TEXT, SURFACE, TEXT } from '../../theme/tokens';

/**
 * CHECK VERDICT — criteria **D1** (four states) and **D2** (one computation).
 *
 *   > **D1.** *"Exactly four verdict states render, each carrying an icon and a word as well
 *   > as a colour."*  (spec §9; colour is never the only carrier)
 *   > **D2.** *"The pill and the Financial Impact panel come from ONE engine computation."*
 *
 * A result is an ENGINE OUTPUT. This screen does not compute one. It paints `result.verdict`
 * as the pill and `result.financialImpact.bullets` as the panel. Those are fields of the
 * same object `runPurchaseCheck` returned. A second path that decided the pill from the
 * panel's numbers (or the other way around) is the Stitch defect — "Good to go" at 41%
 * against a 35% threshold — and D2's gate exists to make that fail.
 *
 * Layout order (D3) is spec §9 top to bottom among sections that exist:
 * pill · context line · Financial Impact · recommendation (D4) · runner-up (D5)
 * · FX block (D6) · impact strip + freshness (D7) · a provenance chip on every
 * numeric claim (D8). A section that is not built yet is omitted, not faked.
 *
 * D4: the recommendation hero is the card tile + "Best for this purchase" (+ a
 * reason line only when an engine supplies one). Match Score is a small
 * secondary chip with an explainer — never a bare hero number. The score is
 * `recommendation.matchScore` from `scoreCards`; this file does not rank.
 *
 * Colour roles come from the token module (A8). Wait uses **neutral / slate**, which is
 * spec §9's word for that state and A8's fourth (non-judgement) role — not a fifth hue.
 *
 * B1: this file must not compare a load to a threshold, name threshold math, or call
 * the engine. Painting an engine number, including scaling a ratio for display, is not
 * a recommendation.
 */

export interface CheckVerdictScreenProps {
  /** The one object `runPurchaseCheck` returned. Absent: nothing to paint yet. */
  readonly result?: PurchaseVerdictResult;
  /**
   * Spec §9 context line: ₪ amount · category · payment plan. User-entered
   * figures, not engine output. Absent: the line is omitted rather than invented.
   */
  readonly contextLine?: {
    readonly amount: number;
    readonly currencySymbol: string;
    readonly categoryLabel: string | null;
    readonly installmentCount: number;
  };
  /**
   * Spec §9 recommendation block. Engine output, not a surface ranking.
   * Absent: the block is omitted rather than invented (no cards / not scored yet).
   *
   * `emphasis` IS DECIDED AT THE COMPOSITION BOUNDARY, NOT HERE — Owner ruling OQ-P5-002. For a
   * DON'T-BUY verdict the recommendation must not visually override the purchase decision, and
   * WHICH verdicts subordinate it is recommendation logic, which B1 keeps off this surface. This
   * screen renders what it is told. Absent means `primary`, which is what every pre-ruling caller
   * meant and what the four render suites that predate the ruling still pass.
   */
  readonly recommendation?: {
    readonly displayName: string;
    readonly matchScore: ProvenancedNumber;
    readonly emphasis?: RecommendationEmphasis;
    readonly reasons?: ReasonTrace;
  };
  /**
   * Spec §9 runner-up. `deltaFromBestIls` is painted only when the scoring
   * engine supplied it. Absent field: no delta, never a surface subtraction.
   */
  readonly runnerUp?: {
    readonly displayName: string;
    readonly deltaFromBestIls?: ProvenancedNumber;
  };
  /**
   * Spec §9 FX block. Engine quote from `compareAbroad` for a foreign purchase.
   * Absent (shekel spine / not foreign): the block is omitted rather than invented.
   */
  readonly fxBlock?: {
    readonly quote: ConvertedAmount;
  };
  /**
   * X1: the Check Verdict entry that opens the canonical FX Compare sheet.
   * Absent: the sheet is omitted rather than invented. The D6 quote block is
   * not this sheet.
   */
  readonly fxComparison?: FxComparison;
  /**
   * Spec §9 impact strip. Available limit after the purchase, from the load
   * engine's `CardLimitPosition` — never recomputed on this surface.
   */
  readonly impactStrip?: {
    readonly availableAfterPurchaseIls: ProvenancedNumber;
  };
  /**
   * Card the user named on Check Input. Absent: the log is unlinked rather than
   * invented onto a card.
   */
  readonly logCardId?: string;
  /** Optional observer for tests. The screen still writes the activity store. */
  readonly onLogPurchase?: (purchase: LoggedPurchase) => void;
}

type PillCopy = {
  readonly word: string;
  readonly icon: string;
  readonly role: SemanticRole;
};

/**
 * Exhaustive against `PurchaseVerdict`. A fifth engine state is a compile error here
 * rather than a silent unpainted pill.
 */
export const VERDICT_PILL: { readonly [K in PurchaseVerdict]: PillCopy } = {
  good_to_go: { word: 'אפשר לקנות', icon: '✓', role: 'positive' },
  caution: { word: 'זהירות', icon: '!', role: 'advisory' },
  dont_buy_now: { word: 'לא לקנות עכשיו', icon: '✕', role: 'danger' },
  wait_until_billing_passes: { word: 'חכי עד שהחיוב יעבור', icon: '⏳', role: 'neutral' },
};

const BULLET_WORD: { readonly [K in ImpactBullet['kind']]: string } = {
  PURCHASE_MONTHLY_COMMITMENT: 'התחייבות חודשית מהרכישה',
  LOAD_AFTER_PURCHASE: 'עומס אחרי הרכישה',
  HARD_THRESHOLD_HEADROOM: 'מרווח עד הסף הקשיח',
  LOAD_AFTER_BILLING: 'עומס אחרי החיוב',
};

/** Display scale of an engine unit share. Not a second load calculation. */
function asDisplayPercent(unitShare: number): string {
  return `${(unitShare * 100).toFixed(1)}%`;
}

function bulletClaim(bullet: ImpactBullet): string {
  switch (bullet.kind) {
    case 'PURCHASE_MONTHLY_COMMITMENT':
    case 'HARD_THRESHOLD_HEADROOM':
      return String(bullet.amountIls.value);
    case 'LOAD_AFTER_PURCHASE':
      return String(bullet.ratioOfIncome.value);
    case 'LOAD_AFTER_BILLING':
      return `${bullet.billingDate}|${bullet.ratioOfIncome.value}`;
  }
}

function bulletVisible(bullet: ImpactBullet): string {
  switch (bullet.kind) {
    case 'PURCHASE_MONTHLY_COMMITMENT':
    case 'HARD_THRESHOLD_HEADROOM':
      return `₪${bullet.amountIls.value}`;
    case 'LOAD_AFTER_PURCHASE':
      return asDisplayPercent(bullet.ratioOfIncome.value);
    case 'LOAD_AFTER_BILLING':
      return `${bullet.billingDate} ${asDisplayPercent(bullet.ratioOfIncome.value)}`;
  }
}

/** Display scale of an engine 0–100 score. Not a second ranking. */
function asDisplayScore(value: number): string {
  return value.toFixed(0);
}

function chipView(number: ProvenancedNumber): ChipView {
  return { chip: number.provenance, stale: number.stale === true };
}

function bulletNumber(bullet: ImpactBullet): ProvenancedNumber {
  switch (bullet.kind) {
    case 'PURCHASE_MONTHLY_COMMITMENT':
    case 'HARD_THRESHOLD_HEADROOM':
      return bullet.amountIls;
    case 'LOAD_AFTER_PURCHASE':
    case 'LOAD_AFTER_BILLING':
      return bullet.ratioOfIncome;
  }
}

/** One painted figure plus the shared A2 chip. D8 sweeps these pairs on the tree. */
function NumberClaim({
  testID,
  claim,
  view,
  className,
  rowClassName,
  children,
}: {
  readonly testID: string;
  readonly claim: string;
  readonly view: ChipView;
  readonly className?: string;
  readonly rowClassName?: string;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <RtlRow {...(rowClassName !== undefined ? { className: rowClassName } : {})}>
      <AppText
        accessibilityValue={{ text: claim }}
        {...(className !== undefined ? { className } : {})}
        testID={testID}
      >
        {children}
      </AppText>
      <ProvenanceChip testID={`${testID}-chip`} view={view} />
    </RtlRow>
  );
}

export function CheckVerdictScreen({
  result,
  contextLine,
  recommendation,
  runnerUp,
  fxBlock,
  fxComparison,
  impactStrip,
  logCardId,
  onLogPurchase,
}: CheckVerdictScreenProps): React.ReactElement {
  const { t } = useTranslation();
  const logPurchase = useActivityStore((s) => s.logPurchase);
  const recordVerdict = useActivityStore((s) => s.recordVerdict);

  if (result === undefined) {
    return (
      <RtlScreen className={SURFACE.page} safe>
        <NotYetSurface
          ownedBy="WP-15 — Check Verdict pill and Financial Impact from one computation (P4 D1+D2)"
          testID="check-verdict-not-yet"
          title="בדיקה"
        />
      </RtlScreen>
    );
  }

  const pill = VERDICT_PILL[result.verdict];
  const word = t(pill.word);
  const label = `${pill.icon} ${word}`;

  return (
    <RtlScreen className={SURFACE.page} safe>
      <View className={`m-3 rounded-lg border p-4 ${SURFACE.card} ${BORDER.hairline}`}>
        <View
          accessibilityLabel={label}
          accessibilityRole="text"
          className={`rounded-lg border px-4 py-3 ${ROLE_SURFACE[pill.role]}`}
          testID={`check-verdict-pill-${result.verdict}`}
        >
          <RtlRow className="items-center gap-2">
            <AppText
              className={`text-2xl font-extrabold ${ROLE_TEXT[pill.role]}`}
              testID="check-verdict-pill-icon"
            >
              {pill.icon}
            </AppText>
            <AppText
              className={`text-xl font-extrabold ${ROLE_TEXT[pill.role]}`}
              testID="check-verdict-pill-word"
            >
              {word}
            </AppText>
          </RtlRow>
        </View>
        {result.verdict === 'wait_until_billing_passes' && result.waitUntil ? (
          <AppText className={`mt-3 text-sm ${TEXT.body}`} testID="check-verdict-wait-date">
            {result.waitUntil}
          </AppText>
        ) : null}
        {contextLine ? (
          <NumberClaim
            claim={String(contextLine.amount)}
            className={`text-sm ${TEXT.body}`}
            rowClassName="mt-3"
            testID="check-verdict-context"
            view={{ chip: 'USER', stale: false }}
          >
            {`${contextLine.currencySymbol}${contextLine.amount} · ${
              contextLine.categoryLabel ?? t('ללא קטגוריה')
            } · ${
              contextLine.installmentCount <= 1
                ? t('תשלום אחד')
                : `${contextLine.installmentCount} ${t('תשלומים')}`
            }`}
          </NumberClaim>
        ) : null}
        <View className={`mt-4 gap-2`} testID="check-verdict-impact-panel">
          <AppText className={`text-sm font-bold ${TEXT.body}`} testID="check-verdict-impact-title">
            {t('השפעה כלכלית')}
          </AppText>
          {result.financialImpact.bullets.map((bullet) => (
            <NumberClaim
              claim={bulletClaim(bullet)}
              className={`text-sm ${TEXT.body}`}
              key={bullet.kind}
              testID={`check-verdict-impact-${bullet.kind}`}
              view={chipView(bulletNumber(bullet))}
            >
              {`${t(BULLET_WORD[bullet.kind])} ${bulletVisible(bullet)}`}
            </NumberClaim>
          ))}
        </View>
        {recommendation ? (
          <View
            className={
              recommendation.emphasis === 'subordinate'
                ? `mt-4 gap-2 rounded-lg border p-3 ${SURFACE.sunken} ${BORDER.subtle}`
                : 'mt-4 gap-2'
            }
            testID="check-verdict-recommendation"
          >
            {/* A DON'T-BUY IS NOT OVERRULED BY A CARD CHIP — Owner ruling OQ-P5-002. The hero
                heading claims the card is good FOR THIS PURCHASE; after a don't-buy that sentence
                contradicts the pill above it. The subordinate line says what is actually true. */}
            {recommendation.emphasis === 'subordinate' ? (
              <AppText
                className={`text-xs ${TEXT.muted}`}
                testID="check-verdict-recommendation-subordinate"
              >
                {t('אם בכל זאת תמשיכי, זהו הכרטיס בעל העלות הנמוכה ביותר מבין הזמינים')}
              </AppText>
            ) : (
              <AppText
                className={`text-lg font-extrabold ${TEXT.heading}`}
                testID="check-verdict-recommendation-hero"
              >
                {t('הטובה לרכישה הזו')}
              </AppText>
            )}
            <CardTile
              nickname={recommendation.displayName}
              nicknameTestID="check-verdict-recommendation-tile"
              subject={{
                subjectKind: 'card',
                subjectId: recommendation.displayName,
                fallbackClass: 'card',
              }}
              testID="check-verdict-card-tile"
            />
            <RtlRow testID="check-verdict-match-score">
              <View className={`rounded-full px-2 py-1 ${SURFACE.sunken} ${BORDER.hairline}`}>
                <NumberClaim
                  claim={String(recommendation.matchScore.value)}
                  className={`text-xs ${TEXT.secondary}`}
                  testID="check-verdict-match-score-value"
                  view={chipView(recommendation.matchScore)}
                >
                  {`${t('ציון התאמה')} ${asDisplayScore(recommendation.matchScore.value)}`}
                </NumberClaim>
              </View>
            </RtlRow>
            <AppText
              className={`text-xs font-bold ${TEXT.secondary}`}
              testID="check-verdict-match-score-explainer-title"
            >
              {t('איך הציונים עובדים')}
            </AppText>
            <AppText
              className={`text-xs ${TEXT.muted}`}
              testID="check-verdict-match-score-explainer"
            >
              {t('הציון יחסי בין הכרטיסים שלך: 100 לעלות הנמוכה ביותר, 0 לגבוהה ביותר. זה לא ציון מוחלט.')}
            </AppText>
            {/* THE ENGINE'S OWN REASONS, not a sentence this screen wrote. Owner ruling OQ-P5-002
                requires the reason trace to reach the Verdict from the same scoring derivation. */}
            {recommendation.reasons === undefined ? null : (
              <View className="gap-1" testID="check-verdict-recommendation-reasons">
                {recommendation.reasons.steps.map((reasonStep) => (
                  <AppText
                    className={`text-xs ${TEXT.muted}`}
                    key={reasonStep.rule}
                    testID={`check-verdict-recommendation-reason-${reasonStep.rule}`}
                  >
                    {reasonStep.detail}
                  </AppText>
                ))}
              </View>
            )}
          </View>
        ) : null}
        {runnerUp ? (
          runnerUp.deltaFromBestIls !== undefined ? (
            <NumberClaim
              claim={String(runnerUp.deltaFromBestIls.value)}
              className={`text-sm ${TEXT.body}`}
              rowClassName="mt-3"
              testID="check-verdict-runner-up"
              view={chipView(runnerUp.deltaFromBestIls)}
            >
              {`${t('גם טוב')}: ${runnerUp.displayName} · ${t('חוסכת')} ₪${runnerUp.deltaFromBestIls.value} ${t('פחות')}`}
            </NumberClaim>
          ) : (
            <AppText className={`mt-3 text-sm ${TEXT.body}`} testID="check-verdict-runner-up">
              {`${t('גם טוב')}: ${runnerUp.displayName}`}
            </AppText>
          )
        ) : null}
        {fxBlock ? (
          <View className="mt-4 gap-2" testID="check-verdict-fx">
            <NumberClaim
              claim={`${fxBlock.quote.rateUsed.rateIlsPerQuoteUnit}|${fxBlock.quote.rateUsed.rateDate}`}
              className={`text-sm ${TEXT.body}`}
              testID="check-verdict-fx-rate"
              view={{ chip: fxBlock.quote.provenance, stale: fxBlock.quote.stale === true }}
            >
              {`${t('שער בנק ישראל')} ${fxBlock.quote.rateUsed.rateIlsPerQuoteUnit} · ${fxBlock.quote.rateUsed.rateDate}`}
            </NumberClaim>
            <NumberClaim
              claim={String(fxBlock.quote.fxPercentApplied)}
              className={`text-sm ${TEXT.body}`}
              testID="check-verdict-fx-fee"
              view={{ chip: fxBlock.quote.provenance, stale: fxBlock.quote.stale === true }}
            >
              {`${t('עמלת כרטיס במטח')} ${fxBlock.quote.fxPercentApplied}`}
            </NumberClaim>
            <NumberClaim
              claim={String(fxBlock.quote.effectiveIls)}
              className={`text-sm ${TEXT.body}`}
              testID="check-verdict-fx-estimate"
              view={{ chip: fxBlock.quote.provenance, stale: fxBlock.quote.stale === true }}
            >
              {`${t('עלות משוערת')} ₪${fxBlock.quote.effectiveIls}`}
            </NumberClaim>
            <AppText
              accessibilityRole="link"
              className={`text-sm font-bold ${TEXT.body}`}
              testID="check-verdict-fx-compare-link"
            >
              {t('השווי את כל הכרטיסים שלי')}
            </AppText>
          </View>
        ) : null}
        {fxComparison ? (
          <View className="mt-4" testID="check-verdict-fx-compare-sheet">
            <FxCompareFromCheckVerdict comparison={fxComparison} />
          </View>
        ) : null}
        {impactStrip ? (
          <NumberClaim
            claim={String(impactStrip.availableAfterPurchaseIls.value)}
            className={`text-sm ${TEXT.body}`}
            rowClassName="mt-4"
            testID="check-verdict-impact-strip"
            view={chipView(impactStrip.availableAfterPurchaseIls)}
          >
            {`${t('מסגרת פנויה אחרי הרכישה')} ₪${impactStrip.availableAfterPurchaseIls.value}`}
          </NumberClaim>
        ) : null}
        <AppText className={`mt-3 text-xs ${TEXT.muted}`} testID="check-verdict-freshness">
          {t('לידיעה בלבד')}
        </AppText>
        {contextLine ? (
          <RtlButton
            accessibilityRole="button"
            className={`mt-4 items-center rounded-lg p-3 ${ACCENT.solid}`}
            label={t('עשיתי את הרכישה הזאת')}
            labelClassName={`text-base font-extrabold ${TEXT.onAccent}`}
            onPress={(): void => {
              const at = new Date().toISOString();
              const written = writeLoggedPurchase({
                activityId: `activity:${at}`,
                amountIls: contextLine.amount,
                at,
                ...(logCardId !== undefined ? { cardId: logCardId } : {}),
              });
              logPurchase(written);
              recordVerdict(
                writeVerdictHistory({
                  activityId: written.activityId,
                  at: written.loggedAt,
                  verdict: result.verdict,
                  purchaseAmountIls: contextLine.amount,
                  ...(logCardId !== undefined ? { cardId: logCardId } : {}),
                }),
              );
              onLogPurchase?.(written);
            }}
            testID="check-verdict-log-purchase"
          />
        ) : null}
      </View>
    </RtlScreen>
  );
}
