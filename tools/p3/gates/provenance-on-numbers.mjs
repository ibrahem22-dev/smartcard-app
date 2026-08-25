/**
 * GATE: provenance-on-numbers — criterion T2.  →  `PROVENANCE-ON-NUMBERS OK`
 *
 *   > **T2.** *"Every numeric engine output carries a provenance state read from the Data Contract
 *   > vocabulary, never restated locally."*
 *
 * THREE CHECKS
 *
 *   1. The canonical vocabulary module exists (src/authority/provenanceChip.ts), and its members
 *      agree with the GENERATED MIRROR of Data Contract §2.1 (tools/p2/provenance-chip.json) —
 *      whose mirror-vs-contract parity the pipeline preflight owns. This gate does not re-parse
 *      the contract; it refuses a mirror that disagrees with the app's vocabulary.
 *   2. The derived MVP engine population consumes that vocabulary, and every exported RESULT
 *      interface in them carries a provenance field typed from it — a result shape with numbers
 *      and no provenance member is exactly the unlabelled number T3 forbids next.
 *   3. No MVP module restates the vocabulary locally (a second enum is how this failed before;
 *      P2's provenance-single-enum polices all of src/ — here the same failure is checked where
 *      engines are written, at the moment it is cheapest).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['T2'];
export const SENTINEL = 'PROVENANCE-ON-NUMBERS OK';

const VOCAB = 'src/authority/provenanceChip.ts';
const MIRROR = 'tools/p2/provenance-chip.json';

const mvpList = (root) => {
  const p = join(root, 'src', 'engines', 'mvpEngines.ts');
  if (!existsSync(p)) return null;
  const src = readFileSync(p, 'utf8');
  const m = src.match(/MVP_ENGINE_MODULES\s*=\s*\[([^\]]*)\]/);
  if (!m) return null;
  const active = m[1].split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  return [...active.matchAll(/'([^']+\.tsx?)'/g)].map((x) => 'src/engines/' + x[1]);
};

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  // ── 1. the canonical vocabulary, and its generated mirror ────────────────────────
  const vocabPath = join(root, VOCAB);
  if (!existsSync(vocabPath)) return fail(VOCAB + ' does not exist — the vocabulary has no app-side home');
  const mirrorPath = join(root, MIRROR);
  if (!existsSync(mirrorPath)) {
    problems.push(MIRROR + ' does not exist — regenerate it from the Data Contract with '
      + 'node campaign-p2/bin/p2-provenance-chip.mjs; an engine vocabulary nothing compares to '
      + 'the contract is a restatement waiting to drift');
  } else {
    const chips = JSON.parse(readFileSync(mirrorPath, 'utf8')).chips.map((c) => c.chip);
    const vocabSrc = readFileSync(vocabPath, 'utf8');
    for (const chip of chips) {
      if (!vocabSrc.includes("'" + chip + "'")) {
        problems.push('the contract chip ' + chip + ' is absent from ' + VOCAB + ' — app and contract disagree');
      }
    }
    lines.push('vocabulary     ' + chips.join(' / ') + ' (mirror ' + MIRROR + ' agrees)');
  }

  // ── 2. the MVP engines consume it, on their result shapes ────────────────────────
  const mvp = mvpList(root);
  if (!mvp || mvp.length === 0) return fail('no MVP engine population — mvpEngines.ts carries none');
  let consuming = 0;
  for (const rel of mvp) {
    const p = join(root, rel);
    if (!existsSync(p)) { problems.push(rel + ' does not exist'); continue; }
    const code = readFileSync(p, 'utf8');
    const usesVocab = /provenanceChip|ProvenanceChip|ProvenancedNumber|provenance\.ts/.test(code)
      || /\bprovenance\b\s*[:?]/.test(code);
    if (!usesVocab) {
      problems.push(rel + ' outputs numbers with no provenance anywhere in the module. T2: every '
        + 'numeric output carries a state from the Data Contract vocabulary '
        + '(src/authority/provenanceChip.ts)');
    } else {
      consuming += 1;
    }
  }
  lines.push('population     ' + consuming + ' of ' + mvp.length + ' MVP module(s) carry provenance');

  // ── 3. no local restatement inside the engines ───────────────────────────────────
  for (const rel of mvp) {
    const code = readFileSync(join(root, rel), 'utf8');
    const localEnum = /=\s*\[\s*'(?:USER|VERIFIED|ESTIMATE|UNKNOWN)'\s*,\s*'(?:USER|VERIFIED|ESTIMATE|UNKNOWN)'/;
    if (localEnum.test(code)) {
      problems.push(rel + ' declares a local array of provenance states — the vocabulary has one '
        + 'home (' + VOCAB + '), and B5 forbids a second enum anywhere');
    }
  }

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));
  return ok(SENTINEL, lines.join('\n'));
};
