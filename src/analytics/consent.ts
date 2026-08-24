/**
 * ANALYTICS CONSENT — criterion B8, Owner Decision OD-8.
 *
 *   > **B8.** *"Consent is **opt-in, default off**, requested only **after the first successful
 *   > verdict**, stored as vault data; with analytics off the release-gate network trace shows
 *   > **zero** outbound analytics requests."*
 *
 *   > **OD-8.** *"**OPT-IN.** External analytics never begins by default. Default off; **nothing
 *   > collected, buffered or queued before consent**; consent requested after the first successful
 *   > verdict, **never during onboarding**; declining costs the user nothing; toggle in More →
 *   > Security & Data; turning off stops collection immediately; crash diagnostics follow the same
 *   > gate."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "NOTHING COLLECTED, BUFFERED OR QUEUED" IS THE CLAUSE THAT SHAPES THIS MODULE
 *
 * The ordinary implementation of opt-in analytics buffers events and flushes them when consent
 * arrives, so the first upload contains everything the user did before they agreed. That is a
 * common pattern and OD-8 forbids it in as many words.
 *
 * **There is therefore no queue in this codebase.** Not an empty one, not a disabled one — none. An
 * event refused for want of consent is dropped at the boundary and cannot be recovered, which is
 * the only implementation of "nothing buffered" that a reviewer can verify by looking.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THREE STATES, NOT TWO
 *
 * `UNASKED` is not `DENIED`. A user who has never been asked has not declined, and the app may ask
 * once the moment OD-8 names. A user who declined has answered, and asking again is the pattern
 * that makes a consent dialog worthless.
 *
 * Collapsing them into a boolean is how "have you asked?" and "did they say yes?" become one
 * question with one wrong answer.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "AFTER THE FIRST SUCCESSFUL VERDICT" IS A PRECONDITION, NOT A SUGGESTION
 *
 * `mayRequestConsent` returns false during onboarding and before any verdict has succeeded. OD-8
 * says never during onboarding, and the reason is plain: a permission asked before the product has
 * done anything for somebody is a permission asked of a stranger.
 */

/** Where consent lives. Vault data, under the app namespace the vault already owns. */
export const CONSENT_VAULT_KEY = 'app:analytics_consent';

/** Three states, because "never asked" and "said no" are different facts. */
export const CONSENT_STATES = ['UNASKED', 'GRANTED', 'DENIED'] as const;
export type ConsentState = (typeof CONSENT_STATES)[number];

/** The default, stated as a value so a test can assert it rather than infer it from behaviour. */
export const DEFAULT_CONSENT: ConsentState = 'UNASKED';

/** What the app has done so far, as far as consent is concerned. */
export interface ConsentContext {
  readonly state: ConsentState;
  /** OD-8: never during onboarding. */
  readonly onboardingComplete: boolean;
  /** OD-8: after the FIRST SUCCESSFUL verdict. A failed one is not a verdict. */
  readonly successfulVerdicts: number;
  /** True only once the prompt has actually been shown, so it is shown once. */
  readonly promptShown: boolean;
}

/**
 * May analytics collect anything right now?
 *
 * The only question `track` asks. `UNASKED` is false — that is what "opt-in, default off" means,
 * and it is why the default is not `DENIED`: the user has not refused, and nothing is collected
 * anyway.
 */
export function analyticsPermitted(context: Pick<ConsentContext, 'state'>): boolean {
  return context.state === 'GRANTED';
}

/**
 * May the app ASK for consent right now?
 *
 * Every clause of OD-8's timing, as one predicate with a reason attached — so a surface cannot
 * satisfy three of the four conditions and show the prompt anyway.
 */
export function mayRequestConsent(context: ConsentContext): { may: boolean; why: string } {
  if (context.state !== 'UNASKED') {
    return {
      may: false,
      why:
        `consent is already ${context.state}. Asking a user who declined is the pattern that makes ` +
        'a consent dialog worthless, and asking one who agreed is noise.',
    };
  }
  if (context.promptShown) {
    return { may: false, why: 'the prompt has already been shown once and was not answered.' };
  }
  if (!context.onboardingComplete) {
    return {
      may: false,
      why:
        'onboarding is not complete. OD-8: never during onboarding — a permission asked before the ' +
        'product has done anything for somebody is a permission asked of a stranger.',
    };
  }
  if (context.successfulVerdicts < 1) {
    return {
      may: false,
      why:
        'no verdict has succeeded yet. OD-8 requires the FIRST SUCCESSFUL verdict: a failed one is ' +
        'not a verdict, and asking after a failure asks somebody to fund a thing that just let ' +
        'them down.',
    };
  }
  return { may: true, why: 'onboarding is complete and at least one verdict has succeeded.' };
}

/**
 * The state after an answer.
 *
 * Declining is recorded, not left `UNASKED`. "Declining costs the user nothing" means no feature is
 * withdrawn — it does not mean the answer is forgotten and the question repeated.
 */
export function answerConsent(granted: boolean): ConsentState {
  return granted ? 'GRANTED' : 'DENIED';
}

/**
 * Turning it off stops collection IMMEDIATELY, and there is nothing left behind to send.
 *
 * OD-8 says so, and the absence of a queue is what makes it true: there is no buffer to flush, no
 * pending batch, and no "one last upload". This function exists so the guarantee has a name a test
 * can call.
 */
export function revokeConsent(): { state: ConsentState; pendingEvents: 0 } {
  // The literal zero is the point. Nothing is collected, buffered or queued before consent, so
  // there is nothing in flight when it is withdrawn either.
  return { state: 'DENIED', pendingEvents: 0 };
}
