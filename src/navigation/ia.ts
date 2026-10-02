/**
 * THE INFORMATION ARCHITECTURE, DECLARED ONCE — criterion A1.
 *
 *   > **A1.** *"Navigation matches Spec §24 exactly: Home · Wallet(Cards|Benefits) · [Check ●] ·
 *   > Plan(Calendar|Commitments) · More; **Check is a raised centre action opening a full-screen
 *   > modal with no tab highlighted**."*
 *
 * The forensic's verdict on the inherited shell was **REWRITE**:
 *
 *   > *"Tabs are Home · PurchaseGate · Cards · Calendar · Settings. Spec is Home ·
 *   > Wallet(Cards|Benefits) · Check as a raised modal · Plan(Calendar|Commitments) · More.
 *   > **Check-as-tab is the largest IA mismatch**; every screen's entry points change anyway."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE TREE IS DATA AND NOT JSX
 *
 * "Matches the spec exactly" is a claim somebody has to be able to check. A navigator built from
 * JSX can only be checked by rendering it and reading the result, and a route added in a hurry to
 * one branch is invisible in every other. Declaring the tree here means the navigator BUILDS from
 * it and the `nav` gate READS it — and the gate compares this against `tools/p2/nav-spec.json`,
 * generated from the spec document itself. Neither this file nor the spec can drift alone.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * CHECK IS A TASK, NOT A TAB, AND THE DIFFERENCE IS THE WHOLE POINT
 *
 * A tab is somewhere you ARE. A task is something you DO and then leave. The inherited app made
 * "check a purchase" a place, which means the app has a permanent room for a question — and a
 * highlighted tab tells a user they are somewhere, which is exactly wrong while a modal is open
 * over everything else.
 *
 * `raised: true` carries that: the tab bar renders it as a centre action, pressing it opens a
 * full-screen modal on the ROOT navigator rather than switching tabs, and no tab highlights.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IS SHELL AND WHAT IS CONTENT
 *
 * Contract §9 sends the Wallet, Card DNA, Plan and Home CONTENT surfaces to P5a/P5b, and the
 * campaign plan says this work package is *"shell only"*. So Benefits and Commitments are real
 * routes in a real segmented control, and what they render today is an evidenced empty state that
 * says which phase owns it. A route that exists and says "not yet" is honest; a route missing from
 * the IA would make the shell disagree with the spec, which is the thing A1 measures.
 */

/** A segment inside a tab's internal segmented control. */
export interface IaSegment {
  readonly key: string;
  /** Hebrew source string; `t()` resolves it. */
  readonly label: string;
}

export interface IaItem {
  /** The route name in the navigator. */
  readonly key: string;
  /** The name the spec's navigation bar uses, upper-cased for comparison. */
  readonly specName: string;
  readonly label: string;
  /** True for the raised centre action. Exactly one item may carry it. */
  readonly raised: boolean;
  /** The internal segmented control, if the spec gives this item one. */
  readonly segments?: readonly IaSegment[];
}

/**
 * The bottom navigation, in spec order. **Order is meaningful**: the raised action sits at the
 * centre, and it is the third of five because the spec puts it there.
 */
export const BOTTOM_NAVIGATION: readonly IaItem[] = [
  { key: 'Home', specName: 'HOME', label: 'בית', raised: false },
  {
    key: 'Wallet',
    specName: 'WALLET',
    label: 'ארנק',
    raised: false,
    segments: [
      { key: 'Cards', label: 'כרטיסים' },
      { key: 'Benefits', label: 'הטבות' },
    ],
  },
  { key: 'Check', specName: 'CHECK', label: 'בדיקה', raised: true },
  {
    key: 'Plan',
    specName: 'PLAN',
    label: 'תכנון',
    raised: false,
    segments: [
      { key: 'Calendar', label: 'לוח שנה' },
      { key: 'Commitments', label: 'התחייבויות' },
    ],
  },
  { key: 'More', specName: 'MORE', label: 'עוד', raised: false },
];

/** The tabs the bar actually renders as tabs — everything that is not the raised action. */
export const TAB_ITEMS = BOTTOM_NAVIGATION.filter((i) => !i.raised);

/** The one raised action. Exported as a single value because the spec permits exactly one. */
export const RAISED_ACTION = BOTTOM_NAVIGATION.find((i) => i.raised);

/**
 * The route the raised action opens, on the ROOT navigator so it covers the tab bar.
 * Named here rather than at the press site so the gate can check that it is not a tab.
 */
export const RAISED_ACTION_ROUTE = 'CheckModal' as const;
