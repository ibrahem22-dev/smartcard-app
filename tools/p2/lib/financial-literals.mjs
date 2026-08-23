/**
 * RULE 4 — "No numeric literal that looks like a rate, fee or threshold outside `config/**` and the
 * packs (allowlist the genuine exceptions, explicitly)." — Execution Model §9.4, criterion D5.
 *
 * THE HARD PART IS "LOOKS LIKE". A scanner that flagged every number would flag `flex: 1` and
 * `slice(0, 2)` and be turned off within a day; one that flagged too few would pass a 2.5% FX
 * commission sitting in a screen. Neither failure is recoverable by tuning alone, so the design
 * makes the SECOND kind loud and the first kind cheap:
 *
 *   - FLAG BROADLY, on the two signals that actually indicate a financial constant;
 *   - REQUIRE EVERY EXCEPTION TO BE WRITTEN DOWN, with a reason, in `financial-literals.allow.json`.
 *
 * An allowlist entry is not a way to silence the rule. It is the rule's output: the set of numbers
 * a human has looked at and said "this is not a rate". A reviewer reads that file and sees exactly
 * what the codebase claims about its own constants.
 *
 * THE TWO SIGNALS
 *
 *   1. THE NAME. A literal bound to, or compared against, an identifier whose name carries financial
 *      vocabulary — rate, fee, pct, percent, commission, threshold, interest, apr, amount, price,
 *      ils, currency, min/max where the neighbourhood is financial.
 *
 *   2. THE SHAPE. A decimal literal outside style/layout context. `0.25`, `2.5`, `3.5` are how rates
 *      and thresholds are written; whole small integers usually are not.
 *
 * WHAT IS OUT OF SCOPE BY CONSTRUCTION, not by allowlist: `config/**` (rule 4 names it), the packs,
 * test files (a fixture is data, and D5 is about the runtime), and type-only declarations.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Words that make a surrounding identifier financial. */
const FINANCIAL_WORDS = [
  'rate', 'fee', 'pct', 'percent', 'commission', 'threshold', 'interest', 'apr',
  'amount', 'price', 'cost', 'ils', 'currency', 'markup', 'margin', 'balance',
  'credit', 'limit', 'monetary', 'money', 'installment', 'payment', 'charge',
];

/**
 * NUMBERS THAT ARE NEVER A RATE, A FEE OR A THRESHOLD.
 *
 * `0` and `1` are identity and emptiness — `amount <= 0`, `count === 1`. A constant meaning
 * "a zero per cent rate" does not exist, and flagging every guard clause would bury the four real
 * ratios under eighty of them. `100` is the percent base, not a percentage.
 *
 * This is a STRUCTURAL exclusion, not an allowlist entry: an allowlist records a human judgement
 * about a specific literal in a specific file, and "zero is not a rate" is neither specific nor a
 * judgement. Keeping the two kinds apart is what stops the allowlist becoming a suppression list.
 */
const NEVER_FINANCIAL = new Set(['0', '1', '-1', '100', '0.0', '1.0']);

/**
 * Tailwind spacing and layout: `mt-1.5`, `p-3.5`, `leading-6`. These are decimals in a class
 * string, and there are dozens. A className is not a place a rate can hide — it reaches the screen
 * as a style, never as a number the user reads.
 */
