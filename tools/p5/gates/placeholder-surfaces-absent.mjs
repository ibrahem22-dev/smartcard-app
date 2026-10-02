/**
 * GATE: placeholder-surfaces-absent — criterion B2.  →  `PLACEHOLDER-SURFACES-ABSENT OK`
 *
 *   > **B2** *(as corrected by assumption A10)*: *"All five P5 surfaces render P5 content and no
 *   > route reaches a placeholder for any of them: Home, Wallet Cards, Card DNA and Plan Calendar
 *   > extend the screens P2–P4 shipped, and Plan Commitments replaces the evidenced empty state
 *   > that names it."*
 *
 * MEASURES: 'render' — the route resolution is read from the navigator source, and the one surface
 * that WAS a placeholder is proved on the rendered tree by a named suite. A source scan alone would
 * prove a component is imported; it would not prove the screen paints anything.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IT FORBIDS IS DERIVED FROM THE CODE'S OWN DECLARATION, NOT FROM A LIST HERE
 *
 * `NotYetSurface` takes an `ownedBy` prop, and its docblock says why: *"It names the PHASE that owns
 * it… a placeholder that cannot tell you who owes it is a placeholder that outlives the plan it came
 * from."* So the rule is exactly that: **no reachable `NotYetSurface` may declare an `ownedBy` that
 * names P5.** Two placeholders legitimately remain and neither claims to be P5's —
 *
 *   · Wallet → Benefits, `V1.x — Benefits Hub (spec §26; P5 contract §17)`
 *   · Check Verdict's no-draft state, `WP-15 … (P4 D1+D2)`
 *
 * — and a hand-written allowlist of "the ones that are fine" would have to be edited every time one
 * moved, and would go stale silently. Reading the declaration means the day somebody adds a
 * placeholder owned by P5, this gate fails without anybody remembering to update it.
 *
 * A SEARCH THAT FINDS NOTHING MUST NEVER READ AS A PASS. The population of `NotYetSurface` call
 * sites is asserted non-empty before any conclusion is drawn from it: if the component were renamed
 * and this gate found zero call sites, "no placeholder claims to be P5's" would be true and
 * meaningless.
 *
 * NEGATIVE CONTROL (contract §5 B2): re-register one placeholder on any route and watch this fail.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['B2'];
export const SENTINEL = 'PLACEHOLDER-SURFACES-ABSENT OK';
export const MEASURES = 'render';

const PLACEHOLDER = 'NotYetSurface';
const SCAN_ROOTS = ['src/screens', 'src/navigation', 'src/components'];
const SKIP_DIR = new Set(['__tests__', 'node_modules']);
const SUITE = 'src/screens/plan/__tests__/commitments.render.test.tsx';
const COMMITMENTS = 'src/screens/plan/CommitmentsScreen.tsx';
const PLAN_STACK = 'src/navigation/stacks/PlanStack.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

/**
 * THE OWNER IS THE TOKEN BEFORE THE EM DASH, NOT ANY MENTION OF P5 IN THE STRING.
 *
 * `ownedBy` reads `<owner> — <what it will be> (<authority>)`, and the authority half legitimately
 * cites P5's own contract for why a surface is NOT P5's:
 *
 *     ownedBy="V1.x — Benefits Hub (spec §26; P5 contract §17)"
 *
 * A first attempt matched `/\bP5[ab]?\b/` anywhere in the string and failed on exactly that line —
 * a check failing for the wrong reason, on the one placeholder whose text had just been corrected
 * to say the right thing. Nobody would have investigated it twice; they would have deleted the
 * citation, and the string would have stopped saying where the answer came from.
 */
const ownerOf = (ownedBy) => String(ownedBy).split(/[—–-]/)[0].trim();
const CLAIMS_P5 = (ownedBy) => /^P5[ab]?$/i.test(ownerOf(ownedBy));

const REQUIRED_CASES = [
  'renders the four groups in spec §15 order, with nothing in the vault',
  'gives an empty group its own line rather than letting it vanish',
  'paints the commitments the vault actually holds, each with its monthly figure',
  'sums nothing on this surface — the total is J1’s and comes from the load engine',
  'is not a NotYetSurface — the placeholder that named P5 is gone from this route',
];

