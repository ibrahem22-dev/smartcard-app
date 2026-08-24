/**
 * NEGATIVE CONTROLS FOR THE CI WORKFLOW'S OWN VERDICT LOGIC.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 *
 * `.github/workflows/ci.yml` decides three contract criteria — **F4**, **E7** and **E6** — by
 * grepping the ladder's printed output for contracted sentinels. Until the Owner installs the
 * credential OQ-003 asks for, that workflow **cannot run at all**, and the campaign's first rule
 * about checks applies to it with full force:
 *
 *     A check that has never been watched to fail is not a check.
 *
 * The previous version of that workflow is the proof. It was 5,946 bytes of careful reasoning about
 * which gates it would tolerate going red, and it had never reached a gate in its life: every run
 * since it was created died at `npm ci`, one line in, because the app's data dependency is a
 * relative path into a private second repository CI never checked out. The comments described a
 * ladder that did not execute. Nobody noticed for a whole campaign.
 *
 * So before anyone trusts the new one, its assertions are exercised HERE, on this machine, against
 * inputs chosen to make them fail.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE SCRIPTS ARE READ OUT OF THE YAML, NEVER RETYPED
 *
 * This file extracts the `run:` block of the named step from `ci.yml` and executes THAT. A control
 * that retyped the assertions would be testing this file's copy of them, and would keep passing
 * after somebody edited the workflow — which is the same defect as a hand-maintained population
 * list, one layer down. If the step is renamed or its script changes shape, extraction fails loudly
 * rather than silently controlling nothing.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IS AND IS NOT PROVEN HERE
 *
 * Proven: the guard refuses a missing credential; the ladder verdict refuses an absent sentinel, a
 * red ladder, and a ladder that printed F4's sentinel but not E6's; and it accepts a genuine green
 * log. These are the decisions the workflow makes.
 *
 * NOT proven: that the checkout, the two-repository install order, or the runner itself work. Only
 * a real CI run proves those, and that run is what F4/E7/E6 are waiting for. This control makes the
 * verdict trustworthy when it finally speaks; it does not speak for it.
 *
 *     node tools/p2/ci-workflow-controls.mjs        →  CI-WORKFLOW-CONTROLS OK — N of N fired
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const NL = String.fromCharCode(10);
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const WORKFLOW = join(ROOT, '.github', 'workflows', 'ci.yml');

/**
 * Pull one step's `run:` script out of the workflow, by the step's name.
 *
 * Deliberately a small text scan rather than a YAML parse: neither `js-yaml` nor `yaml` is a direct
 * dependency of this app, and a control that depends on a transitive package is one `npm ci` away
 * from disappearing. If the shape it expects is gone, it throws — never returns empty.
 */
const stepScript = (name) => {
  const src = readFileSync(WORKFLOW, 'utf8').split(String.fromCharCode(13) + NL).join(NL);
  const lines = src.split(NL);
  const at = lines.findIndex((l) => l.trim() === '- name: ' + name);
  if (at < 0) throw new Error('no step named ' + JSON.stringify(name) + ' in ci.yml — it was '
    + 'renamed or removed, and this control has been asserting nothing since');

  const runAt = lines.findIndex((l, i) => i > at && /^\s*run: \|\s*$/.test(l));
  const nextStep = lines.findIndex((l, i) => i > at && /^\s*- (name|uses):/.test(l));
  if (runAt < 0 || (nextStep >= 0 && runAt > nextStep)) {
    throw new Error('step ' + JSON.stringify(name) + ' has no `run: |` block');
  }

  const body = [];
  const indent = lines[runAt].indexOf('run:');
  for (let i = runAt + 1; i < lines.length; i += 1) {
    const l = lines[i];
    if (l.trim() === '') { body.push(''); continue; }
    const lead = l.length - l.trimStart().length;
    if (lead <= indent) break;
    body.push(l.slice(indent + 2));
  }
  const script = body.join(NL).trim();
  if (script === '') throw new Error('extracted an empty script for ' + JSON.stringify(name));
  return script;
};

