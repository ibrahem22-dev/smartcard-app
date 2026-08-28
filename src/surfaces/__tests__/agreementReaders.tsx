/**
 * THE READERS — one per participant, each returning WHAT THE SURFACE PAINTED.
 *
 * `P5_VALIDATION_PLAN.md` §3.1, on why this file mounts components instead of calling selectors:
 *
 *   > *"Rendered values, not recomputed ones. Reading the surface's INPUT proves the surface was
 *   > given the right number, not that it showed it."*
 *
 * So every reader below renders the real component and reads the value off the rendered tree. The
 * figures are read from `accessibilityValue.text`, which is the exact string the surface painted
 * and the exact string a screen reader announces — not a re-derivation of it, and not a prop on the
 * way in.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A READER THAT DOES NOT EXIST YET RETURNS `NOT_BUILT`, AND THAT IS THE POINT
 *
 * At PHASE-1 four of the five P5 surfaces do not render these figures. A property whose missing
 * participants were quietly skipped would go green comparing one surface with itself, which is the
 * exact failure group A exists to prevent, one level up. So a missing reader is a first-class value
 * and every property FAILS while any of its participants is `NOT_BUILT`, naming it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE VERDICT IS READ THROUGH P4's OWN ASSEMBLY, ON PURPOSE
 *
 * `verdictPropsFromDraft` is P4's — it is what the product actually uses to put a number on that
 * screen. The property renders the Verdict from it and compares the painted figure against the
 * engine result **P5's seam** obtained for the same inputs. If those two ever disagree, that is the
 * property catching a real cross-surface disagreement, and the finding is **raised to P4, not
 * repaired here** (contract §1.2, §17; exam task T8). P5 renders beside the Check loop; it does not
 * edit it.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CheckVerdictScreen } from '../../screens/check/CheckVerdictScreen';
import { SectionCWhenBest } from '../../screens/cardDna/SectionCWhenBest';
import { SectionDActiveNow } from '../../screens/cardDna/SectionDActiveNow';
import { HomeLoadBar } from '../../screens/home/HomeLoadBar';
import { HomeRiskStrip } from '../../screens/home/HomeRiskStrip';
import { WalletBestForChips } from '../../screens/wallet/WalletBestForChips';
import { WalletLimitBar } from '../../screens/wallet/WalletLimitBar';
import { verdictPropsFromDraft } from '../../check/checkLoop';
import { Currency } from '../../types/purchase.types';
import { evaluateSurfaceEngines } from '../surfaceEngines';
import type { SurfaceContext } from '../surfaceContext';
import { getCached, putCached } from '../derivedCache';

const { DayMarkers } = require('../../screens/calendar/DayMarkers.tsx') as {
  readonly DayMarkers: React.ComponentType<{
    readonly context: SurfaceContext;
    readonly iso: string;
  }>;
};

/** A participant with no reader yet. Not a zero, not a skip. */
export const NOT_BUILT = Symbol('this surface does not render this figure yet');
export type PaintedNumber = number | typeof NOT_BUILT;

const wrap = (node: React.ReactElement): React.ReactElement => (
  <SafeAreaProvider
    initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
  >
    {node}
  </SafeAreaProvider>
);

/** The number a surface actually painted, off the rendered tree. */
const paintedValue = (tree: ReturnType<typeof render>, testID: string): PaintedNumber => {
  const node = tree.queryByTestId(testID);
  if (node === null) return NOT_BUILT;
  const text = (node.props as { accessibilityValue?: { text?: string } }).accessibilityValue?.text;
  if (typeof text !== 'string') return NOT_BUILT;
  const n = Number(text);
  return Number.isFinite(n) ? n : NOT_BUILT;
};

/**
 * The Verdict's impact strip — *"available limit after the purchase, from the load engine's
 * `CardLimitPosition`, never recomputed on this surface"*, in the screen's own words.
 */
export function readVerdictImpactStrip(ctx: SurfaceContext): PaintedNumber {
  const prospective = ctx.prospectiveCommitment;
  if (prospective === undefined) return NOT_BUILT;
  const amount = prospective.monthlyAmountIls.value;
  const props = verdictPropsFromDraft(
    { amount, currency: Currency.ILS, category: null, installments: 1, cardId: prospective.linkedCardId ?? null },
    {
      profile: ctx.profile,
      cards: ctx.cards.map((c) => ({ cardId: c.cardId, creditLimit: c.framework.creditLimit })),
      purchases: ctx.purchases,
      todayIso: ctx.asOfDate,
    },
  );
  const tree = render(wrap(<CheckVerdictScreen {...props} />));
  try {
    return paintedValue(tree, 'check-verdict-impact-strip');
  } finally {
    tree.unmount();
  }
}

/** Wallet's available-limit bar. */
export function readWalletLimitBar(ctx: SurfaceContext): PaintedNumber {
  const cardId = ctx.cards[0]?.cardId;
  if (cardId === undefined) return NOT_BUILT;
  const tree = render(wrap(<WalletLimitBar cardId={cardId} context={ctx} />));
  try {
    return paintedValue(tree, 'wallet-limit-bar-available');
  } finally {
    tree.unmount();
  }
}

