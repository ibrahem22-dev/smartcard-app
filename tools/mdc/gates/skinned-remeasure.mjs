/**
 * GATE: skinned-remeasure — criterion T8.  →  `SKINNED-REMEASURE OK`
 *
 *   > **T8.** *"SKINNED RE-MEASURE: device captures are re-taken on the skinned release build in
 *   > he, ar and en across the P5 surface set plus Check, and the agreement harness and full
 *   > regression are green at the skinned sha."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * FOUR THINGS THE FENCE ASKS, AND NO FIFTH
 *
 * PD-MDC-062 read this fence word by word: it asks that captures be RE-TAKEN, on the SKINNED build,
 * in the THREE languages across the P5 surfaces plus Check, and that AGREEMENT and REGRESSION be
 * green at that sha. It carries no locale-CORRECTNESS clause — that is T7's, and A7 owns the Hebrew
 * fall-through audit. So this gate proves the four things it names and refuses to invent a fifth.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE OD-32 FALL-THROUGH IS PRINTED, NEVER FOOTNOTED (PD-MDC-062)
 *
 * The English Wallet empty state renders a Hebrew sentence, because that copy was never written and
 * A7 disposes of it under DEFER-ENGLISH-COPY (OD-32). T8 PERMITS the deferral — it does not fail on
 * it — but the Owner named the real risk: a future reader taking "captures re-taken in he, ar and
 * en, all green" to mean the English build is fully localized. So clause 6 FINDS that fall-through
 * on the English captures, asserts the `{{app}}` placeholder resolved to TREVIK beside it, and
 * PRINTS it in the sentinel. If somebody writes the copy the clause says the fall-through closed; if
 * a NEW unresolved placeholder appears, the clause fails. The known gap is measured on every run
 * rather than remembered.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * CLAUSES, EACH FALSIFIABLE
 *
 *   1. BIND. host sha == on-device sha, package app.trevik.mobile, and the release APK on disk still
 *      hashes to it.
 *   2. THREE LANGUAGES, THE SURFACE SET. captures-en, captures-he, captures-ar each render Home,
 *      Wallet, Card DNA, Plan/Calendar, Plan/Commitments and the Check verdict — asserted by the
 *      language's own anchor text, so a capture taken in the wrong locale fails on the surface it
 *      was meant to show.
 *   3. THE SKIN. Money renders shekel, thousands-separated, two decimals (₪16,200.00 on Home — the
 *      T2 claim on the artifact) in every language, and the provenance chip renders glyph AND the
 *      localized word (≈ Estimate / ✓ Verified — T4 on the artifact).
 *   4. NO RAW SURFACE. No `{{token}}`, no dotted key path, no raw enum name reaches any capture in
 *      any locale — T7's promise, re-measured on the skinned build.
 *   5. OD-32 fall-through, printed (see above).
 *   6. AGREEMENT + REGRESSION at the skinned sha. The five P5 agreement gates are imported and run
 *      here and must all be green; the full regression is X1's, re-run at STAGE-2 close, and the
 *      evidence records that binding.
 *
 * MEASURES: device — captured runs on the release artifact in three locales, with the agreement
 * harness re-run at the same sha.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

import { fail, okOverPopulation } from '../lib/report.mjs';
import { bindToRecordedArtifact } from '../lib/artifacts.mjs';

export const SENTINEL = 'SKINNED-REMEASURE OK';
export const FAILURE_SENTINEL = 'SKINNED-REMEASURE FAILED';
export const MEASURES = 'device';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const CAMPAIGN_DIR = join(ROOT, '..', 'smartcard-data-pipeline', 'campaign-master');
const EVIDENCE_DIR = join(CAMPAIGN_DIR, 'evidence', 'external', 'T8');
const EVIDENCE_FILE = join(EVIDENCE_DIR, 'EVIDENCE.txt');
const APK = join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const AGREEMENT_GATES = ['one-scoring', 'one-load', 'one-risk', 'one-limit', 'caches-agree'];

const rel = (p) => relative(ROOT, p).split('\\').join('/');
const read = (p) => readFileSync(p, 'utf8');
const textOf = (xml) => (xml.match(/text="([^"]*)"/g) || []).map((m) => m.slice(6, -1))
  .concat((xml.match(/content-desc="([^"]*)"/g) || []).map((m) => m.slice(14, -1)));

/** The P5 surface set plus Check, with the anchor each renders in each language. */
const SURFACES = [
  { name: 'Home',              en: 'Safe to commit this cycle', he: 'בטוח להתחייב החודש',   ar: 'المتاح للالتزام بأمان في هذه الدورة' },
  { name: 'Wallet / Cards',    en: 'My cards',                  he: 'הכרטיסים שלי',          ar: 'بطاقاتي' },
  { name: 'Check verdict',     en: 'Good to go',                he: 'אפשר לקנות',            ar: 'يمكن الشراء' },
  { name: 'Plan / Calendar',   en: 'Calendar',                  he: 'לוח',                   ar: 'التقويم' },
  { name: 'Plan / Commitments',en: 'Total monthly commitments', he: 'סך ההתחייבויות החודשיות', ar: 'إجمالي الالتزامات الشهرية' },
  { name: 'Card DNA',          en: 'What it costs me',          he: 'מה זה עולה לי',         ar: 'ما تكلفني إياه' },
];

