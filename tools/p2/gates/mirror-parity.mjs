/**
 * GATE: mirror-parity — the mirrored campaign facts are CURRENT.  →  `MIRROR-PARITY OK`
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A PARITY CHECK BELONGS WHERE THE MIRROR IS READ, NOT ONLY WHERE IT IS WRITTEN
 *
 * Several files under `tools/p2/` are mirrors: the pipeline repository owns the fact, a script
 * there parses the authority and writes the copy here, and that script's `--check` compares the
 * two. The rule this campaign works to is *"one canonical home per fact; a mirror requires a parity
 * check in the same commit"* — and the checks exist.
 *
 * **They were wired into the PIPELINE's preflight, and the gates that read the mirrors live HERE.**
 * So this ladder could be entirely green while reading a stale copy, and it was:
 *
 *   · `PD-009` was appended to the pipeline's decision log during the device lane.
 *   · `tools/p2/campaign-records.json` still held eight decisions.
 *   · `gate:decision-log` — which decides criterion F11 — read that mirror and printed
 *     `DECISION-LOG OK — 8 decisions, all fields present`, and `8 provisional · 1 flagged for
 *     Owner review`. There were nine, and two were flagged.
 *   · The ladder was green throughout. The pipeline's own `--check` found the drift immediately,
 *     the first time anybody ran it by hand.
 *
 * A gate that reports a COUNT from a file nothing checks for freshness is reporting yesterday's
 * number with today's confidence. That is not one wrong count in one gate; it is every mirrored
 * fact in this ladder resting on a check that runs somewhere else.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE POPULATION IS DERIVED, NEVER HAND-LISTED
 *
 * A hand-maintained list of mirrors is the same defect one layer up: a tenth mirror gets added,
 * nobody adds it here, and this gate keeps printing OK about nine. So the generators are
 * discovered on disk, and classified by what their `--check` PRINTS.
 *
 * "Accepts `--check`" alone is too wide — `p2-state.mjs` takes one and mirrors nothing. A parity
 * check reports on two copies, so its output either names drift or calls the two identical.
 * Anything else is **listed as ignored rather than dropped**, so a mirror whose check phrases
 * itself differently shows up as unrecognised instead of silently uncounted.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHEN THE PIPELINE IS NOT REACHABLE
 *
 * It says so and fails, rather than passing. This gate's whole subject is whether a copy matches
 * its source; with no source in reach there is nothing to compare, and reporting OK would be the
 * vacuous pass the campaign's evidence rules forbid.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = [];
export const SENTINEL = 'MIRROR-PARITY OK';

const NL = String.fromCharCode(10);
const PIPELINE = join('..', 'smartcard-data-pipeline');
const BIN = join(PIPELINE, 'campaign-p2', 'bin');

/** What a parity verdict sounds like. See the header for why this, and not the filename. */
const PARITY = /identical|no drift|DRIFT/i;