const walk = (dir, out = []) => {
  let entries = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) { if (!SKIP_DIR.has(e)) walk(p, out); continue; }
    if (/\.tsx?$/.test(e)) out.push(p);
  }
  return out;
};

const renderConfigFor = (root) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) return { error: JEST_CONFIG + ' does not exist' };
  const config = createRequire(import.meta.url)(configPath);
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const render = projects.find((p) => p && p.displayName === RENDER_PROJECT);
  if (!render) return { error: JEST_CONFIG + ' has no "' + RENDER_PROJECT + '" project' };
  return { config: { ...render, rootDir: root, testMatch: ['**/' + SUITE] } };
};

export const run = async ({ root }) => {
  for (const rel of [COMMITMENTS, PLAN_STACK, SUITE]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — B2 has nothing to be about');
  }

  /* 1. The population of placeholder call sites, derived, and asserted non-empty. */
  const files = SCAN_ROOTS.flatMap((r) => walk(join(root, r)));
  if (files.length === 0) return fail('no source files found under ' + SCAN_ROOTS.join(', ') + ' — a search that finds nothing is not a pass');

  const sites = [];
  for (const file of files) {
    const rel = file.replace(root, '').replace(/^[\\/]/, '').replace(/\\/g, '/');
    if (rel.endsWith('src/components/' + PLACEHOLDER + '.tsx')) continue; /* the component itself */
    const body = readFileSync(file, 'utf8');
    if (!new RegExp('<' + PLACEHOLDER + '\\b').test(body)) continue;
    for (const m of body.matchAll(/ownedBy="([^"]*)"/g)) sites.push({ rel, ownedBy: m[1] });
  }
  if (sites.length === 0) {
    return fail('no <' + PLACEHOLDER + '> call site declares an ownedBy anywhere under ' + SCAN_ROOTS.join(', ')
      + ' — either the placeholder was renamed or the prop was dropped, and "no placeholder claims to be P5\'s" would then be true and meaningless');
  }

  /* 2. THE RULE: no reachable placeholder may say P5 owns it. */
  const p5Owned = sites.filter((s) => CLAIMS_P5(s.ownedBy));
  if (p5Owned.length) {
    return fail(
      p5Owned.length + ' placeholder(s) still declare a P5 owner: '
      + p5Owned.map((s) => s.rel + ' → owner "' + ownerOf(s.ownedBy) + '" in "' + s.ownedBy + '"').join(' · ')
      + ' — a placeholder that is still reachable is still shipped',
    );
  }

  /* 3. And the route that used to reach one now reaches the P5 surface. */
  const stack = readFileSync(join(root, PLAN_STACK), 'utf8');
  if (new RegExp('<' + PLACEHOLDER + '\\b').test(stack)) {
    return fail(PLAN_STACK + ' still renders a ' + PLACEHOLDER + ' — Plan Commitments is a P5 surface');
  }
  if (!/CommitmentsScreen/.test(stack)) {
    return fail(PLAN_STACK + ' does not render CommitmentsScreen, so the Commitments segment reaches no P5 surface');
  }

  /* 4. Measured on the rendered tree, by named case. */
  const { config, error } = renderConfigFor(root);
  if (error) return fail(error);
  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES, ['--config', JSON.stringify(config)]);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);
  if (!/Tests:\s+\d+ passed/.test(String(summary ?? ''))) {
    return fail('the suite reported no passing tests: ' + String(summary));
  }

  return ok(SENTINEL, [
    sites.length + ' ' + PLACEHOLDER + ' call site(s) found by walking ' + SCAN_ROOTS.join(', ') + ', and none declares a P5 owner:',
    ...sites.map((s) => '  · ' + s.rel + ' → owner "' + ownerOf(s.ownedBy) + '" · ' + s.ownedBy),
    PLAN_STACK + ' renders CommitmentsScreen and no placeholder.',
    SUITE + ' proves it on the rendered tree — the four groups in spec §15 order, an empty group',
    'keeping its own line, the vault\'s real commitments with their monthly figures, and NO total,',
    'because a total is J1\'s and comes from the load engine.',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
