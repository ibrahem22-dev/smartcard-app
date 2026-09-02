/**
 * GATE: notifications — criterion C4.  →  `NOTIFICATIONS OK`
 *
 *   > **C4.** *"NOTIFICATIONS: billing and fee-waiver reminders are scheduled from the
 *   > engine-owned schedule, permission flow is honest, and a reminder is observed firing on the
 *   > named device with a captured artifact"*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THIS GATE IS RED ON PURPOSE, AND IT SAYS WHY.
 *
 * C4 names TWO kinds of reminder and joins them with "and". The billing half is built and was
 * proved on the device. The fee-waiver half has no reachable input: `cardFee` and
 * `cardIssuanceDate` are written by exactly one module, and that module is not reachable from the
 * mounted application. Clause 6 walks the import graph and reports that, by name.
 *
 * A gate that printed NOTIFICATIONS OK on the billing half alone would be a false green over a
 * criterion whose own wording forbids it. That is the failure this campaign has spent more
 * receipts on than any other, and it is not being reintroduced by the gate that is supposed to
 * catch it. The clause goes green when the Owner's ruling on OQ-MDC-019 has been carried out —
 * either because the inputs exist, or because the criterion has been narrowed under a named
 * ruling and this clause is removed WITH that authority.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE BILLING HALF IS PROVED FROM A DEVICE RUN, NOT FROM SOURCE.
 *
 * Contract rule 5: a DEVICE criterion needs "a captured artifact recording the device identity,
 * the APK hash taken ON the device, and the observed facts", and "screenshots are not evidence
 * for behaviour; view-tree or command captures are." So clauses 1-4 open the captured
 * AlarmManager dumps and notification-shade view trees from the run and read what the device did.
 *
 * The load-bearing assertion is clause 2. A card billing on the 31st produced twelve alarms, and
 * FIVE of them are clamped — 2026-09-30, 2026-11-30, 2027-02-28, 2027-04-30, 2027-06-30. That set
 * cannot be produced by any schedule except Math.min(dayOfMonth, daysInMonth). A scheduler that
 * skipped short months would be missing them; one that rolled into the next month would show the
 * 1st. The gate asserts the clamped dates individually, so a run that quietly changed the rule
 * fails here rather than passing on a count.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE PRIVACY CLAUSE IS ASSERTED, NOT TRUSTED.
 *
 * C4 renders on a locked screen. Clause 4 does not check that the notification "looks safe"; it
 * takes the figures the cards were actually given — 20000, 500, 10000, 250 — and requires that
 * none of them appears in the captured notification text. If a future change puts an amount in
 * the body, the capture will contain it and this fails.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * ONE HOME FOR THE REMINDER PATH, AND ONLY THAT CLAIM.
 *
 * Clause 5 asserts that the schedule the REMINDERS use has a single implementation and that both
 * consumers import it. It does NOT assert that the whole app has one implementation, because it
 * does not: Home's upcoming-billing strip and the Calendar day sheet carry their own copies of
 * the clamp, both predating C4, both on P5-closed surfaces. That is recorded as PD-MDC-037 and
 * left unfixed. Asserting it here would block C4 on a defect C4's statement does not name, which
 * is a gate measuring the wrong thing.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * NO NEGATIVE CONTROL IS INVENTED.
 *
 * C4's row carries `negativeControl: null`. The no-billing-day card and the permission-denied
 * card are two arms of the observation, not controls in the machinery sense, and are not
 * presented as such.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fail, okOverPopulation } from '../lib/report.mjs';
import { stripCommentsAndStrings } from '../lib/source.mjs';

export const SENTINEL = 'NOTIFICATIONS OK';
export const FAILURE_SENTINEL = 'NOTIFICATIONS FAILED';
export const MEASURES = 'device';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const EVIDENCE_DIR = join(ROOT, '..', 'smartcard-data-pipeline', 'campaign-master', 'evidence', 'external', 'C4');
const CAPTURES = join(EVIDENCE_DIR, 'captures');
const EVIDENCE_FILE = join(EVIDENCE_DIR, 'EVIDENCE.txt');

const rel = (p) => relative(ROOT, p).split('\\').join('/');
const read = (p) => readFileSync(p, 'utf8');
const textOf = (xml) => (xml.match(/text="([^"]*)"/g) || []).join('\n')
  + '\n' + (xml.match(/content-desc="([^"]*)"/g) || []).join('\n');

/* The twelve dates a card billing on the 31st must produce from 2026-09-02, and which of them
   exist only because of the short-month clamp. */
