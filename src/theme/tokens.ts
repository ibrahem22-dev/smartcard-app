/**
 * THE TOKEN MODULE — criterion A8, and the only place in this application where a colour is written.
 *
 *   > **A8.** *"Semantic colour discipline enforced at token level: **red = danger only**, amber =
 *   > advisory/estimate, green = positive verdict only; **no raw colour literal outside the token
 *   > module**."*
 *
 * Before this file there was no token module. Colour lived in three places at once: 22 distinct hex
 * literals across 53 sites, 102 uses of Tailwind's semantic families through className strings, and
 * two custom entries in `tailwind.config.js`. Nothing compared them, so "red = danger only" was a
 * sentence in a contract rather than a property of the code.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE MEANING IS IN THE NAME AND NOT IN THE HUE
 *
 * A static check cannot read intent out of `text-red-600`. It cannot tell danger from decoration.
 * So the discipline is imposed the only way it can be: **a surface may not name a hue at all.** It
 * names a ROLE — `danger`, `advisory`, `positive`, `neutral` — and this module is the one place
 * that decides which hue a role gets. "red = danger only" then stops being a rule anyone has to
 * remember and becomes a fact about this file: exactly one role maps to red, and it is called
 * danger.
 *
 * `tools/p2/gates/colour-semantics.mjs` enforces both halves — no hue outside this module, and no
 * second role sharing a hue.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THERE ARE THREE SEMANTIC ROLES, NOT FOUR — PD-006
 *
 * `DecisionScreen` mapped four verdicts to four hues: approved→green, warning→amber, blocked→red
 * and **wait_24h→orange**. A8 names three roles and gives each the word *only*, which reads as an
 * exhaustive list rather than a sample. Orange was a fourth semantic colour carrying a fourth
 * meaning, which is exactly the drift A8 exists to prevent.
 *
 * `wait_24h` is advisory, so it takes the advisory role. THE DISTINCTION BETWEEN "WAIT" AND
 * "WARNING" IS REAL AND SURVIVES — carried by icon and word, which criterion A9 requires anyway:
 * *"every state cue is icon + word, never colour alone."* Collapsing the hue makes that requirement
 * load-bearing instead of decorative.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * TWO KINDS OF COLOUR LIVE HERE, AND THEY ARE NOT THE SAME KIND OF THING
 *
 *   · SEMANTIC roles say what a thing MEANS. A8 governs them, and there are exactly three plus a
 *     neutral. Adding a fourth is a contract change, not a design tweak.
 *   · CHROME and BRAND colours say what a thing IS — a surface, a border, Bank Leumi's blue. They
 *     carry no verdict and no judgement about a user's money. They still live here, because A8's
 *     second half says *no raw colour literal outside the token module* and makes no exception for
 *     colours that happen to be innocent.
 */

// ═════════════════════════════════════════════════════════════════════ semantic roles (A8)

/** The three roles A8 names, plus neutral for "no judgement is being expressed". */
export type SemanticRole = 'danger' | 'advisory' | 'positive' | 'neutral';

/**
 * The hue each role owns. **One role per hue, one hue per role** — the gate asserts it, so the
 * A8 sentence is checkable rather than remembered.
 */
export const ROLE_HUE: Readonly<Record<SemanticRole, string>> = {
  danger: 'red',
  advisory: 'amber',
  positive: 'green',
  neutral: 'slate',
};

/** What each role is FOR, in the contract's own words. Read by the gate; printed in its output. */
export const ROLE_MEANING: Readonly<Record<SemanticRole, string>> = {
  danger: 'danger only — a refusal, a block, a loss, a destructive action',
  advisory: 'advisory or estimate — a caution, an unverified figure, a wait',
  positive: 'a positive verdict only — never mere success of a UI action',
  neutral: 'no judgement is being expressed about the user or their money',
};

/**
 * The class sets a surface applies. Light and dark in one string, because a role that looks
 * different in dark mode is the same role and must not be two decisions.
 */
export const ROLE_SURFACE: Readonly<Record<SemanticRole, string>> = {
  danger: 'bg-red-100 border-red-600 dark:bg-red-950 dark:border-red-500',
  advisory: 'bg-amber-100 border-amber-600 dark:bg-amber-950 dark:border-amber-500',
  positive: 'bg-green-100 border-green-600 dark:bg-green-950 dark:border-green-500',
  neutral: 'bg-slate-100 border-slate-400 dark:bg-slate-800 dark:border-slate-600',
};

/**
 * Background only, without the border. Several surfaces carry a role background and take their
 * border from the layout rather than from the role — a tinted panel inside an already-bordered
 * card, for one. Keeping this separate from ROLE_SURFACE means those sites do not have to strip a
 * border they never asked for.
 */
export const ROLE_SURFACE_BG: Readonly<Record<SemanticRole, string>> = {
  danger: 'bg-red-100 dark:bg-red-950',
  advisory: 'bg-amber-100 dark:bg-amber-950',
  positive: 'bg-green-100 dark:bg-green-950',
  neutral: 'bg-slate-100 dark:bg-slate-800',
};

