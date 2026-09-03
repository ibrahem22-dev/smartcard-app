/**
 * THE ONE PLACE A COLOUR IS NAMED — now carrying the FROZEN TREVIK palette.
 *
 * A8: *"Semantic colour discipline enforced at token level: red = danger only, amber =
 * advisory/estimate, green = positive verdict only; no raw colour literal outside the token
 * module."* T1: *"the frozen identity palette, type scale and spacing are applied only through
 * src/theme/tokens.ts."*
 *
 * Every value here comes from the canonical Phase 11 `color.tokens.json`
 * (`status: FROZEN_COLOR_SYSTEM_V1`, `canonical: true`, Owner decision SELECT A2, hash-verified in
 * PHASE_11_COLOR_AUTHORITY_RECONCILIATION.md). Nothing is derived, tinted, blended or rounded.
 * The class names carry the token names, because the Brand engineering handoff asks integrators to
 * *"preserve semantic names and alias relationships rather than copying unlabelled HEX values"* —
 * so `ACCENT.solid` reads `bg-action-default`, which is `interaction.light.action.default`, and a
 * reviewer can follow it back to the package without a lookup table.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT CHANGED, AND THE RULING THAT REQUIRED IT — OQ-MDC-028 option 1
 *
 * A semantic role used to be a TINTED PANEL: `bg-red-100 border-red-600 text-red-700`. The frozen
 * system has no such thing. It defines each semantic as ONE hex — negative `#A03636`, warning
 * `#835900`, positive `#196B52` — with no surface, no tint and no border variant, in any of the
 * three canonical packages. That is not an omission. Its own web reference sets `color` and never
 * `background-color`; its accessibility table validates every semantic only as a FOREGROUND on the
 * neutral canvas; and its role matrix explicitly prohibits the two soft surfaces that do exist from
 * carrying semantic meaning. Deriving a tint would have invented a colour, which OQ-MDC-027
 * forbids in terms, and would have shipped a pairing nobody validated.
 *
 * So a role now paints its meaning in the FOREGROUND and the BOUNDARY, on the frozen neutral
 * surface. A danger panel is a white card with a red border and red text rather than a red-tinted
 * card. That is a deliberate pre-launch migration to the frozen system, ruled by the Owner, and it
 * is not a regression: the twenty resulting pairings were measured before the change and every one
 * passes AA, with the borders above 6:1 against a 3:1 target.
 *
 * THE DISTINCTION DOES NOT REST ON HUE. It never did — A9 requires icon plus word, T3 requires
 * shape and label redundancy across every adjacent accent/advisory pairing, and both are green
 * over these values. Removing the tint removes a fourth cue, not the only one.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * LIGHT ONLY, ENFORCED BY ABSENCE
 *
 * OQ-MDC-027 option 1 implements light mode for V1 and defers dark-mode implementation to the
 * register. Brand freezes a complete dark system — `neutral.dark.*`, `semantic.dark.*` and the
 * whole `interaction.dark.*` layer. NONE of it appears in this file or in `tailwind.config.js`.
 * Not one `dark:` variant survives, and the two dark colours the config used to declare are gone
 * with them. A dark value present but unreferenced is one variant away from shipping; a dark value
 * that does not exist cannot.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * TWO KINDS OF COLOUR LIVE HERE, AND THEY ARE NOT THE SAME KIND OF THING
 *
 *   · SEMANTIC roles say what a thing MEANS. A8 governs them, and there are exactly three plus a
 *     neutral. Adding a fourth is a contract change, not a design tweak.
 *   · CHROME and third-party BRAND colours say what a thing IS — a surface, Bank Leumi's blue.
 *     They carry no verdict. They still live here, because A8's second half says *no raw colour
 *     literal outside the token module* and makes no exception for colours that happen to be
 *     innocent.
 */

// ═════════════════════════════════════════════════════════════════════ semantic roles (A8)

/** The three roles A8 names, plus neutral for "no judgement is being expressed". */
export type SemanticRole = 'danger' | 'advisory' | 'positive' | 'neutral';