const DAY31_SCHEDULE = [
  '2026-09-30', '2026-10-31', '2026-11-30', '2026-12-31',
  '2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30',
  '2027-05-31', '2027-06-30', '2027-07-31', '2027-08-31',
];
const CLAMPED = ['2026-09-30', '2026-11-30', '2027-02-28', '2027-04-30', '2027-06-30'];

/* Every figure the two cards were given. None may reach a lock screen. */
const FORBIDDEN_ON_LOCK_SCREEN = ['20,000', '20000', '10,000', '10000', '500', '250'];

const NOTIFICATION_TEXT = {
  'captures/07-notification-shade.xml': {
    lang: 'Hebrew',
    title: 'יום החיוב של הכרטיס הגיע',
    body: 'כרטיס 3131 — היום הוא יום החיוב',
  },
  'captures/15-notification-shade-english.xml': {
    lang: 'English',
    title: "The card's billing day is here",
    body: 'Card 4242 — Today is the billing day',
  },
};

/** Every .ts/.tsx under src, plus App.tsx. */
const sourceFiles = () => {
  const out = [join(ROOT, 'App.tsx')];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { if (e.name !== '__tests__') walk(p); }
      else if (/\.tsx?$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(p);
    }
  };
  walk(join(ROOT, 'src'));
  return out;
};

/**
 * The modules the RUNNING application can actually reach, by walking relative imports out from
 * App.tsx. A screen no navigator mounts, and nothing imports, is not part of the product however
 * complete its code is — which is the whole of OQ-MDC-019's finding.
 */
const reachableFromApp = () => {
  const seen = new Set();
  const resolveImport = (fromFile, spec) => {
    if (!spec.startsWith('.')) return null;
    const base = resolve(dirname(fromFile), spec);
    for (const c of [base + '.tsx', base + '.ts', join(base, 'index.tsx'), join(base, 'index.ts')]) {
      if (existsSync(c)) return c;
    }
    return null;
  };
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = read(file);
    const specs = [
      ...src.matchAll(/from\s+['"]([^'"]+)['"]/g),
      ...src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g),
    ].map((m) => m[1]);
    for (const s of specs) {
      const target = resolveImport(file, s);
      if (target !== null) visit(target);
    }
  };
  visit(join(ROOT, 'App.tsx'));
  return seen;
};

/** Files that WRITE a field into an object literal, read from stripped source so prose cannot lie. */
const writersOf = (field, files) => files.filter((f) => {
  if (f.includes(join('src', 'types'))) return false;
  return new RegExp('[,{]\\s*' + field + '\\s*:').test(stripCommentsAndStrings(read(f)));
});

