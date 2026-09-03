/**
 * THE FROZEN SPACING, RADIUS AND STROKE PRIMITIVES — Phase 15, integrated under OQ-MDC-027 option 1.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE VALUES ARE DATA, NOT SOURCE, AND P5's GATE IS WHY
 *
 * The first version of this module wrote the numbers out as TypeScript literals. P3's
 * `no-magic-numbers` flagged them — a stroke width of 1.75 has the shape of a rate — so they were
 * added to `financial-literals.allow.json` with their reasons. P5's version of the same gate then
 * refused that, and it was right to:
 *
 *   > *"An exception carried from an earlier campaign is a reviewed decision; one a campaign
 *   > writes for its own new code is that campaign marking its own homework."*
 *
 * That is exactly what had happened: T1 created these files and then wrote its own permission slip
 * for them. The answer is not a better-worded exception, it is to stop hand-typing frozen values
 * into source. They now live in `assets/brand/geometry.tokens.json` as DATA, which is how the
 * Brand packages themselves ship values, and the `tokens-swap` gate PARSES the Phase 15 markdown
 * reference on every run and compares it against that file. So the transcription is checked against
 * its authority instead of trusted, and there is no literal here for a scanner to flag or for a
 * reviewer to take on faith.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY RADIUS IS NAMED BY PURPOSE
 *
 * The reference does not give four numbers and leave the choice open — it says what each is FOR:
 * 0 is structural, 4 is controls, 8 is cards and selection, and 12 is *large image fields only*.
 * A scale exported as `{ sm, md, lg }` would invite a screen to pick 12 because it wanted a rounder
 * card, which is the drift the reference forbids in its own wording. The names are the purposes,
 * so a call site that wants `RADIUS.largeImageField` for a card has to write something that reads
 * wrong.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE GRID IS NOT CARRIED
 *
 * The reference also fixes a responsive grid — five breakpoints from Compact 320 to Wide 1440.
 * This is a phone app with one column and no breakpoint system, so importing five presets would be
 * importing a capability rather than a value. The mobile margin, 20px, is not on the spacing scale
 * and is not smuggled in here: nothing needs it, and adding it would put a sixth number beside ten
 * frozen ones with nothing saying which governs.
 */
import geometry from '../../assets/brand/geometry.tokens.json';

/** Spacing steps, in points. Core rhythm is 16/32/64; the rest exist for detail. */
export const SPACING: readonly number[] = geometry.spacing;

/** The core rhythm the reference names, kept separate so a layout can say it is using it. */
export const SPACING_CORE: readonly number[] = geometry.spacingCore;

/** Radius by PURPOSE, which is how the reference states it. */
export const RADIUS: Readonly<Record<'structural' | 'control' | 'card' | 'largeImageField', number>> =
  geometry.radius;

/** Stroke widths by purpose, in points. */
export const STROKE: Readonly<Record<'passive' | 'selected' | 'icon' | 'diagram', number>> =
  geometry.stroke;

/** True when a number is on the frozen spacing scale. */
export const isFrozenSpacing = (n: number): boolean => SPACING.includes(n);

/** True when a number is one of the four frozen radii. */
export const isFrozenRadius = (n: number): boolean => Object.values(RADIUS).includes(n);