export const run = async ({ root }) => {
  const binDir = join(root, BIN);
  if (!existsSync(binDir)) {
    return fail('the pipeline repository is not reachable at ' + PIPELINE.split('\\').join('/')
      + ', so no mirror can be compared with its source. This gate refuses rather than passing: '
      + 'its entire subject is whether a copy matches an original, and with no original in reach '
      + 'there is nothing to check');
  }

  /**
   * ONE NAMED EXCLUSION, AND IT IS NOT BECAUSE IT WENT RED.
   *
   * `p2-pack-shas` mirrors BYTES, and its source is `dist/packs` -- a BUILD OUTPUT whose signed
   * manifests need the Owner-controlled signing key. OB-8: that key exists on no machine this
   * campaign runs on. So in a fresh clone the check reports the app has `.sig.json` files "the
   * pipeline does not build", and manifests differing by four bytes, which its own message
   * diagnoses as a line-ending translation on checkout.
   *
   * Neither is drift. Both say the same thing: **a fresh clone cannot regenerate signed packs**,
   * and a gate that can only pass where the private key lives is not a gate.
   *
   * Those bytes are not unchecked. `gate:real-artifacts` -- criterion E6 -- verifies the app's
   * packs against the five shas the contract names, and it passes in the fresh clone. That is the
   * check the contract wrote for pack bytes; this gate is for facts mirrored out of the committed
   * authority into `tools/p2/`, which can be compared anywhere both repositories are checked out.
   *
   * Excluded by NAME, so the exclusion is one line a reader can disagree with, and printed in this
   * gate's own output rather than buried here.
   */
  const BUILD_OUTPUT_MIRROR = 'p2-pack-shas';

  const generators = readdirSync(binDir)
    .filter((f) => /^p2-.*\.mjs$/.test(f))
    .filter((f) => readFileSync(join(binDir, f), 'utf8').includes('--check'))
    .filter((f) => f.replace(/\.mjs$/, '') !== BUILD_OUTPUT_MIRROR)
    .sort();

  if (generators.length === 0) {
    return fail('no script in ' + BIN.split('\\').join('/') + ' accepts --check. Either the mirrors '
      + 'stopped having parity checks or this gate stopped being able to find them, and both are '
      + 'the same failure from here');
  }

  const problems = [];
  const lines = [];
  const ignored = [];
  let mirrors = 0;

  for (const g of generators) {
    const name = g.replace(/\.mjs$/, '');
    const r = spawnSync(process.execPath, [join(binDir, g), '--check'], {
      cwd: join(root, PIPELINE), encoding: 'utf8',
    });
    const out = String(r.stdout ?? '') + String(r.stderr ?? '');

    /**
     * A RED CHECK IS A RED CHECK. IT IS NEVER RECLASSIFIED INTO "NOT A MIRROR".
     *
     * The first version classified purely on whether the output matched PARITY, and a check that
     * FAILS prints no parity verdict -- so in the closure fresh clone, where dist/packs had not
     * been built, `p2-org-kinds` and `p2-pack-shas` both printed "FAILED - no packs at ..." , fell
     * outside the pattern, were filed as "not parity checks", and the gate printed
     * `MIRROR-PARITY OK - 6 mirrors current` instead of failing.
     *
     * That is precisely the defect this gate exists to prevent, committed by this gate: a smaller
     * population, silently, with a green sentinel over it. Classification must not depend on the
     * result being good. A check that RAN AND WENT RED is a mirror failing; only a check that
     * SUCCEEDED and said nothing about parity is not a mirror.
     */
    const red = /FAILED|DRIFT/.test(out);
    if (!red && !PARITY.test(out)) { ignored.push(name); continue; }
    mirrors += 1;

    // Decided on printed output. The process status is recorded for the log, never the decision.
    const drifted = red;
    const verdict = out.split(NL).map((l) => l.trim()).filter(Boolean)
      .filter((l) => PARITY.test(l) || /FAILED/.test(l) || / OK/.test(l))
      .slice(-1)[0] ?? '(no verdict line)';

    lines.push('  ' + (drifted ? 'FAIL' : 'ok  ') + ' ' + name.padEnd(24) + verdict.slice(0, 84));
    if (drifted) problems.push(name + ' could not confirm its mirror: ' + verdict.slice(0, 160));
  }

  if (mirrors === 0) {
    return fail('none of the ' + generators.length + ' script(s) with a --check printed a parity '
      + 'verdict. Either the mirrors stopped comparing themselves with their source, or this gate '
      + 'stopped being able to recognise when they do, and both are the same failure from here');
  }

  lines.unshift('mirrors         ' + mirrors + ' parity check(s), discovered on disk and classified '
    + 'by what they print');
  if (ignored.length) {
    lines.push('');
    lines.push('  take --check but print no parity verdict, so not mirrors: ' + ignored.join(', '));
  }
  lines.push('');
  lines.push('  not checked here: ' + BUILD_OUTPUT_MIRROR + ' mirrors BUILD OUTPUT, and its signed');
  lines.push('  manifests need the Owner signing key OB-8 says exists nowhere this runs. Those bytes');
  lines.push('  are gate:real-artifacts / criterion E6, which checks them against the contract shas.');
  lines.push('');
  lines.push('  Each compares a fact in the pipeline against its copy in this repository. Those');
  lines.push('  copies are what this ladder reads, which is why the comparison runs HERE and not');
  lines.push('  only in the pipeline preflight, where it could not protect these gates.');

  if (problems.length) {
    return fail(problems.length + ' mirror(s) stale: ' + problems.slice(0, 2).join(' · '), lines.join(NL));
  }
  return ok(SENTINEL + ' — ' + mirrors + ' mirrors current', lines.join(NL));
};