const sh = (script, { cwd, env = {} }) => {
  const r = spawnSync('bash', ['-c', script], {
    cwd, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 16 * 1024 * 1024,
  });
  return { status: r.status, out: String(r.stdout ?? '') + String(r.stderr ?? '') };
};

/**
 * The workflow's steps are `bash` scripts, so controlling them needs a real bash. It is present on
 * the Linux runner by definition and on the Windows working machine through Git Bash.
 *
 * If it is missing this file says SO, by name, instead of reporting ten failed controls and sending
 * the reader to look for ten bugs that are not there. `spawnSync` on a missing binary returns
 * status null with an ENOENT error and no output — which every case would read as "did not behave
 * as the workflow claims".
 */
const bashProbe = spawnSync('bash', ['-c', 'echo ok'], { encoding: 'utf8' });
if (bashProbe.error || String(bashProbe.stdout ?? '').trim() !== 'ok') {
  console.log('');
  console.log('CI-WORKFLOW-CONTROLS FAILED — no usable `bash` on PATH.');
  console.log('  The CI workflow\'s steps ARE bash scripts; this file executes them verbatim to');
  console.log('  prove they can fail. Without a shell it cannot execute anything, and reporting');
  console.log('  OK here would be the vacuous pass the campaign forbids.');
  console.log('  ' + (bashProbe.error ? String(bashProbe.error.message) : 'bash ran but printed nothing'));
  process.exit(1);
}

const GREEN_LADDER = [
  '  ok    gate:real-artifacts    REAL-ARTIFACTS OK — 5 of 5 shas matched',
  '  ok    gate:mirror-parity     MIRROR-PARITY OK — 7 mirrors current',
  '  steps 50 · gates 46 of 44 required · failed 0 · missing 0 · skipped 0',
  'P2-ALL OK — every step green',
].join(NL) + NL;

/**
 * Each case names what it is REFUSING. A control that only ever feeds good input proves the check
 * can say yes, which was never in doubt.
 */
const CASES = [
  {
    step: 'the credential OQ-003 requires is present',
    label: 'no credential at all is refused',
    env: { HAVE_KEY: 'false', HAVE_PAT: 'false', PIPELINE_REPO: 'ibrahem22-dev/smartcard-data-pipeline' },
    expect: 'fail',
    mustSay: 'No credential for the private pipeline repository',
  },
  {
    step: 'the credential OQ-003 requires is present',
    label: 'a fork PR (secrets withheld) is refused, and told why',
    env: { HAVE_KEY: 'false', HAVE_PAT: 'false', PIPELINE_REPO: 'x/y' },
    expect: 'fail',
    mustSay: 'secrets are withheld by design',
  },
  {
    step: 'the credential OQ-003 requires is present',
    label: 'a deploy key is accepted',
    env: { HAVE_KEY: 'true', HAVE_PAT: 'false', PIPELINE_REPO: 'x/y' },
    expect: 'pass',
    mustSay: 'A credential is available',
  },
  {
    step: 'the credential OQ-003 requires is present',
    label: 'a PAT alone is accepted',
    env: { HAVE_KEY: 'false', HAVE_PAT: 'true', PIPELINE_REPO: 'x/y' },
    expect: 'pass',
    mustSay: 'A credential is available',
  },

  // ── the ladder verdict ────────────────────────────────────────────────────────────────────
  // The step's first line runs the real ladder. Here it is replaced by a stub that emits a
  // FIXTURE, so the assertions below it are the thing under test. Everything after that line is
  // executed exactly as the file has it.
  {
    step: 'the whole ladder (F4, E7) and the shipped artifacts (E6)',
    label: 'a ladder that printed nothing is refused (the old workflow’s actual failure)',
    ladder: '',
    expect: 'fail',
    mustSay: 'F4/E7 NOT SATISFIED',
  },
  {
    step: 'the whole ladder (F4, E7) and the shipped artifacts (E6)',
    label: 'a RED ladder is refused',
    ladder: 'P2-ALL FAILED — 2 step(s) red' + NL,
    expect: 'fail',
    mustSay: 'F4/E7 NOT SATISFIED',
  },
  {
    step: 'the whole ladder (F4, E7) and the shipped artifacts (E6)',
    label: 'a DEVICE-BLOCKED ladder is refused (the old workflow excused this one)',
    ladder: 'P2-ALL DEVICE-BLOCKED — every gate that can run here is green' + NL,
    expect: 'fail',
    mustSay: 'F4/E7 NOT SATISFIED',
  },
  {
    step: 'the whole ladder (F4, E7) and the shipped artifacts (E6)',
    label: 'F4 green but E6 silent is refused — the sentinels are asserted separately',
    ladder: 'P2-ALL OK — every step green' + NL,
    expect: 'fail',
    mustSay: 'E6 NOT SATISFIED',
  },
  {
    step: 'the whole ladder (F4, E7) and the shipped artifacts (E6)',
    label: 'E6 with the wrong count is refused (4 of 5 is not 5 of 5)',
    ladder: GREEN_LADDER.split('5 of 5').join('4 of 5'),
    expect: 'fail',
    mustSay: 'E6 NOT SATISFIED',
  },
  {
    step: 'the whole ladder (F4, E7) and the shipped artifacts (E6)',
    label: 'a genuinely green ladder is accepted',
    ladder: GREEN_LADDER,
    expect: 'pass',
    mustSay: 'P2-ALL OK — every step green',
  },
];

