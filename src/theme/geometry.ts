/**
 * THE FROZEN SPACING, RADIUS AND STROKE PRIMITIVES — Phase 15, integrated under OQ-MDC-027 option 1.
 *
 * Copied from `Brand/09_Design_Library/01_Phase_15_Production_Design_Library_Figma_System/
 * 07_Grid_Spacing/GRID_SPACING_RADIUS_STROKE_REFERENCE.md`. Nothing is added and nothing is
 * interpolated: a value not on these scales is not available to this application.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE RADIUS SCALE IS NAMED BY PURPOSE AND NOT BY SIZE
 *
 * The package does not give four numbers and leave the choice open — it says what each is FOR:
 * 0 is structural, 4 is controls, 8 is cards and selection, and 12 is *large image fields only*.
 * A scale exported as `{ sm: 4, md: 8, lg: 12 }` would invite a screen to pick 12 because it wanted
 * a rounder card, which is precisely the drift the reference forbids in its own wording. The names
 * below are the purposes, so a call site that wants `radius.largeImageField` for a card has to
 * write something that reads wrong.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE GRID IS NOT REPRODUCED
 *
 * The reference also fixes a responsive grid — five breakpoints from Compact 320 to Wide 1440,
 * with margins and gutters per preset. This application is a phone app with one column and has
 * never had a breakpoint system, so importing five presets would be importing a capability rather
 * than a value. The MOBILE margin, 20px, is not on the spacing scale, and it is not smuggled in
 * here: no site needs it, and adding it would put a sixth number beside ten frozen ones with
 * nothing saying which governs.
 */

/** Spacing steps, in points. Core rhythm is 16/32/64; the rest exist for detail. */
export const SPACING = [4, 8, 12, 16, 24, 32, 48, 64, 96, 128] as const;
export type SpacingStep = (typeof SPACING)[number];

/** The core rhythm the reference names, kept separate so a layout can say it is using it. */
export const SPACING_CORE = [16, 32, 64] as const;

/** Radius by PURPOSE, which is how the reference states it. */
export const RADIUS = {
  /** Structural edges — panels that meet the frame. */
  structural: 0,
  /** Controls: buttons, inputs, chips. */
  control: 4,
  /** Cards and selection surfaces. */
  card: 8,
  /** Large image fields ONLY. Not a rounder card. */
  largeImageField: 12,
} as const;

/** Stroke widths by purpose, in points. */
export const STROKE = {
  /** Passive lines and dividers. */
  passive: 1,
  /** A selected boundary — the reference pairs 2px with a checkmark and a label. */
  selected: 2,
  /** Icon strokes. */
  icon: 1.75,
  /** Diagram strokes. */
  diagram: 1.5,
} as const;

/** True when a number is on the frozen spacing scale. Read by the tokens-swap gate. */
export const isFrozenSpacing = (n: number): boolean =>
  (SPACING as readonly number[]).includes(n);

/** True when a number is one of the four frozen radii. */
export const isFrozenRadius = (n: number): boolean =>
  Object.values(RADIUS).includes(n as (typeof RADIUS)[keyof typeof RADIUS]);