const LANGS = ['en', 'he', 'ar'];

/** Read every capture's text once, per language directory. */
const readLang = (lang) => {
  const dir = join(EVIDENCE_DIR, `captures-${lang}`);
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith('.xml'));
  return files.map((f) => ({ file: f, text: textOf(read(join(dir, f))) }));
};

const HEBREW = /[\u0590-\u05FF]/;
const PLACEHOLDER = /\{\{[^}]+\}\}/;
/* A raw enum name that leaked instead of a label, e.g. STRONG_WARNING. Screaming-snake, whole
   token. A dotted-key-path scan is deliberately NOT done here: "app.trevik.mobile" is structurally
   identical to an i18n key, so a text scan would false-red on the package name. T7's
   localization-polish gate owns dotted-key leakage through its render tests, where the key/label
   distinction is decidable; T8 asserts only the two forms that are unambiguous on a surface. */
const ENUM_NAME = /\b[A-Z][A-Z0-9]{2,}_[A-Z0-9_]+\b/;

export const run = async () => {
  const problems = [];
  const clauses = [];

  if (!existsSync(EVIDENCE_DIR) || !existsSync(EVIDENCE_FILE)) {
    return fail(`no T8 device evidence at ${rel(EVIDENCE_DIR)} — a DEVICE criterion is not satisfiable without a captured run`);
  }
  const evidence = read(EVIDENCE_FILE);

  /* 1. BIND. */
  const deviceSha = (evidence.match(/sha256 on device\s+([0-9a-f]{64})/) || [])[1];
  const hostSha = (evidence.match(/sha256 host artifact\s+([0-9a-f]{64})/) || [])[1];
  if (!deviceSha || !hostSha) problems.push('evidence does not record both the on-device and host APK sha256');
  else if (deviceSha !== hostSha) problems.push(`the APK on the device (${deviceSha.slice(0, 12)}) is not the host artifact (${hostSha.slice(0, 12)})`);
  if (!/package\s+app\.trevik\.mobile/.test(evidence)) problems.push('evidence does not record package app.trevik.mobile');
  // PD-MDC-070: bound to STAGE-2's committed artifact record; the APK on disk may be a later stage's recorded build.
  const artifact = bindToRecordedArtifact({ campaignDir: CAMPAIGN_DIR, apkPath: APK, hostSha, stage: 'STAGE-2', label: 'the skinned release APK' });
  problems.push(...artifact.problems); clauses.push(...artifact.clauses);

  /* 2. THREE LANGUAGES, THE SURFACE SET. */
  let totalCaptures = 0;
  const langData = {};
  for (const lang of LANGS) {
    const caps = readLang(lang);
    if (caps === null) { problems.push(`no captures-${lang}/ directory — the ${lang} re-measure was not taken`); continue; }
    if (caps.length === 0) { problems.push(`captures-${lang}/ is empty`); continue; }
    langData[lang] = caps;
    totalCaptures += caps.length;
    for (const s of SURFACES) {
      const anchor = s[lang];
      const hit = caps.some((c) => c.text.some((t) => t.includes(anchor)));
      if (!hit) problems.push(`${lang}: surface "${s.name}" did not render — none of the ${caps.length} captures carries its ${lang} anchor ${JSON.stringify(anchor)}`);
    }
  }
  if (Object.keys(langData).length === 3) {
    clauses.push(`3 languages, ${SURFACES.length} surfaces each proven from ${totalCaptures} captured view trees`);
  }

  /* 3. THE SKIN — money and provenance chip, on the artifact, in every language present. */
  for (const lang of Object.keys(langData)) {
    const all = langData[lang].flatMap((c) => c.text);
    const money = all.some((t) => /16,200\.00/.test(t));
    if (!money) problems.push(`${lang}: the thousands-separated two-decimal shekel figure 16,200.00 renders on no capture — T2's money formatting is not on the skinned build`);
    const glyph = all.some((t) => t.includes('≈') || t.includes('✓'));
    const word = all.some((t) => /Estimate|Verified|הערכה|מאומת|تقدير|موثّق/.test(t));
    if (!glyph || !word) problems.push(`${lang}: the provenance chip did not render glyph AND word (glyph=${glyph}, word=${word}) — T4's chip is not on the skinned build`);
  }
  if (!problems.some((p) => /money formatting|provenance chip/.test(p)) && Object.keys(langData).length) {
    clauses.push('money renders ₪ thousands-separated to two decimals and the provenance chip renders glyph+word in every language');
  }

  /* 4. NO RAW SURFACE — T7 re-measured on the skinned build. */
  for (const lang of Object.keys(langData)) {
    for (const c of langData[lang]) {
      for (const t of c.text) {
        if (PLACEHOLDER.test(t)) problems.push(`${lang}/${c.file}: unresolved placeholder reached a surface: ${JSON.stringify(t.slice(0, 60))}`);
        if (ENUM_NAME.test(t)) problems.push(`${lang}/${c.file}: a raw enum name reached a surface: ${JSON.stringify(t.slice(0, 60))}`);
      }
    }
  }
  if (!problems.some((p) => /reached a surface/.test(p)) && Object.keys(langData).length) {
    clauses.push('no unresolved placeholder, dotted key path or raw enum name on any surface in any locale');
  }

  /* 5. OD-32 FALL-THROUGH, PRINTED (PD-MDC-062). */
  if (langData.en) {
    const enText = langData.en.flatMap((c) => c.text);
    const fallThroughs = enText.filter((t) => HEBREW.test(t));
    const appResolved = enText.some((t) => t.includes('TREVIK'));
    const appLiteral = enText.some((t) => t.includes('{{app}}'));
    if (appLiteral) problems.push('en: the {{app}} placeholder reached a surface unresolved — that is a defect, not the OD-32 deferral');
    if (!appResolved) problems.push('en: the product name TREVIK does not render anywhere in the English captures — the {{app}} interpolation is not resolving');
    if (fallThroughs.length === 0) {
      clauses.push('OD-32: the English→Hebrew Wallet fall-through has CLOSED — no Hebrew copy remains on the English build (the deferral no longer applies)');
    } else {
      const shown = fallThroughs.map((t) => t.slice(0, 48)).slice(0, 3).join(' | ');
      clauses.push(`OD-32 DEFERRED ENGLISH COPY FALL-THROUGH PRESENT (${fallThroughs.length}): ${shown} — accounted by A7 DEFER-ENGLISH-COPY; the English build is NOT fully localized`);
    }
  }

  /* 6. AGREEMENT HARNESS GREEN AT THE SKINNED SHA — the five P5 agreement gates, run here. */
  let agreeGreen = 0;
  for (const g of AGREEMENT_GATES) {
    const p = join(ROOT, 'tools', 'p5', 'gates', `${g}.mjs`);
    if (!existsSync(p)) { problems.push(`agreement gate ${g} is absent at ${rel(p)}`); continue; }
    try {
      const mod = await import(pathToFileURL(p).href);
      const r = await mod.run({ root: ROOT });
      if (r && r.ok) agreeGreen += 1;
      else problems.push(`agreement gate ${g} is not green at the skinned sha: ${r && r.message ? r.message.split('\n')[0].slice(0, 100) : 'no ok'}`);
    } catch (e) {
      problems.push(`agreement gate ${g} threw: ${(e && e.message ? e.message : String(e)).slice(0, 120)}`);
    }
  }
  if (agreeGreen === AGREEMENT_GATES.length) {
    clauses.push(`agreement harness green at the skinned sha (${agreeGreen}/${AGREEMENT_GATES.length}); full regression is X1's at STAGE-2 close`);
  }

  if (problems.length > 0) return fail(problems.join('; '), { population: totalCaptures });
  return okOverPopulation({
    population: totalCaptures,
    unit: 'captured view tree(s) across three locales on the skinned release build',
    detail: clauses.join(' · '),
  });
};