const dir = mkdtempSync(join(tmpdir(), 'p2-ci-controls-'));
const results = [];

try {
  for (const c of CASES) {
    let script = stepScript(c.step);

    if (c.ladder !== undefined) {
      // Replace ONLY the line that invokes the real ladder. If that line is not found, the step no
      // longer works the way this control assumes and we stop rather than test a fiction.
      const marker = 'npm run p2:all 2>&1 | tee ladder.log || true';
      if (!script.includes(marker)) {
        throw new Error('the ladder step no longer contains ' + JSON.stringify(marker)
          + ' — this control cannot substitute a fixture and would be asserting nothing');
      }
      writeFileSync(join(dir, 'fixture.log'), c.ladder);
      script = script.split(marker).join('cat fixture.log | tee ladder.log');
    }

    const r = sh(script, {
      cwd: dir,
      env: { ...c.env, GITHUB_STEP_SUMMARY: join(dir, 'summary.md') },
    });
    const failed = r.status !== 0;
    const wanted = c.expect === 'fail';
    const said = r.out.includes(c.mustSay);
    const fired = failed === wanted && said;

    results.push({ ...c, fired, status: r.status, said,
      why: fired ? null
        : failed !== wanted ? ('expected to ' + c.expect + ', exited ' + r.status)
          : ('exit was right but it never said ' + JSON.stringify(c.mustSay)) });
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const fired = results.filter((r) => r.fired).length;

console.log('');
console.log('CI WORKFLOW — negative controls on the verdict logic');
console.log('  read from  .github/workflows/ci.yml (extracted, never retyped)');
console.log('');
for (const r of results) {
  console.log('  ' + (r.fired ? 'ok  ' : 'FAIL') + ' [' + r.expect.padEnd(4) + '] ' + r.label
    + (r.fired ? '' : NL + '         ' + r.why));
}
console.log('');

if (fired !== results.length) {
  console.log('CI-WORKFLOW-CONTROLS FAILED — ' + (results.length - fired) + ' of ' + results.length
    + ' did not behave as the workflow claims');
  process.exit(1);
}
console.log('CI-WORKFLOW-CONTROLS OK — ' + fired + ' of ' + results.length + ' fired');