/** Card DNA §D's credit-limit utilization. Built in PHASE-3 (N7). */
export function readCardDnaUtilizationLimit(_ctx: SurfaceContext): PaintedNumber {
  return NOT_BUILT;
}

/**
 * The Verdict's Financial Impact panel — A2's P4-side participant.
 *
 * The panel paints one bullet per `ImpactBullet`, and the load-after-purchase bullet is the ratio
 * A2 compares. It is read off the tree by the bullet's own testID, not reconstructed from the props.
 */
export function readVerdictLoadRatio(ctx: SurfaceContext): PaintedNumber {
  const prospective = ctx.prospectiveCommitment;
  if (prospective === undefined) return NOT_BUILT;
  const props = verdictPropsFromDraft(
    {
      amount: prospective.monthlyAmountIls.value,
      currency: Currency.ILS,
      category: null,
      installments: 1,
      cardId: prospective.linkedCardId ?? null,
    },
    {
      profile: ctx.profile,
      cards: ctx.cards.map((c) => ({ cardId: c.cardId, creditLimit: c.framework.creditLimit })),
      purchases: ctx.purchases,
      todayIso: ctx.asOfDate,
    },
  );
  const tree = render(wrap(<CheckVerdictScreen {...props} />));
  try {
    return paintedValue(tree, 'check-verdict-impact-LOAD_AFTER_PURCHASE');
  } finally {
    tree.unmount();
  }
}

/** Home's monthly load bar. Built in PHASE-7 (H3). */
export function readHomeLoadBar(ctx: SurfaceContext): PaintedNumber {
  const tree = render(wrap(<HomeLoadBar context={ctx} />));
  try {
    return paintedValue(tree, 'home-load-bar-ratio');
  } finally {
    tree.unmount();
  }
}

/** Plan Commitments' sticky summary ratio. Built in PHASE-5 (J1). */
export function readCommitmentsSummaryRatio(_ctx: SurfaceContext): PaintedNumber { return NOT_BUILT; }

/** Card DNA §D's utilization ratio. Built in PHASE-3 (N7). */
export function readCardDnaUtilizationRatio(ctx: SurfaceContext): PaintedNumber {
  const cardId = ctx.cards[0]?.cardId;
  if (cardId === undefined) return NOT_BUILT;
  const tree = render(wrap(<SectionDActiveNow cardId={cardId} context={ctx} />));
  try {
    return paintedValue(tree, 'card-dna-utilization-available');
  } finally {
    tree.unmount();
  }
}

/**
 * A per-day risk level, as a surface paints it. `null` where the surface has no dot for that day.
 * Built in PHASE-7 (H4) and PHASE-6 (K2).
 */
export type PaintedLevel = string | typeof NOT_BUILT;
export function readHomeRiskStripDay(ctx: SurfaceContext, date: string): PaintedLevel {
  const tree = render(wrap(<HomeRiskStrip context={ctx} />));
  try {
    const node = tree.queryByTestId(`home-risk-strip-day-${date}`);
    const text = (node?.props as { accessibilityValue?: { text?: string } } | undefined)
      ?.accessibilityValue?.text;
    return typeof text === 'string' ? text : NOT_BUILT;
  } finally {
    tree.unmount();
  }
}
export function readCalendarRiskDotDay(ctx: SurfaceContext, date: string): PaintedLevel {
  const tree = render(wrap(<DayMarkers context={ctx} iso={date} />));
  try {
    const node = tree.queryByTestId(`calendar-day-${date}-marker-risk`);
    const text = (node?.props as { accessibilityValue?: { text?: string } } | undefined)
      ?.accessibilityValue?.text;
    return typeof text === 'string' ? text : NOT_BUILT;
  } finally {
    tree.unmount();
  }
}

/** A ranked card list, as a surface paints it. Built in PHASE-4 (W4), PHASE-3 (N6). */
export type PaintedRanking = readonly string[] | typeof NOT_BUILT;
export function readWalletBestForChips(ctx: SurfaceContext): PaintedRanking {
  const tree = render(wrap(<NavigationContainer><>{ctx.cards.map((card) => (
    <WalletBestForChips cardId={card.cardId} context={ctx} key={card.cardId} />
  ))}</></NavigationContainer>));
  try {
    return tree.queryAllByTestId(/^wallet-best-for-/)
      .map((node) => String(node.props.testID).slice('wallet-best-for-'.length));
  } finally {
    tree.unmount();
  }
}
export function readCardDnaWhenBestChips(ctx: SurfaceContext): PaintedRanking {
  const tree = render(wrap(<SectionCWhenBest context={ctx} />));
  try {
    return tree.queryAllByTestId(/^card-dna-best-for-/)
      .map((node) => (node.props as { testID?: string }).testID)
      .filter((testID): testID is string =>
        testID !== undefined && !testID.endsWith('-explanation'))
      .map((testID) => testID.slice('card-dna-best-for-'.length));
  } finally {
    tree.unmount();
  }
}
export function readCheckRecommendation(_ctx: SurfaceContext): PaintedRanking { return NOT_BUILT; }