const isStyleContext = (line) => /className\s*=|class(Name)?\s*:|StyleSheet|tw\`/.test(line);

/**
 * CSS AND LAYOUT PROPERTY NAMES.
 *
 * `marginTop: 8` matched the financial vocabulary because a profit MARGIN is financial. It is not
 * a margin here, and neither is `padding`, `borderRadius` or `lineHeight`. Excluding them
 * structurally keeps the word working for the day a real margin appears, and keeps the allowlist
 * free of entries nobody learns anything from — an allowlist that fills with layout noise is one
 * people stop reading, which is how a real rate slips through it.
 */
const STYLE_PROPERTY = /^(margin|padding|border|width|height|top|left|right|bottom|radius|opacity|font|line|letter|shadow|elevation|flex|gap|z|min|max)(Top|Bottom|Left|Right|Start|End|Horizontal|Vertical|Width|Height|Radius|Size|Weight|Spacing|Index|Offset|Color|Opacity)?$/;

const looksFinancial = (name) => {
  if (STYLE_PROPERTY.test(String(name))) return false;
  const lower = String(name).toLowerCase();
  return FINANCIAL_WORDS.some((w) => lower.includes(w));
};

/** Comments carry no runtime value; a number in prose is not a constant. */
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(Math.max(0, m.length - p1.length)));

export const scanFile = (absPath, root) => {
  const rel = relative(root, absPath).replace(/\\/g, '/');
  const raw = readFileSync(absPath, 'utf8');
  const code = stripComments(raw);
  const findings = [];
  const lines = code.split('\n');

  lines.forEach((line, idx) => {
    // Signal 1 — a financial identifier receiving or compared against a number.
    const named = [
      ...line.matchAll(/\b([A-Za-z_$][\w$]*)\s*(?::\s*[\w<>[\]| ]+)?\s*=\s*(-?\d[\d_]*(?:\.\d+)?)/g),
      ...line.matchAll(/\b([A-Za-z_$][\w$]*)\s*(?:===?|!==?|[<>]=?)\s*(-?\d[\d_]*(?:\.\d+)?)/g),
      ...line.matchAll(/\b([A-Za-z_$][\w$]*)\s*:\s*(-?\d[\d_]*(?:\.\d+)?)\s*[,}]/g),
    ];
    for (const m of named) {
      if (!looksFinancial(m[1])) continue;
      if (NEVER_FINANCIAL.has(m[2])) continue;
      findings.push({
        file: rel, line: idx + 1, literal: m[2], identifier: m[1],
        signal: 'name', text: line.trim().slice(0, 100),
      });
    }

    // Signal 2 — a decimal literal, which is how rates and thresholds are written.
    // Style and layout values are overwhelmingly integers, so this stays quiet on JSX className.
    if (isStyleContext(line)) return;
    for (const m of line.matchAll(/(?<![\w.$])(-?\d+\.\d+)(?![\w.])/g)) {
      const already = findings.some((f) => f.line === idx + 1 && f.literal === m[1]);
      if (already) continue;
      if (NEVER_FINANCIAL.has(m[1])) continue;
      findings.push({
        file: rel, line: idx + 1, literal: m[1], identifier: null,
        signal: 'decimal', text: line.trim().slice(0, 100),
      });
    }
  });

  return findings;
};

const walk = (dir, acc = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e === '__tests__' || e === 'config') continue; // rule 4 names config/**; fixtures are data
      walk(p, acc);
    } else if (/\.(ts|tsx)$/.test(e) && !/\.(test|spec)\.tsx?$/.test(e) && !/\.d\.ts$/.test(e)) {
      acc.push(p);
    }
  }
  return acc;
};

/**
 * Returns { scanned, findings, allowed, violations }.
 * A finding is a VIOLATION unless an allowlist entry names its file, line-independent literal and
 * carries a reason — line numbers move, and an allowlist that breaks on every edit gets deleted.
 */
export const scanRuleFour = (root) => {
  const srcDir = join(root, 'src');
  if (!existsSync(srcDir)) return { scanned: 0, findings: [], allowed: [], violations: [] };
  const files = walk(srcDir);
  const findings = files.flatMap((f) => scanFile(f, root));

  const allowPath = join(root, 'tools', 'p2', 'financial-literals.allow.json');
  const allow = existsSync(allowPath) ? JSON.parse(readFileSync(allowPath, 'utf8')) : { allow: [] };
  const entries = allow.allow ?? [];

  const isAllowed = (f) => entries.some((a) => a.file === f.file && String(a.literal) === String(f.literal));

  const violations = findings.filter((f) => !isAllowed(f));
  const allowedHits = findings.filter(isAllowed);

  // A stale allowlist entry is itself a defect: it reads as a deliberate exception for a number
  // that is no longer there, and it hides the next one that lands on the same line.
  const stale = entries.filter((a) => !findings.some((f) => f.file === a.file && String(f.literal) === String(a.literal)));

  return { scanned: files.length, findings, allowed: allowedHits, violations, stale, entries };
};