/**
 * The hue each role owns. **One role per hue, one hue per role** — the gate asserts it, so the
 * A8 sentence is checkable rather than remembered.
 *
 * These are HUE NAMES, not values, and the frozen palette keeps every one of them true: negative
 * `#A03636` is a red, warning `#835900` is an amber, positive `#196B52` is a green. `neutral` moved
 * from `slate` to `warm-grey` because `#625C57` is a warm grey and calling it slate would have been
 * a sentence that stopped being true the moment the palette landed.
 */
export const ROLE_HUE: Readonly<Record<SemanticRole, string>> = {
  danger: 'red',
  advisory: 'amber',
  positive: 'green',
  neutral: 'warm-grey',
};

/** What each role is FOR, in the contract's own words. Read by the gate; printed in its output. */
export const ROLE_MEANING: Readonly<Record<SemanticRole, string>> = {
  danger: 'danger only — a refusal, a block, a loss, a destructive action',
  advisory: 'advisory or estimate — a caution, an unverified figure, a wait',
  positive: 'a positive verdict only — never mere success of a UI action',
  neutral: 'no judgement is being expressed about the user or their money',
};

/**
 * The class set a role's SURFACE applies: the frozen neutral surface, plus the role's own boundary.
 *
 * The background is `neutral.light.surface` for every role, identically, because the frozen system
 * has no semantic surface and inventing four would have been inventing four colours. The meaning
 * travels in the border and the text.
 */
export const ROLE_SURFACE: Readonly<Record<SemanticRole, string>> = {
  danger: 'bg-neutral-surface border-semantic-negative',
  advisory: 'bg-neutral-surface border-semantic-warning',
  positive: 'bg-neutral-surface border-semantic-positive',
  neutral: 'bg-neutral-surface border-neutral-border',
};

/**
 * Background only, without the border — for a panel that takes its boundary from the layout.
 *
 * Every role resolves to the same neutral surface, which is a true statement about the frozen
 * system rather than a shortcut. It is kept as a per-role map rather than collapsed to one constant
 * so that A9 keeps measuring `ROLE_TEXT.x` against `ROLE_SURFACE_BG.x` for each role: the pairing
 * that matters is the role's TEXT on the ground it actually sits on, and that check would disappear
 * if the ground stopped being addressable by role.
 */
export const ROLE_SURFACE_BG: Readonly<Record<SemanticRole, string>> = {
  danger: 'bg-neutral-surface',
  advisory: 'bg-neutral-surface',
  positive: 'bg-neutral-surface',
  neutral: 'bg-neutral-surface',
};

/** The role's meaning, as text. `semantic.light.*`, straight from the frozen package. */
export const ROLE_TEXT: Readonly<Record<SemanticRole, string>> = {
  danger: 'text-semantic-negative',
  advisory: 'text-semantic-warning',
  positive: 'text-semantic-positive',
  /** OQ-MDC-027 option 1: the app's neutral role maps to `neutral.light.text.secondary`. */
  neutral: 'text-neutral-text-secondary',
};

/**
 * The role's meaning, as a boundary.
 *
 * The semantic hex is authorised as a boundary: Brand validates `secondary control border` and
 * `selected border` at the 3:1 target, and each semantic measures above 6:1 on both neutral grounds
 * — comfortably past it. `neutral` takes `neutral.light.border`, the frozen passive divider, which
 * is what a boundary carrying no judgement is for.
 */
export const ROLE_BORDER: Readonly<Record<SemanticRole, string>> = {
  danger: 'border-semantic-negative',
  advisory: 'border-semantic-warning',
  positive: 'border-semantic-positive',
  neutral: 'border-neutral-border',
};

// ═══════════════════════════════════════════════════════════════════════ neutral chrome