export const ROLE_TEXT: Readonly<Record<SemanticRole, string>> = {
  danger: 'text-red-700 dark:text-red-300',
  advisory: 'text-amber-700 dark:text-amber-300',
  positive: 'text-green-700 dark:text-green-300',
  neutral: 'text-slate-700 dark:text-slate-300',
};

export const ROLE_BORDER: Readonly<Record<SemanticRole, string>> = {
  danger: 'border-red-600 dark:border-red-500',
  advisory: 'border-amber-600 dark:border-amber-500',
  positive: 'border-green-600 dark:border-green-500',
  neutral: 'border-slate-400 dark:border-slate-600',
};

// ═══════════════════════════════════════════════════════ chrome roles, as class pairs
/**
 * WHAT THE MIGRATION FOUND, and it is the reason this section exists.
 *
 * Scanning the 751 raw colour sites for light/dark pairs turned up 70 distinct pairs — and several
 * of them are THE SAME INTENT SPELLED DIFFERENT WAYS:
 *
 *     text-slate-900 + dark:text-white       73×  }  one heading colour,
 *     text-slate-900 + dark:text-slate-50    20×  }  two answers in dark mode
 *
 *     bg-white + dark:bg-dark-surface        47×  }
 *     bg-white + dark:bg-neutral-900         15×  }  one card surface,
 *     bg-white + dark:bg-neutral-950          6×  }  four answers
 *     bg-white + dark:bg-neutral-700          3×  }
 *
 * Nobody chose four card surfaces. They accumulated, one screen at a time, and no check compared
 * them because there was nothing for a check to compare them TO. Each intent below picks one
 * answer, and the variants collapse into it — which is what "enforced at token level" buys.
 *
 * WHERE A COLLAPSE CHANGED A PIXEL it is named in the WP-4.1 record, not hidden in a diff.
 */

/** Text roles. `inverse` is for text on an inverted surface; `onAccent` for text on a solid accent. */
export const TEXT = {
  heading: 'text-slate-900 dark:text-slate-50',
  body: 'text-slate-700 dark:text-slate-200',
  secondary: 'text-slate-600 dark:text-slate-300',
  /**
   * MUTED IS slate-600 IN LIGHT MODE, WHICH MAKES IT IDENTICAL TO `secondary` THERE, and that is
   * a decision AA forced rather than one anybody preferred.
   *
   * At slate-500 it measured **4.34:1 on SURFACE.sunken** — below the 4.5:1 floor. There is no
   * Tailwind shade between 500 and 600, so the choice was a darker muted or a lighter sunken
   * surface, and lightening the surface would have moved every panel in the app to rescue one text
   * colour. AA is a floor and not a preference: quiet text that cannot be read is not quiet, it is
   * absent.
   *
   * The distinction survives where there is room for it — `muted` is slate-400 in dark mode and
   * `secondary` is slate-300. Two tokens sharing a value in one mode is worth saying out loud, and
   * this is the sentence saying it.
   */
  muted: 'text-slate-600 dark:text-slate-400',
  inverse: 'text-white dark:text-slate-900',
  onAccent: 'text-white',
} as const;

/** Surfaces, from the page ground upward. */
export const SURFACE = {
  page: 'bg-slate-50 dark:bg-app-dark',
  card: 'bg-white dark:bg-dark-surface',
  sunken: 'bg-slate-100 dark:bg-neutral-800',
  raised: 'bg-slate-200 dark:bg-neutral-700',
  inverse: 'bg-slate-900 dark:bg-slate-100',
  /**
   * The page ground re-declared for DARK MODE ONLY. Three screens put this on an inner container
   * whose light background already comes from the RtlScreen above it. It is a real pattern, not an
   * oversight, so it gets a real name rather than being flattened into `page` — which would paint a
   * light ground twice and change what the light theme looks like.
   */
  pageDarkOnly: 'dark:bg-app-dark',
  /**
   * The ground behind a modal. Black at 60% in both themes on purpose: a scrim is not a surface,
   * it is the absence of one, and tinting it with the theme would make the dimming look like a
   * colour choice rather than a removal of the page.
   */
  modalScrim: 'bg-black/60',
} as const;

/** Hairlines. `subtle` is the quieter of the two and separates items inside one surface. */
export const BORDER = {
  hairline: 'border-slate-300 dark:border-neutral-700',
  subtle: 'border-slate-200 dark:border-neutral-800',
  /**
   * A single hairline along the top edge, for rows in a list that share a container. Named because
   * `border-t-slate-200` is still a colour literal — Tailwind's one-sided variants spell the
   * property differently and the A8 gate did not see them until this one turned up.
   */
  topHairline: 'border-t-slate-200 dark:border-t-neutral-700',
} as const;

/**
 * WHICH TEXT BELONGS ON WHICH SURFACE — read by the A9 gate, which measures the contrast of each.
 *
 * The gate's first version took the cartesian product of every text token and every surface token
 * and reported four failures, all of them pairings nobody would ever write: `TEXT.heading` on
 * `SURFACE.inverse` is dark-on-dark, and the inverse surface exists precisely so that
 * `TEXT.inverse` can sit on it.
 *
 * Measuring combinations the design system does not offer produces noise, and noise is how a
 * contrast report stops being read. So the pairings are DECLARED, and the gate measures exactly
 * these. Declaring them is also the point: a designer adding a surface has to say what text goes on
 * it, and the moment they do, the ratio is checked in both modes.
 */
