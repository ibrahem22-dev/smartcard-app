/**
 * THE ONE RESOLVER THE FIVE AGREEMENT GATES SHARE.
 *
 * Group A's properties are `*.agreement.render.test.tsx` and live in their own jest project, so
 * that a **deliberately red** harness cannot make an unrelated ladder red — `npx jest` is the suite
 * step of both `tools/p4/all.mjs` and `tools/p5/all.mjs`, and P4's ladder going red at a P5 sha
 * reads, by criterion B12's design, as *"P5 broke it"*. See `campaign-p5/DEVIATIONS.md` D-010.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE RISK THAT SPLIT CREATES, AND WHY THIS FILE ASSERTS RATHER THAN PROMISES
 *
 * `jest.config.cjs`'s own docblock states the rule: *"a test picked up by both would run in two
 * environments and be reported twice, and a test picked up by neither would be silently absent,
 * which is the shape of defect this campaign keeps finding."* Adding a third project makes both
 * halves of that possible for the first time.
 *
 * So this does not trust the configuration. For every gate, it checks that the property file is
 * claimed by `agreement` and **not** by `render` — and refuses if either is wrong. A property that
 * quietly stopped running is the one failure that would make all five gates green for nothing.
 *
 * ONE RESOLVER, NOT FIVE COPIES. Each gate having its own would be five things to keep in step, and
 * the first one that drifted would drift silently.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const JEST_CONFIG = 'jest.config.cjs';
const AGREEMENT_PROJECT = 'agreement';
const RENDER_PROJECT = 'render';
const SIDECAR = 'tools/p5/agreement.jest.cjs';

/**
 * @returns {{ config?: object, error?: string }} a jest config scoped to this one property file,
 * or the reason it cannot be run.
 */
export const agreementConfigFor = (root, propertyPath) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) {
    return { error: JEST_CONFIG + ' does not exist — there is no rendering harness, and an agreement property that cannot render can only compare inputs' };
  }
  if (!existsSync(join(root, propertyPath))) {
    return { error: propertyPath + ' does not exist — this gate names a property that is not there' };
  }

  const require_ = createRequire(import.meta.url);
  const config = require_(configPath);
  const projects = Array.isArray(config.projects) ? config.projects : [];
  /**
   * NOT from `projects`, and not from `jest.config.cjs` at all.
   *
   * The agreement project is deliberately outside the default set, because `npx jest` runs every
   * project it is given and these five are deliberately red. It lives in its own file because an
   * unrecognised key on the exported config makes jest print a Validation Warning on every run in
   * the repository, and a warning everyone scrolls past is how a real one goes unread.
   */
  const sidecarPath = join(root, SIDECAR);
  if (!existsSync(sidecarPath)) {
    return { error: SIDECAR + ' does not exist — the group-A properties would then be claimed by nothing and silently absent, which is worse than any of them being red' };
  }
  const sidecar = require_(sidecarPath);
  const agreement = sidecar.agreementProject ?? null;
  const render = projects.find((p) => p && p.displayName === RENDER_PROJECT);

  if (!agreement || agreement.displayName !== AGREEMENT_PROJECT) {
    return { error: SIDECAR + ' exports no "' + AGREEMENT_PROJECT + '" project — the group-A properties would then be claimed by nothing and silently absent, which is worse than any of them being red' };
  }
  if (projects.some((p) => p && p.displayName === AGREEMENT_PROJECT)) {
    return { error: JEST_CONFIG + ' lists "' + AGREEMENT_PROJECT + '" in projects — `npx jest` would then run the deliberately-red properties as part of the blanket suite, and P4\'s ladder would go red at a P5 sha for a reason that is not a regression' };
  }
  if (!render) {
    return { error: JEST_CONFIG + ' has no "' + RENDER_PROJECT + '" project' };
  }

  /* CLAIMED BY EXACTLY ONE PROJECT. Asserted from the config's own patterns, against this file's
     own path, rather than from the fact that somebody wrote the projects correctly once. */
  const rel = String(propertyPath).replace(/\\/g, '/');
  const claimedByAgreement = (agreement.testMatch ?? []).some((glob) => globClaims(glob, rel));
  const ignoredByRender = (render.testPathIgnorePatterns ?? []).some((p) => new RegExp(p).test(rel));
  const matchedByRender = (render.testMatch ?? []).some((glob) => globClaims(glob, rel));

  if (!claimedByAgreement) {
    return { error: rel + ' is not matched by the "' + AGREEMENT_PROJECT + '" project\'s testMatch — it would run in no project at all, and five green gates over a property nobody ran is the worst outcome available here' };
  }
  if (matchedByRender && !ignoredByRender) {
    return { error: rel + ' is claimed by BOTH "' + RENDER_PROJECT + '" and "' + AGREEMENT_PROJECT + '" — it would run twice, in two environments, and fail the blanket suite that P4\'s ladder depends on' };
  }

  return {
    config: { ...agreement, rootDir: root, testMatch: ['**/' + rel] },
    claim: 'claimed by "' + AGREEMENT_PROJECT + '" and excluded from "' + RENDER_PROJECT + '"',
  };
};

/** The narrow glob dialect jest's testMatch uses here: `**` and `*` only. */
function globClaims(glob, rel) {
  const rx = String(glob)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '(?:.*/)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*');
  return new RegExp('^' + rx + '$').test(rel) || new RegExp(rx + '$').test(rel);
}