/**
 * Text roles, from `neutral.light.*`.
 *
 * FOUR APP LEVELS ONTO TWO FROZEN ONES, said out loud rather than solved by invention. The frozen
 * system gives `text.primary` and `text.secondary` and nothing between them. So `heading` and
 * `body` are both primary, and `secondary` and `muted` are both secondary. The third frozen
 * neutral, `disabled` `#9C958E`, is NOT used for muted text: Brand's own table records it at
 * 2.81:1 and marks it EXEMPT as an inactive colour, so borrowing it for quiet-but-readable text
 * would ship text below AA on purpose.
 *
 * `inverse` is white on the inverse surface — `neutral.light.surface` on
 * `neutral.light.inverse-surface`. Brand's table pairs its inverse surface with `#F7F3ED`, but that
 * value is declared as `neutral.dark.text.primary`, and V1 activates no dark token.
 */
export const TEXT = {
  heading: 'text-neutral-text',
  body: 'text-neutral-text',
  secondary: 'text-neutral-text-secondary',
  muted: 'text-neutral-text-secondary',
  inverse: 'text-neutral-surface',
  /** Text on a solid action — `interaction.light.action.foreground`, an alias of the surface white. */
  onAccent: 'text-neutral-surface',
} as const;

/**
 * Surfaces, from the page ground upward.
 *
 * The frozen system names two grounds — `background` for the page and `surface` for what is raised
 * off it — and no third. `sunken` and `raised` therefore both resolve to the page background: a
 * recessed well inside a white card and a slightly lifted block are the same frozen value here,
 * and giving them different ones would have meant choosing a tint the package does not define.
 */
export const SURFACE = {
  page: 'bg-neutral-bg',
  card: 'bg-neutral-surface',
  sunken: 'bg-neutral-bg',
  raised: 'bg-neutral-bg',
  inverse: 'bg-neutral-inverse-surface',
  /**
   * The ground behind a modal. A scrim is not a surface — it is the absence of one — so it takes no
   * palette colour in either system, and tinting it with the brand would make the dimming read as a
   * colour choice rather than as the page being taken away.
   */
  modalScrim: 'bg-black/60',
} as const;

/** Hairlines, from `neutral.light.border`. `subtle` is the quieter of the two. */
export const BORDER = {
  hairline: 'border-neutral-border',
  subtle: 'border-neutral-border',
  /** A single hairline along the top edge, for rows in a list that share a container. */
  topHairline: 'border-t-neutral-border',
} as const;

/**
 * WHICH TEXT BELONGS ON WHICH SURFACE — read by the A9 gate, which measures the contrast of each.
 *
 * The pairings are DECLARED rather than taken as a cartesian product, so the gate measures what the
 * design system actually offers. A designer adding a surface has to say what text goes on it, and
 * the moment they do, the ratio is checked.
 */
export const LEGIBLE_ON: Readonly<Record<keyof typeof SURFACE, readonly (keyof typeof TEXT)[]>> = {
  page: ['heading', 'body', 'secondary', 'muted'],
  card: ['heading', 'body', 'secondary', 'muted'],
  sunken: ['heading', 'body', 'secondary', 'muted'],
  raised: ['heading', 'body', 'secondary'],
  inverse: ['inverse'],
  modalScrim: ['onAccent'],
};

/**
 * THE ACCENT IS NOT A SEMANTIC ROLE. It means "this is interactive" or "notice this". It carries no
 * verdict about a user's money, which is exactly why it must not be one of A8's three: a colour
 * that means both "tap here" and "this is fine" means neither.
 *
 * It is the frozen `interaction.light.*` layer: `action.default` for a solid action,
 * `selected.surface` and `selected` for a chosen option, `link.default` for a link. Those are
 * aliases of `brand.trevik.primary-strong` and `brand.trevik.primary`, and naming them by their
 * interaction role rather than by the brand colour they resolve to is the alias relationship the
 * handoff asks to be preserved.
 */
export const ACCENT = {
  text: 'text-action-default',
  surface: 'bg-selected-surface',
  surfaceStrong: 'bg-selected-surface',
  border: 'border-selected-border',
  borderSubtle: 'border-neutral-border',
  solid: 'bg-action-default',
  /** `interaction.light.link.default`, for text that navigates rather than acts. */
  link: 'text-link-default',
  /** `semantic.light.focus` — the focus indicator, which is a state and not a judgement. */
  focus: 'border-semantic-focus',
} as const;

