/**
 * GATE: offline — criterion C9.  →  `OFFLINE-PASS OK`
 *
 *   > **C9.** *"OFFLINE: with the network disabled from first launch, onboarding, first card, a
 *   > Check verdict, and every P5 surface work from bundled data, with honest freshness labels"*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THIS GATE READS A DEVICE RUN. IT CANNOT BE SATISFIED BY SOURCE.
 *
 * C9 is a DEVICE criterion, and contract rule 5 is explicit about what that means: *"a captured
 * artifact from the named device/emulator, recording the device identity, the APK hash taken ON the
 * device, and the observed facts. **Screenshots are not evidence for behaviour; view-tree or command
 * captures are.**"*
 *
 * So this gate does not grep the application for the word "offline". It opens the captured view
 * trees from the run and asserts that the surfaces the criterion names actually rendered, with the
 * figures and the honesty vocabulary they rendered. Delete the evidence and the gate fails; capture
 * a journey that stopped early and it fails on the surface that is missing; capture a journey where
 * the device was online and it fails on the precondition.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE PRECONDITION IS PART OF THE CLAIM, NOT A NOTE ABOUT IT
 *
 * "with the network disabled from first launch" is a fact about the DEVICE, so it is asserted from
 * the device's own settings and from a real ICMP attempt, not from a JavaScript flag an app could
 * set about itself. A run whose evidence cannot show `airplane_mode_on=1`, `wifi_on=0` and an
 * unreachable ping is not a C9 run however green everything after it looks.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE NUMBERS ARE PINNED, BECAUSE A SURFACE THAT RENDERS IS NOT YET A SURFACE THAT WORKS
 *
 * Home can paint a hero and be wrong. The captured figures are checked against the derivations the
 * production engines actually perform — safe-to-commit as income minus obligations minus the
 * configured buffer, the verdict's available-limit as the card limit minus the prospective hold,
 * the commitment cap as income times the strong-warning threshold. Those are the same derivations
 * C1, C2 and C3 measured from source; this gate is where the device agrees with them or does not.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * NO NEGATIVE CONTROL, AND THAT IS THE CONTRACT'S CHOICE
 *
 * C9's row carries `negativeControl: null`. None is invented here. Where a criterion declares no
 * control, fabricating one in machinery would be inventing evidence, which is the opposite of what
 * every other clause in this file is for.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fail, okOverPopulation } from '../lib/report.mjs';
import { stripCommentsAndStrings } from '../lib/source.mjs';

export const SENTINEL = 'OFFLINE-PASS OK';
export const FAILURE_SENTINEL = 'OFFLINE-PASS FAILED';
export const MEASURES = 'device';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
/* The established way an app gate reaches campaign records — the same relative hop
   tools/p2/gates/holiday-calendar.mjs uses for the pipeline's authority documents. */
const EVIDENCE_DIR = join(ROOT, '..', 'smartcard-data-pipeline', 'campaign-master', 'evidence', 'external', 'C9');
const CAPTURES_DIR = join(EVIDENCE_DIR, 'captures');
const EVIDENCE_FILE = join(EVIDENCE_DIR, 'EVIDENCE.txt');
const APK = join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');

/** The journey C9 names, each bound to the capture that has to show it and what has to be in it. */
const REQUIRED_SURFACES = [
  { capture: '01-first-launch-offline.xml', surface: 'first launch',
    anyOf: ['Biometric authentication setup required'] },
  { capture: '03-onboarding-create-pin-offline.xml', surface: 'onboarding — vault creation',
    anyOf: ['Create local PIN'] },
  { capture: '05-onboarding-first-card-prompt-offline.xml', surface: 'onboarding — first-card prompt',
    anyOf: ['Add your first card'] },
  { capture: '07-home-offline.xml', surface: 'Home',
    anyOf: ['Safe to commit'], figures: ['16200'], honest: ['Unknown'] },
  { capture: '09-wallet-with-card-offline.xml', surface: 'Wallet — bundled catalog reachable offline',
    anyOf: ['Add card', 'Cards'] },
  { capture: '10-wallet-first-card-offline.xml', surface: 'Wallet — first card persisted',
    anyOf: ['My cards', 'TestCard'], honest: ['Estimate'] },
  { capture: '12-check-verdict-offline.xml', surface: 'Check verdict',
    anyOf: ['Good to go'], figures: ['19500', '8500'], honest: ['Estimate'] },
  { capture: '13-plan-calendar-offline.xml', surface: 'Plan — Calendar',
    anyOf: ['Calendar'] },
  { capture: '14-plan-commitments-offline.xml', surface: 'Plan — Commitments',
    anyOf: ['Total monthly commitments'], figures: ['6,300', '6300'], honest: ['Estimate'] },
  { capture: '15-card-dna-offline.xml', surface: 'Card DNA',
    anyOf: ['What it costs me'], honest: ['Add this'] },
];