const CACHE_BEST_FOR = 'cache-best-for';
const CACHE_LOAD_RATIO = 'cache-load-ratio';
const CACHE_CALENDAR_RISK = 'cache-calendar-risk';

/** Wallet and Card DNA's ordered best-for card ids, cached only for the exact engine inputs. */
export function readCacheBestFor(ctx: SurfaceContext): PaintedRanking {
  const fresh = evaluateSurfaceEngines(ctx).scoring;
  if (fresh === null) {
    getCached<readonly string[]>(CACHE_BEST_FOR, ctx);
    return NOT_BUILT;
  }
  putCached(CACHE_BEST_FOR, ctx, fresh.ranked.map((card) => card.cardId));
  return getCached<readonly string[]>(CACHE_BEST_FOR, ctx) ?? NOT_BUILT;
}

/** Home's load ratio, cached only for the exact engine inputs. */
export function readCacheLoadRatio(ctx: SurfaceContext): PaintedNumber {
  const fresh = evaluateSurfaceEngines(ctx).load;
  if (fresh === null) {
    getCached<number>(CACHE_LOAD_RATIO, ctx);
    return NOT_BUILT;
  }
  putCached(CACHE_LOAD_RATIO, ctx, fresh.current.ratioOfIncome.value);
  return getCached<number>(CACHE_LOAD_RATIO, ctx) ?? NOT_BUILT;
}

type CalendarRiskCache = Readonly<Record<string, string>>;

/** Plan Calendar's per-day risk levels, cached only for the exact engine inputs. */
export function readCacheCalendarRisk(ctx: SurfaceContext, iso: string): PaintedLevel {
  const fresh = evaluateSurfaceEngines(ctx).risk;
  if (fresh === null) {
    getCached<CalendarRiskCache>(CACHE_CALENDAR_RISK, ctx);
    return NOT_BUILT;
  }
  const levels = Object.fromEntries(fresh.days.map((day) => [day.date, day.riskLevel]));
  putCached<CalendarRiskCache>(CACHE_CALENDAR_RISK, ctx, levels);
  return getCached<CalendarRiskCache>(CACHE_CALENDAR_RISK, ctx)?.[iso] ?? NOT_BUILT;
}

/**
 * The derived caches of spec §21C — best-for, load %, calendar risk, savings totals.
 *
 * P5 is the phase that CREATES them (PHASE-7). Until then there is nothing to read, and A5's
 * property fails on a check over zero items rather than passing over one: contract §2 rule 5.
 */
export interface CachedValue {
  readonly cache: string;
  readonly key: string;
  readonly value: number;
}
export function readDerivedCaches(ctx: SurfaceContext): readonly CachedValue[] | typeof NOT_BUILT {
  const fresh = evaluateSurfaceEngines(ctx);
  const out: CachedValue[] = [];

  const ranking = readCacheBestFor(ctx);
  if (ranking !== NOT_BUILT && ranking.length > 0) {
    out.push({ cache: 'best-for', key: ranking[0] as string, value: 0 });
  }

  const loadRatio = readCacheLoadRatio(ctx);
  if (loadRatio !== NOT_BUILT) {
    out.push({ cache: 'load-ratio', key: 'current', value: loadRatio });
  }

  const firstRiskDay = fresh.risk?.days[0];
  if (firstRiskDay !== undefined) {
    const riskLevel = readCacheCalendarRisk(ctx, firstRiskDay.date);
    if (riskLevel !== NOT_BUILT) {
      out.push({
        cache: 'calendar-risk',
        key: firstRiskDay.date,
        value: Number(riskLevel === 'safe'),
      });
    }
  } else {
    getCached<CalendarRiskCache>(CACHE_CALENDAR_RISK, ctx);
  }

  return out;
}

/**
 * The load BAND a surface paints — safe · warning · strong_warning · blocked.
 *
 * Separate from the ratio on purpose. `P5_VALIDATION_PLAN.md` §3.2: *"comparing the ratio but not
 * the band — the boundary is where they disagree, and >= versus > at exactly 35% is the canonical
 * defect."* Two surfaces agreeing on 0.35 and disagreeing on what 0.35 MEANS is the failure, and a
 * property that read only the ratio would report agreement.
 *
 * Built in PHASE-7 (H3), PHASE-5 (J1) and PHASE-3 (N7).
 */
export type PaintedBand = string | typeof NOT_BUILT;
export function readHomeLoadBand(_ctx: SurfaceContext): PaintedBand { return NOT_BUILT; }
export function readCommitmentsBand(_ctx: SurfaceContext): PaintedBand { return NOT_BUILT; }
export function readCardDnaBand(_ctx: SurfaceContext): PaintedBand { return NOT_BUILT; }
