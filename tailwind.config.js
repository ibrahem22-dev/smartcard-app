/** @type {import('tailwindcss').Config} */

/*
 * THE FROZEN TREVIK PALETTE, as Tailwind colour names — Phase 11, integrated under OQ-MDC-027
 * option 1 and OQ-MDC-028 option 1.
 *
 * Every hex below is copied from the canonical `color.tokens.json`
 * (`status: FROZEN_COLOR_SYSTEM_V1`, `canonical: true`). Nothing is derived, tinted or blended.
 * The names are the token names with the dots flattened, so a class reads as the alias it came
 * from — `bg-trevik-selected-surface` is `interaction.light.selected.surface` — which is what the
 * Brand engineering handoff asks for: *"preserve semantic names and alias relationships rather
 * than copying unlabelled HEX values."*
 *
 * LIGHT ONLY. OQ-MDC-027 option 1 implements light mode for V1 and defers dark-mode
 * implementation to the register. Brand freezes a complete dark system — `neutral.dark.*`,
 * `semantic.dark.*` and the whole `interaction.dark.*` layer — and NONE of it is declared here.
 * A dark value present but unreferenced is a value one `dark:` variant away from shipping, so the
 * deferral is enforced by absence rather than by discipline. `app-dark` and `dark-surface`, the two
 * colours this file used to declare, are gone with the `dark:` variants that consumed them.
 *
 * A colour added here must also appear in `CHROME` in `src/theme/tokens.ts` — A8's fourth clause
 * compares the two, because one fact with two homes and nothing comparing them is how they drift.
 */
const TREVIK_LIGHT = {
  // neutral.light.*
  'trevik-text': '#221F1D',
  'trevik-text-secondary': '#625C57',
  'trevik-bg': '#FBF9F6',
  'trevik-surface': '#FFFFFF',
  'trevik-border': '#D8D1CA',
  'trevik-inverse-surface': '#1B2523',
  'trevik-disabled': '#9C958E',

  // semantic.light.* — foregrounds and boundaries. There is no semantic SURFACE in the frozen
  // system, and none is invented here: OQ-MDC-028 option 1 puts semantic colour on a neutral ground.
  'trevik-positive': '#196B52',
  'trevik-negative': '#A03636',
  'trevik-warning': '#835900',
  'trevik-information': '#285F84',
  'trevik-focus': '#9A5B00',

  // interaction.light.*
  'trevik-action': '#6F421E',
  'trevik-action-hover': '#5F3718',
  'trevik-action-pressed': '#4F2D13',
  'trevik-selected': '#9D602F',
  'trevik-selected-surface': '#EFE1D2',
  'trevik-link': '#285F84',
  'trevik-link-hover': '#1E4B69',

  // brand.trevik.* / brand.sorlane.* — identity, never semantic meaning.
  'trevik-primary': '#9D602F',
  'trevik-primary-soft': '#EFE1D2',
  'trevik-accent': '#C78B3D',
  'trevik-accent-soft': '#F4E7CC',
  'sorlane-primary': '#27433F',
};

/*
 * THE FROZEN TYPE SCALE, BY TOKEN NAME — Phase 9, integrated under OQ-MDC-027 option 1.
 *
 * Only the sizes Tailwind's own scale cannot express are declared here. `text-xs` through
 * `text-2xl` already resolve to 12, 14, 16, 18, 20 and 24 — every one a frozen size — so
 * redeclaring them would put two names on one value for no gain. What Tailwind does NOT have is
 * 28, 32, 40 and 48: its `text-3xl` is 30 and its `text-4xl` is 36, and neither is on the frozen
 * scale. Those four are the sizes that had to be named, and they are named for the TOKEN rather
 * than for a size, so `text-data-xl` reads as "headline amount" and a reviewer can check the call
 * site against what the package says the token is for.
 *
 * Line heights come from the package too, resolved for Latin and Hebrew; Arabic's taller ratios
 * are carried in `src/theme/typography.ts`, where `typeStyle` can pick per language. A class
 * cannot vary by reader, which is exactly why the module exists beside these.
 */
const TREVIK_TYPE = {
  'h2': ['28px', { lineHeight: '36px' }],
  'h1': ['32px', { lineHeight: '40px' }],
  'display-l': ['40px', { lineHeight: '48px' }],
  'data-xl': ['40px', { lineHeight: '44px' }],
  'display-xl': ['48px', { lineHeight: '56px' }],
};

module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'media',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: TREVIK_LIGHT,
      fontSize: TREVIK_TYPE,
    },
  },
  plugins: [],
};