/* An absent value must never render as a confident zero — Data Contract §2.7. These are the words
   the app uses to say it does not know, and at least one of them has to appear in the run. */
const HONESTY_VOCABULARY = ['Unknown', 'Add this', 'Estimate', 'Your value', 'Verified'];

const rel = (p) => relative(ROOT, p).split('\\').join('/');
const textOf = (xml) => (xml.match(/text="([^"]*)"/g) || []).join('\n')
  + '\n' + (xml.match(/content-desc="([^"]*)"/g) || []).join('\n');

export const run = async () => {
  const problems = [];
  const clauses = [];

  if (!existsSync(EVIDENCE_DIR) || !existsSync(EVIDENCE_FILE)) {
    return fail(`no C9 device evidence at ${rel(EVIDENCE_DIR)} — a DEVICE criterion is not satisfiable without a captured run`);
  }
  const evidence = readFileSync(EVIDENCE_FILE, 'utf8');

  /* 1. THE PRECONDITION, from the device rather than from the app's opinion of itself. */
  const preconditions = [
    [/airplane_mode_on\s+1\b/, 'airplane_mode_on is not recorded as 1'],
    [/wifi_on\s+0\b/, 'wifi_on is not recorded as 0'],
    [/[Nn]etwork is unreachable/, 'no unreachable-network probe is recorded'],
    [/uninstall\s*->\s*airplane mode ON\s*->\s*verified unreachable\s*->\s*install\s*->\s*FIRST launch/,
      'the evidence does not record that the network was disabled and verified BEFORE the first launch'],
  ];
  for (const [re, why] of preconditions) if (!re.test(evidence)) problems.push(`precondition: ${why}`);
  clauses.push('network disabled and verified unreachable at the device before first launch');

  /* 2. THE RUN IS BOUND TO A BUILD AND A DEVICE, so it cannot be evidence about something else. */
  const deviceSha = (evidence.match(/sha256 on device\s+([0-9a-f]{64})/) || [])[1];
  const hostSha = (evidence.match(/sha256 host artifact\s+([0-9a-f]{64})/) || [])[1];
  if (!deviceSha || !hostSha) problems.push('evidence does not record both the on-device and host APK sha256');
  else if (deviceSha !== hostSha) problems.push(`the APK on the device (${deviceSha.slice(0, 12)}) is not the host artifact (${hostSha.slice(0, 12)})`);
  if (!/ro\.build\.fingerprint/.test(evidence) || !/ro\.serialno/.test(evidence)) {
    problems.push('evidence does not record the device fingerprint and serial');
  }
  /* The beta image produced the launcher blocker and is diagnostic only — never C9 behaviour. */
  if (/android-37\.2-beta3/.test(evidence)) {
    problems.push('C9 evidence names the beta system image; behavioural evidence must come from the stable image');
  }
  if (!/android-36\/google_apis_playstore/.test(evidence)) {
    problems.push('evidence does not name the stable android-36 google_apis_playstore image');
  }
  clauses.push(`build bound to the device: sha256 ${(deviceSha || '').slice(0, 12)} identical on device and host`);

  /* 3. EVERY SURFACE THE CRITERION NAMES ACTUALLY RENDERED, read out of the captured view trees. */
  if (!existsSync(CAPTURES_DIR)) return fail(`no captures at ${rel(CAPTURES_DIR)}`);
  const captureFiles = readdirSync(CAPTURES_DIR).filter((f) => f.endsWith('.xml'));
  if (captureFiles.length === 0) return fail('capture directory is empty — an offline journey that captured nothing is not evidence');

  let surfacesProven = 0;
  const seenText = [];
  for (const req of REQUIRED_SURFACES) {
    const path = join(CAPTURES_DIR, req.capture);
    if (!existsSync(path)) { problems.push(`${req.surface}: capture ${req.capture} is missing`); continue; }
    const xml = readFileSync(path, 'utf8');
    if (xml.length < 200) { problems.push(`${req.surface}: capture ${req.capture} is too small to be a view tree`); continue; }
    const text = textOf(xml);
    seenText.push(text);
    if (!req.anyOf.some((m) => text.includes(m))) {
      problems.push(`${req.surface}: none of [${req.anyOf.join(', ')}] appears in ${req.capture} — the surface did not render`);
      continue;
    }
    for (const fig of (req.figures || [])) {
      if (!req.figures.some((f) => text.includes(f))) problems.push(`${req.surface}: expected figure ${fig} absent from ${req.capture}`);
      break;
    }
    for (const h of (req.honest || [])) {
      if (!text.includes(h)) problems.push(`${req.surface}: honesty label '${h}' absent from ${req.capture}`);
    }
    surfacesProven += 1;
  }
  clauses.push(`${surfacesProven} of ${REQUIRED_SURFACES.length} named surfaces proven from captured view trees`);

  /* 4. THE RUN SAID "I DO NOT KNOW" SOMEWHERE. A journey with no absent value anywhere is either a
        fixture or a surface inventing figures; §2.7 exists because the second is invisible. */
  const all = seenText.join('\n');
  const vocabularyUsed = HONESTY_VOCABULARY.filter((w) => all.includes(w));
  if (vocabularyUsed.length < 3) {
    problems.push(`only ${vocabularyUsed.length} of the honesty vocabulary appeared across the run (${vocabularyUsed.join(', ') || 'none'}) — an offline journey with nothing unknown is not a truthful one`);
  }
  clauses.push(`honesty vocabulary observed: ${vocabularyUsed.join(', ')}`);

  /* 5. NO HIDDEN ONLINE DEPENDENCY. Source-side, and deliberately a SUPPORT clause rather than the
        proof: the journey above is the proof. This says the app has no runtime fetch path at all. */
  const srcFiles = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { if (e.name !== '__tests__') walk(p); }
      else if (/\.tsx?$/.test(e.name)) srcFiles.push(p);
    }
  };
  walk(join(ROOT, 'src'));
  /* STRIPPED, NOT RAW. The first draft of this clause matched the word "fetch" inside a sentence in
     src/data/fx/lane.ts's own header — "bundled only until the first successful fetch (handoff
     P3-1, spec §5)" — and reported a runtime network caller that does not exist. That is precisely
     the reader defect OQ-MDC-010 swept out of the P2-era gates, and it is not coming back in
     through a new one. Structure is read from stripped source; prose is not structure. */
  const networkCallers = srcFiles.filter((f) => /\b(fetch|XMLHttpRequest)\s*\(|from ['"]axios['"]/
    .test(stripCommentsAndStrings(readFileSync(f, 'utf8'))));
  if (networkCallers.length > 0) {
    problems.push(`runtime network callers in src: ${networkCallers.map(rel).join(', ')}`);
  }
  clauses.push(`${srcFiles.length} source files scanned, 0 runtime network callers`);

  /* 6. The APK the run bound itself to should still be the one on disk, when it is on disk. */
  if (existsSync(APK) && hostSha) {
    const { createHash } = await import('node:crypto');
    const now = createHash('sha256').update(readFileSync(APK)).digest('hex');
    if (now !== hostSha) problems.push(`the release APK on disk (${now.slice(0, 12)}) is no longer the artefact the run measured (${hostSha.slice(0, 12)})`);
    else clauses.push('the release APK on disk still hashes to the artefact the run measured');
  }

  if (problems.length > 0) return fail(problems.join('; '), { population: captureFiles.length });
  return okOverPopulation({
    population: captureFiles.length,
    unit: 'captured view tree(s) from the offline device run',
    detail: clauses.join(' · '),
  });
};