export const LEGIBLE_ON: Readonly<Record<keyof typeof SURFACE, readonly (keyof typeof TEXT)[]>> = {
  page: ['heading', 'body', 'secondary', 'muted'],
  card: ['heading', 'body', 'secondary', 'muted'],
  sunken: ['heading', 'body', 'secondary', 'muted'],
  raised: ['heading', 'body', 'secondary'],
  inverse: ['inverse'],
  pageDarkOnly: ['heading', 'body', 'secondary', 'muted'],
  modalScrim: ['onAccent'],
};

/**
 * THE ACCENT IS NOT A SEMANTIC ROLE. Blue means "this is interactive" or "notice this". It carries
 * no verdict about a user's money, which is exactly why it must not be one of A8's three: a colour
 * that means both "tap here" and "this is fine" means neither.
 *
 * The `sky` family collapses into this. It was one informational panel — upcoming charges — and an
 * information panel is a thing to notice, not a judgement.
 */
export const ACCENT = {
  text: 'text-blue-700 dark:text-blue-200',
  surface: 'bg-blue-50 dark:bg-blue-950',
  surfaceStrong: 'bg-blue-100 dark:bg-blue-950',
  border: 'border-blue-600 dark:border-blue-400',
  borderSubtle: 'border-blue-200 dark:border-blue-900',
  solid: 'bg-blue-600',
} as const;

/**
 * THE PROMO SURFACE. Violet, and one screen: the promotion-code entry in Settings. It is chrome,
 * not a semantic role — a promo code is neither a danger, nor an advisory, nor a verdict about
 * anybody's money, and giving it one of A8's three hues would make that hue mean two things.
 *
 * It gets a name here for the same reason the innocent colours do: A8's second half says *no raw
 * colour literal outside the token module*, and makes no exception for a colour that happens to be
 * harmless.
 */
export const PROMO = {
  text: 'text-violet-800 dark:text-violet-200',
  textSubtle: 'text-violet-700 dark:text-violet-300',
  surface: 'bg-violet-50 dark:bg-violet-950',
  border: 'border-violet-200 dark:border-violet-900',
  solid: 'bg-violet-600',
} as const;

// ═════════════════════════════════════════════════════════════════════ chrome

/**
 * Colours the React Native APIs need as VALUES rather than classes — navigation themes, StatusBar,
 * ActivityIndicator, Switch. NativeWind cannot reach those, so they are named here and imported.
 */
export const CHROME = {
  /** Page background, dark mode. Mirrors tailwind.config.js `app-dark`; the gate compares them. */
  appDark: '#141414',
  /** Raised surface, dark mode. Mirrors tailwind.config.js `dark-surface`. */
  darkSurface: '#1E1E1E',
  /** Page background, light mode — slate-50. */
  appLight: '#F8FAFC',
  /** Pure white, for content that must not tint. */
  white: '#FFFFFF',
  /** Deepest ink — slate-900. */
  ink: '#0F172A',
  /** Body ink on light — slate-700. */
  inkMuted: '#334155',
  /** Secondary text — slate-500. */
  muted: '#64748B',
  /** Tertiary text and inactive tab tint — slate-400. */
  subtle: '#94A3B8',
  /** Hairline on light — slate-300. */
  hairline: '#CBD5E1',
  /** Hairline on dark — neutral-800. */
  hairlineDark: '#262626',
  /** Body ink on dark — slate-600. */
  inkDark: '#475569',
  /** Raised surface, dark — slate-800. */
  surfaceDark: '#1E293B',
  /** The interactive accent — blue-600. Not a semantic role: it means "tap this". */
  accent: '#2563EB',
  /** The privacy overlay's ground. Deliberately near-black and not `appDark`: it must read as a
   *  deliberate cover rather than as the app's own background showing through. */
  privacyScrim: '#0A0A0A',
  /** Danger as a VALUE, for the RN APIs that cannot take a class. Same red the danger role owns. */
  dangerValue: '#DC2626',
  /** A soft danger tint on dark grounds — red-300. */
  dangerSoft: '#FCA5A5',
} as const;

// ═════════════════════════════════════════════════════════════════════ brand

/**
 * Issuer and bank identity colours. THESE ARE NOT SEMANTIC. A card being Bank Leumi blue says
 * nothing about whether using it is a good idea, and the gate must never see them as verdict
 * colours — which is why they are values in a named map here rather than hues in a screen.
 */
export const BRAND_NEUTRAL = '#6B7280';

export const BANK_BRAND: Readonly<Record<string, string>> = {
  לאומי: '#1D4ED8',
  הפועלים: '#DC2626',
  דיסקונט: '#7C3AED',
  מזרחי: '#EA580C',
};

export const ISSUER_BRAND = {
  max: '#FF6B00',
  isracard: '#0057B7',
  cal: '#6B21A8',
} as const;
