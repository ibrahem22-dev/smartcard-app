/**
 * WCAG CONTRAST, COMPUTED — criterion A9's *"AA contrast verified in both modes"*.
 *
 * Verified means measured. A designer's eye in one lighting condition is not verification, and
 * "looks fine" is the reason most apps ship a grey-on-grey label somebody with ordinary
 * middle-aged eyesight cannot read at all.
 *
 * The maths is WCAG 2.1 §1.4.3 and is short enough to state completely:
 *
 *   1. each sRGB channel is normalised to 0..1 and linearised — the transfer function is not a
 *      simple gamma, so the piecewise form below is the actual specification and not an
 *      approximation of it;
 *   2. relative luminance is the weighted sum 0.2126 R + 0.7152 G + 0.0722 B, weighted because the
 *      eye is far more sensitive to green than to blue;
 *   3. contrast is (lighter + 0.05) / (darker + 0.05).
 *
 * The 0.05 is not arbitrary either: it models the light a real screen reflects even when showing
 * black, which is why pure black on pure white is 21:1 and not infinite.
 *
 * AA is **4.5:1** for body text and **3:1** for large text (≥18.66px bold, or ≥24px). This module
 * computes; the gate decides which threshold applies.
 */

/** Tailwind's default palette, for the families this app uses. Values are Tailwind v3 sRGB hex. */
export const TAILWIND_PALETTE = {
  slate: {
    50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8',
    500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617',
  },
  neutral: {
    50: '#fafafa', 100: '#f5f5f5', 200: '#e5e5e5', 300: '#d4d4d4', 400: '#a3a3a3',
    500: '#737373', 600: '#525252', 700: '#404040', 800: '#262626', 900: '#171717', 950: '#0a0a0a',
  },
  red: {
    50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171',
    500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d', 950: '#450a0a',
  },
  amber: {
    50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24',
    500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03',
  },
  green: {
    50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80',
    500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d', 950: '#052e16',
  },
  blue: {
    50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa',
    500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a', 950: '#172554',
  },
  violet: {
    50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa',
    500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065',
  },
};

/** Colours this app defines itself, by the name its classes use. */
export const CUSTOM_COLOURS = {
  white: '#ffffff',
  black: '#000000',
};

export const parseHex = (hex) => {
  const h = String(hex).trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16));
};

/** sRGB → linear. The piecewise form IS the specification. */
const linearise = (channel) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = (hex) => {
  const [r, g, b] = parseHex(hex).map(linearise);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrastRatio = (foreground, background) => {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
};

/** `text-slate-700` / `bg-red-950` / `bg-white` → its hex, or null if it is not a colour class. */
export const hexForClass = (cls, custom = {}) => {
  const bare = cls.replace(/^dark:/, '');
  const m = bare.match(/^(?:bg|text|border(?:-[tblrsexy])?|ring|divide(?:-[tblrsexy])?)-(.+)$/);
  if (!m) return null;
  const rest = m[1];
  const named = { ...CUSTOM_COLOURS, ...custom }[rest];
  if (named !== undefined) return named;
  const shade = rest.match(/^([a-z]+)-(\d{2,3})$/);
  if (!shade) return null;
  const family = TAILWIND_PALETTE[shade[1]];
  if (!family) return null;
  return family[Number(shade[2])] ?? null;
};

export const AA_BODY = 4.5;
export const AA_LARGE = 3;
