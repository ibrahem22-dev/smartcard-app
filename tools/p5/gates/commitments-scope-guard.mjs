/**
 * GATE: commitments-scope-guard — criterion J5.  →  `COMMITMENTS-SCOPE-GUARD OK`
 *
 *   > **J5.** *"The scope guard holds: no transaction feed, no categorization, no budgeting
 *   > anywhere in Plan."*
 *
 * MEASURES: 'source'. There is nothing to render. J5 is a criterion written to refuse work, and the
 * only way to measure a refusal is to look for the thing that was refused.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THESE THREE, AND WHY HERE
 *
 * Plan Commitments is a list of money that leaves every month, and each of the three forbidden
 * things is one obvious step from it:
 *
 *   · a **transaction feed** — the list is already chronological-ish, so showing what was *paid*
 *     rather than what is *owed* is a small change with a completely different product behind it;
 *   · **categorization** — the rows already group, so tagging a commitment "groceries" feels like
 *     more of the same and is the front half of an expense tracker;
 *   · **budgeting** — J1 put a total and a cap on this screen, so a *"you have ₪800 left this
 *     month"* is one subtraction away and reads as the natural next sentence.
 *
 * None of them is a bad idea. All three are a different product, and the contract's deferral table
 * places them outside P5. The guard exists because the pull is toward them, not away.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE POPULATION IS DERIVED, AND AN EMPTY ONE FAILS
 *
 * §2 rule 4: derived, never hand-listed. Everything under `src/screens/plan/` is Plan, plus
 * anything the Plan stack renders. A sweep over zero files would pass silently and prove nothing —
 * §2 rule 5 — so an empty population is a failure, not a pass.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS GATE DELIBERATELY DOES NOT DO
 *
 * It does not forbid the WORDS. `category` is a real field on a `Benefit`, and Card DNA renders it;
 * a row may legitimately carry the category a benefit applies to. What J5 forbids is the FEATURE:
 * a user assigning categories, a screen grouping spending by them, a budget being set or a
 * remainder being computed. So the patterns look for the verbs and the affordances, not the nouns,
 * and the gate says which it found rather than reporting a bare count.
 *
 * NEGATIVE CONTROL: add a "budget remaining" figure to Plan and watch this fail.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['J5'];
export const SENTINEL = 'COMMITMENTS-SCOPE-GUARD OK';
export const MEASURES = 'source';

const PLAN_DIR = 'src/screens/plan';
const PLAN_STACK = 'src/navigation/stacks/PlanStack.tsx';

/** The three features, in the shape they would arrive in. Verbs and affordances, not nouns. */
const OUT_OF_SCOPE = [
  {
    feature: 'a transaction feed',
    why: 'Plan lists what is OWED each month. A feed shows what was PAID, which is a different product '
      + 'behind a very small change',
    patterns: [
      /\btransactionFeed\b/i,
      /\bfeedItems?\b/i,
      /\brecentTransactions\b/i,
      /\btransactionHistory\b/i,
    ],
  },
  {
    feature: 'categorization',
    why: 'the rows already group, so tagging a commitment feels like more of the same and is the front '
      + 'half of an expense tracker',
    patterns: [
      /\bsetCategory\b/i,
      /\bassignCategory\b/i,
      /\bcategorize\w*/i,
      /\bcategoryPicker\b/i,
      /\bonSelectCategory\b/i,
      /\bgroupBySpendingCategory\b/i,
    ],
  },
  {
    feature: 'budgeting',
    why: 'J1 put a total and a cap on this screen, so "you have X left this month" is one subtraction '
      + 'away and reads as the natural next sentence',
    patterns: [
      /\bbudget\w*/i,
      /\bremainingThisMonth\b/i,
      /\bleftToSpend\b/i,
      /\bspendingLimit\b/i,
      /\boverspen\w+/i,
    ],
  },
];

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const walk = (abs, acc = []) => {
  if (!existsSync(abs)) return acc;
  for (const entry of readdirSync(abs)) {
    const p = join(abs, entry);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(p);
  }
  return acc;
};

/** Every module the Plan stack renders, followed through relative imports one level. */
const planModules = (root) => {
  const files = walk(join(root, PLAN_DIR));
  const stack = join(root, PLAN_STACK);
  if (existsSync(stack)) files.push(stack);
  return files;
};

export const run = async ({ root }) => {
  const files = planModules(root);
  if (files.length === 0) {
    return fail(
      'no Plan modules found under ' + PLAN_DIR + ' — a scope guard over zero files passes silently and '
        + 'proves nothing (§2 rule 5), so an empty population is a failure',
    );
  }

  const problems = [];
  for (const abs of files) {
    const rel = abs.slice(root.length + 1).replace(/\\/g, '/');
    const src = stripComments(readFileSync(abs, 'utf8'));
    for (const { feature, why, patterns } of OUT_OF_SCOPE) {
      for (const re of patterns) {
        const hit = src.match(re);
        if (hit) {
          problems.push(rel + ' carries "' + hit[0] + '" — that is ' + feature + ', which J5 refuses. ' + why);
          break;
        }
      }
    }
  }

  if (problems.length) return fail(problems.join(' · '));

  return ok(SENTINEL, [
    'CRITERION J5 — the Plan scope guard, over ' + files.length + ' derived module(s).',
    'None of the three refused features is present:',
    ...OUT_OF_SCOPE.map((f) => '  · ' + f.feature),
    'Each is ONE obvious step from what Plan already does, which is why the guard exists. Plan lists',
    '  what is owed each month; a feed shows what was paid. The rows already group, so tagging one is',
    '  more of the same. And J1 put a total and a cap on this screen, so "you have X left this month"',
    '  is a single subtraction away and reads as the natural next sentence.',
    'None of them is a bad idea. All three are a different product, and the deferral table puts them',
    '  outside P5. The guard is here because the pull is toward them.',
    'It refuses the FEATURES, not the words: `category` is a real field on a Benefit and a row may',
    '  legitimately carry one. What is refused is a user assigning categories, a screen grouping',
    '  spending by them, and a budget being set or a remainder computed.',
  ].join('\n'));
};