/**
 * THE PROMO SURFACE — one screen, the promotion-code entry in Settings.
 *
 * It was violet, a hue the frozen system does not contain. Under the migration it takes
 * `brand.trevik.accent-soft` as its ground and `interaction.light.action.default` as its text,
 * which the role matrix authorises: accent-soft is *"a small badge or warm micro-surface"* and
 * this is one screen's entry field. It is chrome, not a semantic role — a promo code is neither a
 * danger, nor an advisory, nor a verdict about anybody's money.
 */
export const PROMO = {
  text: 'text-action-default',
  textSubtle: 'text-neutral-text-secondary',
  surface: 'bg-brand-accent-soft',
  border: 'border-brand-accent',
  solid: 'bg-action-default',
} as const;

// ═════════════════════════════════════════════════════════════════════ chrome

/**
 * Colours the React Native APIs need as VALUES rather than classes — navigation themes, StatusBar,
 * ActivityIndicator, Switch. NativeWind cannot reach those, so they are named here and imported.
 *
 * A8's fourth clause compares this map against `tailwind.config.js`: every custom colour the config
 * declares must carry the same hex here. One fact, two homes, and something comparing them.
 */
export const CHROME = {
  /** `neutral.light.background` — the page ground. */
  appLight: '#FBF9F6',
  /** `neutral.light.surface` — raised surfaces, and white where content must not tint. */
  white: '#FFFFFF',
  /** `neutral.light.text.primary`. */
  ink: '#221F1D',
  /** `neutral.light.text.secondary` — body ink and secondary text. */
  inkMuted: '#625C57',
  /** `neutral.light.text.secondary` again, where a tertiary tint was previously used. */
  muted: '#625C57',
  /** `neutral.light.disabled` — inactive tint and disabled foreground. */
  subtle: '#9C958E',
  /** `neutral.light.border` — the hairline. */
  hairline: '#D8D1CA',
  /** `neutral.light.inverse-surface`. */
  inverseSurface: '#1B2523',
  /** `interaction.light.action.default` — the interactive accent. Not a semantic role. */
  accent: '#6F421E',
  accentHover: '#5F3718',
  accentPressed: '#4F2D13',
  /** `interaction.light.selected` and its surface. */
  selected: '#9D602F',
  selectedSurface: '#EFE1D2',
  /** `interaction.light.link.default` and its hover. */
  link: '#285F84',
  linkHover: '#1E4B69',
  /** `semantic.light.focus`. */
  focus: '#9A5B00',
  /** `semantic.light.negative` as a VALUE, for the RN APIs that cannot take a class. */
  dangerValue: '#A03636',
  /** `semantic.light.positive` and `semantic.light.warning` as values, same reason. */
  positiveValue: '#196B52',
  warningValue: '#835900',
  /** `semantic.light.information`. */
  informationValue: '#285F84',
  /** `brand.trevik.primary`, `brand.trevik.accent` and its soft surface. */
  brandPrimary: '#9D602F',
  brandPrimarySoft: '#EFE1D2',
  brandAccent: '#C78B3D',
  brandAccentSoft: '#F4E7CC',
  /** `brand.sorlane.primary` — the master-brand anchor. Never a product state. */
  sorlanePrimary: '#27433F',
  /**
   * The privacy overlay's ground. Deliberately near-black and not a palette colour: it must read as
   * a deliberate cover rather than as the app's own background showing through. A scrim is the
   * absence of a surface, so it takes no brand value.
   */
  privacyScrim: '#0A0A0A',
} as const;

// ═════════════════════════════════════════════════════════════════════ third-party brand

/**
 * Issuer and bank identity colours. THESE ARE NOT TREVIK'S AND NOT SEMANTIC.
 *
 * A card being Bank Leumi blue says nothing about whether using it is a good idea, and the gate
 * must never see them as verdict colours — which is why they are values in a named map here rather
 * than hues in a screen. They are also outside the frozen system by nature: they belong to other
 * institutions, and the TREVIK palette has no authority to restate them.
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
