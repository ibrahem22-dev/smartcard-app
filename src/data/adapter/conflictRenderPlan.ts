import type { ConflictRenderPlan } from '@smartcard/data-authority-adapter';

/**
 * WHAT EACH RENDER PLAN REQUIRES — criterion A4, obligation OB-1.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS SEPARATE FROM `conflictRender.ts`
 *
 * **The import above is `import type`, and it is erased.** Nothing here requires the adapter at
 * runtime, so a React Native component can switch on the plan without pulling a Node-targeted
 * package into the bundle.
 *
 * That is not a hypothetical. The render suite failed with
 *
 *     Cannot find module '@babel/runtime/helpers/interopRequireDefault'
 *     from '../smartcard-data-pipeline/dist/adapter-package/adapter/compatibility.js'
 *
 * because the adapter resolves through a `file:` junction to a path outside the app root, so
 * Node's resolution never reaches this repository's `node_modules`. A published tarball would
 * resolve; the development link does not. It is the same property the seam's own header names:
 * **a `file:` dependency pins nothing and behaves differently from the thing it stands in for.**
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AND IT IS STILL ONE VOCABULARY
 *
 * The type comes from the adapter. There is no local copy of the member names, so a plan the
 * adapter adds is a compile error in the switch below rather than a string this app also happens
 * to know about. `conflictRender.ts` holds the runtime half — `conflictRecordAvailabilityOf` and
 * `conflictRenderPlan` — for the data layer, which runs where the adapter loads.
 */

export type { ConflictRenderPlan };

export interface PlanShape {
  readonly showsCandidates: boolean;
  readonly showsDisputedMark: boolean;
  /** Never true. Present so the prohibition is a value somebody can assert against. */
  readonly showsSpinner: false;
  readonly showsError: false;
  readonly hidesTheFact: false;
}

/**
 * What a surface must do, as an EXHAUSTIVE MATCH over the adapter's closed domain.
 *
 *   > **OB-1.** *"What P2 must NOT do: treat an empty `conflictIds` as a loading state, an error,
 *   > or a reason to hide the fact."*
 *
 * The three `false` fields are not decoration. They make each prohibition a value a test can
 * assert, rather than a sentence in a comment that nothing checks.
 *
 * The default arm throws and names the value. A new member arriving as a silent fall-through is
 * exactly the undeclared state ADJ-005 was blocked on, one level up.
 */
export function describePlan(plan: ConflictRenderPlan): PlanShape {
  switch (plan) {
    case 'RENDER_ALL_CANDIDATES':
      // OD-9: every competing reading, with its scope and its source. No winner.
      return {
        showsCandidates: true,
        showsDisputedMark: true,
        showsSpinner: false,
        showsError: false,
        hidesTheFact: false,
      };

    case 'DISPUTED_WITHOUT_CANDIDATES':
      // The ADJ-005 state: "This figure is disputed" and nothing further. The fact is NOT hidden,
      // and no reading is invented.
      return {
        showsCandidates: false,
        showsDisputedMark: true,
        showsSpinner: false,
        showsError: false,
        hidesTheFact: false,
      };

    default: {
      const unreachable: never = plan;
      throw new Error(
        `unknown conflict render plan "${String(unreachable)}". The domain is closed and this arm ` +
          'exists so a new member is a loud failure rather than a screen that silently renders ' +
          'nothing — which is how ADJ-005\'s undeclared state arose one level up.',
      );
    }
  }
}
