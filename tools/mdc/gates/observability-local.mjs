/**
 * GATE: observability-local — the engineering half of criterion V9.  →  `OBSERVABILITY-LOCAL OK`
 *
 *   > **V9.** *"… the MDC-OBSERVABILITY ruling is implemented inside the OD-5 local-only stance
 *   > with its boundary gate green — attested by the Owner"*
 *
 * MDC-OBSERVABILITY option 1 (PD-MDC-066): NO remote telemetry; a local crash log the user can
 * inspect and manually share. This gate is the "boundary gate" that clause names. It proves, from
 * source and from the running suites, that the crash log exists, that it is installed at the root,
 * that it reaches the user through Settings, that nothing in it can transmit, and that nothing
 * about money can get into it. It does NOT close V9 — the store listing and the attestation are the
 * Owner's — it is the evidence the attestation can point at.
 *
 * MEASURES: runtime (the two suites run) plus source.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail, okOverPopulation, requireJestCases } from '../lib/report.mjs';
import { stripCommentsAndStrings } from '../lib/source.mjs';

export const SENTINEL = 'OBSERVABILITY-LOCAL OK';
export const FAILURE_SENTINEL = 'OBSERVABILITY-LOCAL FAILED';
export const MEASURES = 'runtime';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const CAMPAIGN_DIR = join(ROOT, '..', 'smartcard-data-pipeline', 'campaign-master');
const MODULE = join(ROOT, 'src', 'observability', 'crashLog.ts');
const SCREEN = join(ROOT, 'src', 'screens', 'CrashLogScreen.tsx');
const APP = join(ROOT, 'App.tsx');
const MORE_STACK = join(ROOT, 'src', 'navigation', 'stacks', 'MoreStack.tsx');
const SETTINGS = join(ROOT, 'src', 'screens', 'SettingsScreen.tsx');
const EN = join(ROOT, 'src', 'i18n', 'en.ts');
const AR = join(ROOT, 'src', 'i18n', 'ar.ts');
const REGISTER = join(ROOT, 'tools', 'p2', 'e1-backlog.json');
const UNIT_SUITE = 'src/observability/__tests__/crashLog.test.ts';
const RENDER_SUITE = 'src/screens/__tests__/crashLog.render.test.tsx';
const UNIT_CASES = [
  'records an uncaught error with its name, message and stack, on the device only',
  'redacts every run of three or more digits so no amount, last-four or date is stored',
  'keeps the newest entries only, MAX_ENTRIES deep',
  'cuts an over-long message and never throws from the handler',
  'clear empties the log and format renders plain text a user can paste',
  'installs in front of the platform handler exactly once and still calls the previous handler',
];
const RENDER_CASES = [
  'renders the empty state and says the log never leaves the device',
  'renders stored entries with their redacted message',
  'copy puts the formatted log on the clipboard and nothing else happens',
  'clear empties the log',
];
const NETWORK = ['fetch(', 'XMLHttpRequest', 'WebSocket', 'axios', 'expo-network', 'react-native-blob', 'firebase', 'sentry', 'bugsnag', 'crashlytics', 'datadog'];
const STRINGS = ['יומן קריסות', 'יומן קריסות: שגיאות שנשמרו במכשיר בלבד', 'היומן נשמר במכשיר בלבד ואינו נשלח לשום מקום. אפשר להעתיק אותו ולשתף ידנית.', 'אין קריסות שנשמרו', 'העתק', 'הועתק', 'נקה'];
const rel = (p) => relative(ROOT, p).replace(/\\/g, '/');
const read = (p) => readFileSync(p, 'utf8');

const rulingOf = (id) => {
  const rulingsPath = join(CAMPAIGN_DIR, 'OWNER_RULINGS.json');
  const queuePath = join(CAMPAIGN_DIR, 'state', 'OWNER_QUEUE.jsonl');
  if (existsSync(rulingsPath)) {
    const row = (JSON.parse(read(rulingsPath)).rulings || []).find((r) => r.id === id);
    if (row && row.ruling && row.ruling !== 'PENDING') return String(row.ruling).trim();
  }
  if (existsSync(queuePath)) {
    const a = read(queuePath).split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((e) => e.kind === 'OWNER_ANSWER' && e.id === id && e.by === 'owner').pop();
    if (a && String(a.ruling || '').trim() && String(a.ruling).trim() !== 'PENDING') return String(a.ruling).trim();
  }
  return null;
};

export const run = async () => {
  const problems = [];
  const clauses = [];

  /* 1. the ruling this implements is option 1 */
  const ruling = rulingOf('MDC-OBSERVABILITY');
  if (ruling !== '1') problems.push(`MDC-OBSERVABILITY is ${ruling ? `ruled '${ruling}'` : 'not ruled'} — this gate implements option 1 (no remote telemetry, local crash log) only`);
  else clauses.push('MDC-OBSERVABILITY option 1');

  /* 2. the module exists, imports one persistence driver and nothing that transmits */
  if (!existsSync(MODULE)) return fail(`no crash-log module at ${rel(MODULE)}`);
  const mod = read(MODULE);
  const modCode = stripCommentsAndStrings(mod);
  const imports = [...mod.matchAll(/^import\s+[^;]*?from\s+'([^']+)';/gm)].map((m) => m[1]);
  const external = imports.filter((s) => !s.startsWith('.'));
  const allowedExternal = ['react-native-mmkv'];
  for (const s of external) if (!allowedExternal.includes(s)) problems.push(`crashLog.ts imports '${s}' — only react-native-mmkv may be imported by the crash log`);
  for (const n of NETWORK) if (modCode.includes(n) || mod.toLowerCase().includes(n.toLowerCase().replace('(', ''))) problems.push(`crashLog.ts mentions '${n}' — the crash log may not transmit`);
  if (!/import\s+\{[^}]*MMKV[^}]*\}\s+from\s+'react-native-mmkv'/.test(mod)) problems.push('crashLog.ts does not use MMKV — a crash-time write must be synchronous');
  if (!/export const redact = \(text: string\): string => text\.replace\(\/\\d\{3,\}\/g, '###'\);/.test(mod)) problems.push('the redaction (every run of 3+ digits → ###) is missing or changed');
  if (!/redact\(clip\(err\.message/.test(mod) || !/redact\(clip\(err\.stack/.test(mod)) problems.push('message and stack are not both passed through redact() before storage');
  if (/from '\.\.\/(security|store|analytics|engines|data)\//.test(mod)) problems.push('crashLog.ts reaches into the vault, stores, analytics, engines or data layer — it must know nothing about them');
  if (!/if \(previous\) previous\(error, isFatal\);/.test(mod)) problems.push('the installed handler does not call the platform handler afterwards — the crash log must observe, never swallow');
  clauses.push(`crashLog.ts imports [${external.join(', ')}] and no network module; redaction and hand-off present`);

  /* 3. installed at the root, reachable from Settings, registered in the More stack */
  if (!existsSync(APP) || !/installCrashLog\(\);/.test(read(APP))) problems.push('App.tsx does not call installCrashLog() at the root');
  if (!existsSync(SCREEN)) problems.push(`no ${rel(SCREEN)}`);
  else {
    const screen = read(SCREEN);
    for (const n of NETWORK) if (screen.toLowerCase().includes(n.toLowerCase().replace('(', ''))) problems.push(`CrashLogScreen.tsx mentions '${n}'`);
    if (!/expo-clipboard/.test(screen)) problems.push('CrashLogScreen.tsx does not offer the clipboard — "manually share" needs a way out that the user drives');
  }
  if (!existsSync(MORE_STACK) || !/name="CrashLog"/.test(read(MORE_STACK))) problems.push('MoreStack.tsx does not register the CrashLog route');
  if (!existsSync(SETTINGS) || !/navigate\('CrashLog'\)/.test(read(SETTINGS))) problems.push('SettingsScreen.tsx has no entry that navigates to CrashLog');
  clauses.push('installed in App.tsx, CrashLog route in MoreStack, Settings entry present');

  /* 4. the copy is in all three languages */
  const en = existsSync(EN) ? read(EN) : '', ar = existsSync(AR) ? read(AR) : '';
  for (const s of STRINGS) {
    if (!en.includes(`'${s}'`)) problems.push(`en.ts carries no translation for '${s}'`);
    if (!ar.includes(`'${s}'`)) problems.push(`ar.ts carries no translation for '${s}'`);
  }
  clauses.push(`${STRINGS.length} strings translated in en and ar`);

  /* 5. the D7 register names exactly this file for its MMKV read, and nothing wider */
  const disp = existsSync(REGISTER) ? (JSON.parse(read(REGISTER)).dispositions || []).filter((d) => d.id === 'ALLOW-CRASH-LOG-MMKV') : [];
  if (disp.length !== 1) problems.push(`tools/p2/e1-backlog.json carries ${disp.length} ALLOW-CRASH-LOG-MMKV disposition(s), not exactly one`);
  else if (disp[0].file !== '^src/observability/crashLog\\.ts$' || !/react-native-mmkv/.test(disp[0].message)) problems.push('ALLOW-CRASH-LOG-MMKV is not scoped to exactly src/observability/crashLog.ts and its MMKV import');
  else clauses.push('D7 register: one disposition, scoped to the one file');

  /* 6. the suites run and every named case passes */
  const unit = requireJestCases(ROOT, UNIT_SUITE, UNIT_CASES);
  const render = requireJestCases(ROOT, RENDER_SUITE, RENDER_CASES);
  problems.push(...unit.problems, ...render.problems);
  clauses.push(`${UNIT_CASES.length} unit and ${RENDER_CASES.length} render cases named and passing`);

  const population = UNIT_CASES.length + RENDER_CASES.length + STRINGS.length + 1;
  if (problems.length) return fail(problems.join(' · '), { population });
  return okOverPopulation({ population, unit: 'case(s), string(s) and module(s)', detail: clauses.join(' · ') });
};