export const run = async () => {
  const problems = [];
  const clauses = [];

  if (!existsSync(EVIDENCE_DIR) || !existsSync(EVIDENCE_FILE)) {
    return fail(`no C4 device evidence at ${rel(EVIDENCE_DIR)} — a DEVICE criterion is not satisfiable without a captured run`);
  }
  const evidence = read(EVIDENCE_FILE);
  const captureFiles = existsSync(CAPTURES) ? readdirSync(CAPTURES) : [];
  if (captureFiles.length === 0) return fail('capture directory is empty — a run that captured nothing is not evidence');

  const need = (p) => {
    const full = join(EVIDENCE_DIR, p);
    if (!existsSync(full)) { problems.push(`capture ${p} is missing`); return null; }
    return read(full);
  };

  /* 1. THE RUN IS BOUND TO A BUILD AND TO THE AUTHORISED DEVICE. */
  const pre = need('captures/00-PRECONDITION.txt');
  const shas = new Set([...evidence.matchAll(/\b([0-9a-f]{64})\b/g)].map((m) => m[1]));
  if (shas.size !== 1) {
    problems.push(`the evidence names ${shas.size} distinct APK hashes — a run must be bound to exactly one artifact`);
  }
  const apkSha = [...shas][0];
  if (pre !== null && apkSha !== undefined && !pre.includes(apkSha)) {
    problems.push('the precondition capture does not carry the same APK hash the evidence file names');
  }
  if (pre !== null && !/\/data\/app\/[^\s]*base\.apk/.test(pre)) {
    problems.push('the APK hash in the precondition capture was not taken from the device codePath');
  }
  if (!/android-36|:16\//.test(evidence)) {
    problems.push('the evidence does not name the stable android-36 image');
  }
  if (/android-37\.2-beta3/.test(evidence)) {
    problems.push('the evidence names the beta system image; behavioural evidence must come from the stable image');
  }
  clauses.push(`bound to APK ${(apkSha || '').slice(0, 12)} hashed on the device`);

  /* 2. THE SCHEDULE THE DEVICE PRODUCED IS THE ENGINE'S, PROVED BY ITS CLAMPED DATES. */
  const created = need('captures/02-alarms-after-create.txt');
  if (created !== null) {
    if (!/BILLING DAY 31/.test(created)) {
      problems.push('02: the capture does not record that the card was created with billing day 31');
    }
    for (const d of DAY31_SCHEDULE) {
      if (!created.includes(d)) {
        problems.push(`02: scheduled date ${d} absent — the device did not produce the engine's twelve-month schedule`);
      }
    }
    const clampedSeen = CLAMPED.filter((d) => created.includes(d));
    if (clampedSeen.length !== CLAMPED.length) {
      problems.push(`02: only ${clampedSeen.length} of ${CLAMPED.length} CLAMPED dates present — without them the run does not prove the short-month rule ran`);
    }
    if (created.includes('2027-09-30')) {
      problems.push('02: a thirteenth occurrence was scheduled — the bounded window is not being applied');
    }
    clauses.push(`12 alarms on the device, ${CLAMPED.length} of them clamped short-month dates`);
  }

  /* 3. THE ALARMS ARE CAUSED BY THE BILLING DAY, and the permission flow is honest both ways. */
  const control = need('captures/05-control-no-billing-day.txt');
  if (control !== null && !/ZERO alarms were added/.test(control)) {
    problems.push('05: the no-billing-day arm does not record that zero alarms were added');
  }
  const denied = need('captures/13-permission-denied-path.txt');
  if (denied !== null) {
    if (!/granted=false/.test(denied)) problems.push('13: the denied arm does not record granted=false from the device');
    if (!/NOT ONE BILLING ALARM WAS SCHEDULED/.test(denied)) problems.push('13: the denied arm does not record that nothing was scheduled');
    if (!/THE CARD SAVED/.test(denied)) problems.push('13: the denied arm does not record that the card still saved — a refusal to save is not the honest behaviour');
  }
  const granted = need('captures/14-permission-granted-path.txt');
  if (granted !== null) {
    if (!/granted=true/.test(granted)) problems.push('14: the granted arm does not record granted=true from the device');
    if (!/Settings/.test(granted)) problems.push('14: the granted arm does not record how the permission was granted');
    for (const d of ['2026-09-15', '2027-08-15']) {
      if (!granted.includes(d)) problems.push(`14: the granted arm does not show ${d} among the scheduled dates`);
    }
  }
  clauses.push('denied schedules nothing and still saves; granted schedules twelve');

  /* 4. A REMINDER FIRED, AND CARRIED NO FIGURE. */
  const firing = need('captures/08-FIRING.txt');
  if (firing !== null) {
    if (!/1 wakes 1 alarms/.test(firing)) {
      problems.push('08: the firing capture does not carry AlarmManager\'s own wakeup statistic');
    }
    if (!/cmd alarm set-time/.test(firing) || !/NOTHING IN THE APP WAS CHANGED/.test(firing)) {
      problems.push('08: the firing capture does not record how time was moved and what was not done to move it');
    }
  }
  let firingsProven = 0;
  for (const [path, want] of Object.entries(NOTIFICATION_TEXT)) {
    const xml = need(path);
    if (xml === null) continue;
    const text = textOf(xml);
    if (!text.includes(want.title)) { problems.push(`${path}: the ${want.lang} title did not render`); continue; }
    if (!text.includes(want.body)) { problems.push(`${path}: the ${want.lang} body did not render`); continue; }
    /* READ THE CAPTURE, NOT THIS FILE'S OWN CONSTANTS. An earlier draft of this clause tested
       `want.title + want.body` against the forbidden figures — that is a check comparing two
       literals in this source, which cannot fail however the app changes, and it is the same
       shape as the sentinel that matched its own failure text in the C11-era ladders. The
       notification's rendered neighbourhood in the shade is what gets scanned instead: the app
       name, the title, the body and the trailing labels around them. */
    const shadeTexts = (xml.match(/text="([^"]*)"/g) || []).map((t) => t.slice(6, -1));
    const at = shadeTexts.findIndex((t) => t === want.title);
    const shown = shadeTexts.slice(Math.max(0, at - 3), at + 4).join('\n');
    if (!shown.includes(want.body)) {
      problems.push(`${path}: the ${want.lang} body is not rendered beside its title — the capture is not one notification`);
    }
    for (const figure of FORBIDDEN_ON_LOCK_SCREEN) {
      if (shown.includes(figure)) {
        problems.push(`${path}: the ${want.lang} notification carries the figure ${figure} — nothing financial may reach a locked screen`);
      }
    }
    firingsProven += 1;
  }
  if (firingsProven === 0) problems.push('no notification firing was proved from a captured view tree');
  clauses.push(`${firingsProven} firing(s) read from the shade, no financial figure in either`);

  /* 5. ONE HOME FOR THE REMINDER SCHEDULE — see the header for what this deliberately does NOT claim. */
  const files = sourceFiles();
  const engine = join(ROOT, 'src', 'engines', 'billingSchedule.ts');
  if (!existsSync(engine)) problems.push('src/engines/billingSchedule.ts is absent — the schedule has no engine home');
  else if (!/Math\.min\(dayOfMonth, daysInMonth\)/.test(read(engine))) {
    problems.push('the engine no longer clamps a billing day to the length of a short month');
  }
  const scheduler = join(ROOT, 'src', 'services', 'notificationScheduler.ts');
  const schedulerSrc = existsSync(scheduler) ? read(scheduler) : '';
  const consumers = [
    [scheduler, 'the notification scheduler'],
    [join(ROOT, 'src', 'surfaces', 'surfaceEngines.ts'), 'the Plan surfaces'],
  ];
  for (const [file, label] of consumers) {
    if (!existsSync(file) || !/engines\/billingSchedule/.test(read(file))) {
      problems.push(`${label} does not import the schedule from the engine`);
    }
  }
  if (/Math\.min\s*\(/.test(stripCommentsAndStrings(schedulerSrc))) {
    problems.push('the notification scheduler computes a clamp of its own — the rule must have one home');
  }
  const screensWithEngine = files
    .filter((f) => f.includes(join('src', 'screens')) && /engines\/billingSchedule/.test(read(f)));
  if (screensWithEngine.length > 0) {
    problems.push(`screens importing the schedule engine: ${screensWithEngine.map(rel).join(', ')} — scheduling is not the UI's job`);
  }
  const body = (schedulerSrc.match(/export async function scheduleBillingReminders[\s\S]*?\n}/) || [''])[0];
  if (!/^[\s\S]{0,200}await hasPermission\(\)/.test(body)) {
    problems.push('scheduleBillingReminders does not check hasPermission() before anything else');
  }
  if (!/profileCardBillingNotificationIds/.test(schedulerSrc)) {
    problems.push('the billing reminder ids do not use a storage key of their own');
  }
  if (!/BILLING_REMINDER_WINDOW_MONTHS/.test(read(join(ROOT, 'src', 'config', 'financial.ts')))) {
    problems.push('the reminder window is not a named constant in config');
  }
  clauses.push('one clamp for the reminder path, imported by both consumers; permission checked first');

  /* 6. THE FEE-WAIVER HALF. THE CLAUSE THAT IS CURRENTLY RED, AND THE POSITIVE CONTROL THAT
        PROVES THIS READER CAN SAY YES RATHER THAN ONLY NO. */
  const reachable = reachableFromApp();
  const controlWriters = writersOf('billingDayOfMonth', files).filter((f) => reachable.has(f));
  if (controlWriters.length === 0) {
    problems.push('reader control failed: billingDayOfMonth has no reachable writer, which is known to be false — the reachability walk is broken and its verdict on cardFee cannot be trusted');
  } else {
    clauses.push(`reachability control: billingDayOfMonth written by ${controlWriters.map(rel).join(', ')}, reachable from App.tsx`);
  }
  for (const field of ['cardFee', 'cardIssuanceDate']) {
    const writers = writersOf(field, files);
    const live = writers.filter((f) => reachable.has(f));
    if (live.length === 0) {
      problems.push(
        `FEE-WAIVER HALF NOT BUILT: ${field} is written only by ${writers.map(rel).join(', ') || 'nothing'}, `
        + 'which the mounted application cannot reach. C4 requires billing AND fee-waiver reminders; '
        + 'the fee-waiver inputs have no live surface. This is the open Owner boundary OQ-MDC-019 and '
        + 'is not a defect a worker may resolve by inventing product scope.',
      );
    }
  }

  if (problems.length > 0) return fail(problems.join('; '), { population: captureFiles.length });
  return okOverPopulation({
    population: captureFiles.length,
    unit: 'captured artifact(s) from the C4 device runs',
    detail: clauses.join(' · '),
  });
};
