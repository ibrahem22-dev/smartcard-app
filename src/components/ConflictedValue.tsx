import React from 'react';
import { View } from 'react-native';

import { AppText } from './AppText';
import { RtlRow } from './rtl';
import { BORDER, ROLE_BORDER, ROLE_SURFACE_BG, ROLE_TEXT, SURFACE, TEXT } from '../theme/tokens';
import { useTranslation } from '../hooks/useTranslation';
import type { ConflictAuthority, ConflictCandidate } from '../authority/authorityValue';
import { describePlan, type ConflictRenderPlan } from '../data/adapter/conflictRenderPlan';

/**
 * CONFLICTED VALUE — criterion A3 and Owner Decision OD-9. One shared component; no per-screen
 * conflict logic anywhere.
 *
 *   > **A3.** *"`ConflictedValue` is one shared component rendering **every** competing reading with
 *   > its scope and its source, **amber never red**, **no winner and no default selection**."*
 *
 *   > **OD-9.** *"A **shared component** (`ConflictedValue`), not per-screen bespoke logic."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THIS COMPONENT DOES NOT DECIDE ANYTHING, AND THAT IS ITS ENTIRE PURPOSE
 *
 * The pipeline met these candidates and deliberately refused to name a winner. OD-24 goes further:
 * conflicted numeric values are usable only as bounded intervals and are *never collapsed into an
 * unverified scalar*. So every way this component could be helpful is a way it could lie:
 *
 *   · **It does not sort.** Putting the cheapest first is a ranking, and a reader takes the top row
 *     as the answer. The candidates render in the order they arrived.
 *   · **It does not preselect.** There is no `selected` prop and no default highlight, because a
 *     highlighted row is a winner wearing different clothes.
 *   · **It does not truncate.** Every candidate renders. "…and 2 more" hides exactly the reading
 *     that might have been the user's.
 *   · **It does not compute.** No interval, no average, no spread. `conflictRenderPlan` is the
 *     adapter's (handoff §2, IF-4) and re-deriving it here is what D4 forbids.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AMBER, NEVER RED
 *
 * A3 says so, and A8 says why: red is danger *only*. A disagreement between two sources is not a
 * danger to the reader — it is the app being honest that it does not know. Painting it red would
 * tell somebody their card is a hazard when the truth is that two records disagree, and the next
 * red thing they see, which really is a hazard, would carry less weight for it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * SCOPE IS SHOWN BESIDE SOURCE, AND THAT IS NOT DECORATION
 *
 * Two sources disagreeing about one number are often not disagreeing at all: one quotes a card
 * tier, the other the whole issuer. Two figures without scope turn a difference in coverage into an
 * apparent contradiction, and a reader has no way to tell which one describes them.
 */

export interface ConflictedValueProps<T> {
  /** The conflict as the authority layer produced it. Candidates render in the order given. */
  readonly conflict: ConflictAuthority<T>;
  /**
   * WHICH PLAN THE ADAPTER CHOSE — criterion A4, obligation OB-1.
   *
   * Required, and not inferred from `conflict.candidates.length`. A length is a symptom of a state;
   * the field that carries the state is the one to switch on, and a third availability member would
   * also arrive with zero candidates and would need saying differently.
   */
  readonly plan: ConflictRenderPlan;
  /** How to render one candidate's value. Never applied to anything but a candidate. */
  readonly format: (value: T) => string;
  /** What the disputed figure IS — "FX commission", "annual fee". Already translated. */
  readonly label?: string;
  readonly testID?: string;
}

function CandidateRow<T>({
  candidate,
  format,
  index,
}: {
  readonly candidate: ConflictCandidate<T>;
  readonly format: (value: T) => string;
  readonly index: number;
}): React.ReactElement {
  const { t } = useTranslation();
  const parts = [
    candidate.sourceId ?? t('מקור לא מזוהה'),
    candidate.scope,
    candidate.observedAt,
  ].filter((p): p is string => typeof p === 'string' && p.trim() !== '');

  return (
    <View
      className={`mt-2 rounded-lg border p-3 ${SURFACE.card} ${BORDER.hairline}`}
      testID={`conflicted-value-candidate-${String(index)}`}
    >
      <AppText className={`text-base font-bold ${TEXT.heading}`}>
        {format(candidate.value)}
      </AppText>
      <AppText className={`mt-1 text-xs ${TEXT.secondary}`}>{parts.join(' · ')}</AppText>
    </View>
  );
}

export function ConflictedValue<T>({
  conflict,
  plan,
  format,
  label,
  testID,
}: ConflictedValueProps<T>): React.ReactElement {
  const { t } = useTranslation();
  // Exhaustive over the adapter's closed domain. A new member throws here rather than rendering a
  // screen that silently says nothing.
  const shape = describePlan(plan);
  const candidates = conflict.candidates;

  return (
    <View
      accessibilityRole="summary"
      className={`rounded-lg border p-3 ${ROLE_SURFACE_BG.advisory} ${ROLE_BORDER.advisory}`}
      testID={testID ?? 'conflicted-value'}
    >
      {/* rtl-ok */}
      <RtlRow className="items-center gap-2">
        <AppText className={`text-sm font-bold ${ROLE_TEXT.advisory}`}>≠</AppText>
        <AppText className={`text-sm font-bold ${ROLE_TEXT.advisory}`}>
          {label === undefined
            ? t('הנתון הזה שנוי במחלוקת')
            : t('{{label}} — הנתון הזה שנוי במחלוקת', { label })}
        </AppText>
      </RtlRow>

      {/*
        A CONFLICT WITH NO CANDIDATES IS STILL A CONFLICT, and it renders as one sentence and
        nothing further. Criterion A4 names this case by record id — DISPUTED_WITHOUT_CANDIDATES —
        and requires that empty `conflictIds` produce "neither spinner, error, nor fallback". An
        empty list is an answer the pipeline gave, not a loading state.

        The decision is `shape.showsCandidates`, read from the PLAN. Reading `candidates.length`
        would give the same answer today and would be the wrong question: it is the same mistake A5
        forbids with `label === null`.
      */}
      {!shape.showsCandidates ? null : (
        <View testID="conflicted-value-candidates">
          {candidates.map((candidate, index) => (
            <CandidateRow
              candidate={candidate}
              format={format}
              index={index}
              key={`${String(index)}:${candidate.sourceId ?? 'unattributed'}`}
            />
          ))}
        </View>
      )}

      {conflict.reason.trim() === '' ? null : (
        <AppText className={`mt-2 text-xs ${TEXT.muted}`}>{conflict.reason}</AppText>
      )}
    </View>
  );
}
