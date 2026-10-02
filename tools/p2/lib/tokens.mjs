import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * READING THE DESIGN SYSTEM'S TOKEN MODULE — ONE IMPLEMENTATION, TWO CAMPAIGNS.
 *
 * These parsers were written inside `tools/p2/gates/a11y.mjs` for criterion A9. P5's `R3` needs the
 * same four maps to resolve the `${TOKEN.name}` interpolations that P5's surfaces write, so they
 * moved here rather than being copied.
 *
 * The reason is the failure this codebase has recorded more than any other: two implementations of
 * one fixed thing agree until somebody edits one of them, and then a gate keeps reporting green
 * against a stale reading of a file that has moved. `lib/contrast.mjs` already holds the arithmetic
 * for exactly this reason; the parsing belongs beside it.
 *
 * NOTE ON THE SPLIT OF WORK. A9 measures the pairings the design system DECLARES — body text on each
 * surface, each semantic role's text on its own background. R3 measures the pairings P5's files
 * actually COMPOSE, which is a different population and includes combinations no token declares
 * (a neutral label sitting on a danger background, say). Same tokens, same maths, different
 * question — which is why both gates exist and why they share everything except the population.
 */

/** Split a token's class string into its light and dark halves. */
export const splitModes = (classes) => {
  const light = [], dark = [];
  for (const c of classes.split(/\s+/).filter(Boolean)) {
    (c.startsWith('dark:') ? dark : light).push(c.replace(/^dark:/, ''));
  }
  return { light, dark };
};

export const pick = (list, prefix) => list.find((c) => c.startsWith(prefix + '-')) ?? null;

/** Read `export const NAME = { key: 'classes', ... }` out of the token module. */
export const readTokenMap = (src, name) => {
  const m = src.match(new RegExp('export const ' + name + '[^=]*=\\s*\\{([\\s\\S]*?)\\n\\}'));
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^\s*([A-Za-z_$][\w$]*)\s*:\s*'([^']*)'/);
    if (kv) out[kv[1]] = kv[2];
  }
  return out;
};

/** Read `export const LEGIBLE_ON ... = { surface: ['text', ...], ... }` out of the token module. */
export const readLegibleOn = (src) => {
  const m = src.match(/export const LEGIBLE_ON[^=]*=\s*\{([\s\S]*?)\n\}/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^\s*([A-Za-z_$][\w$]*)\s*:\s*\[([^\]]*)\]/);
    if (kv) out[kv[1]] = [...kv[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  }
  return out;
};

/**
 * The hex values the class names resolve to that Tailwind does not ship: the palette declared inline
 * in the token module, plus the app's own named colours from tailwind.config.js.
 *
 * Shared for the same reason as the parsers above. A contrast gate that cannot resolve a class to a
 * hex silently skips that pairing, so a drifted copy of this does not fail loudly — it measures less
 * and still says OK, which is the quiet version of the vacuous pass.
 */
export const customPalette = (root, tokenModule) => {
  const custom = {};
  const tokens = readFileSync(join(root, tokenModule), 'utf8');
  for (const m of tokens.matchAll(/^\s*([A-Za-z][\w]*):\s*'(#[0-9a-fA-F]{3,8})'/gm)) custom[m[1]] = m[2];
  const cfg = join(root, 'tailwind.config.js');
  const twConfig = existsSync(cfg) ? readFileSync(cfg, 'utf8') : '';
  for (const m of twConfig.matchAll(/'([a-z-]+)':\s*'(#[0-9a-fA-F]{3,8})'/g)) custom[m[1]] = m[2];
  return custom;
};
