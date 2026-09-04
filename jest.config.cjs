/**
 * JEST — TWO PROJECTS, and the second one is criterion E2.
 *
 * WHAT WAS HERE BEFORE, and why it could not stay:
 *
 *     testEnvironment: 'node'
 *     testMatch: ['**\/__tests__\/**\/*.test.ts']
 *
 * `node` cannot host a React renderer, and `*.test.ts` cannot match a `.tsx` file. Between them
 * those two lines made it IMPOSSIBLE for any screen to render in any test — not unlikely, not
 * untested: impossible. 410 tests passed against that config and not one of them mounted a
 * component. E2 exists because "the tests are green" was a true statement about a suite that could
 * not have caught a broken screen.
 *
 * WHY TWO PROJECTS RATHER THAN ONE REWRITTEN CONFIG. The 410 existing tests are pure TypeScript
 * over engines, utils, policy and state; they run under ts-jest in a node environment and they
 * pass. Converting them to the Expo/babel pipeline to gain rendering would have risked 410 green
 * tests to add the first one, and any that then broke would have been indistinguishable from a
 * real regression. So the existing suite keeps its exact configuration, and rendering gets its own
 * project beside it.
 *
 * THE NAMING IS DELIBERATE. Render tests are `*.render.test.tsx`, so the two projects can never
 * claim the same file — a test picked up by both would run in two environments and be reported
 * twice, and a test picked up by neither would be silently absent, which is the shape of defect
 * this campaign keeps finding.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A THIRD PROJECT, ADDED 2026-08-28 — P5's group-A properties, and why they are not in `render`
 *
 * The five cross-surface agreement properties are **deliberately red** until the surfaces they
 * compare exist. `campaign-p5/P5_EXECUTION_PLAN.md` §1.1: *"PHASE-1 delivers A1 through A5 as
 * failing properties with nothing to satisfy them yet… a property that has never been red is a
 * property nobody has watched."*
 *
 * They are `*.render.test.tsx`, so `render` would claim them, so `npx jest` would fail — and
 * `npx jest` is the **suite step of both `tools/p4/all.mjs` and `tools/p5/all.mjs`**. P4's ladder
 * would then be red at a P5 sha, and criterion B12's designed reading of that is *"P5 broke it"*.
 * That reading would be false, and a check that is expected to fail is a check nobody reads.
 *
 * So they get their own project and run through their own gates, on every ladder. Nothing leaves
 * the measurement. `tools/p5/lib/agreementProject.mjs` asserts, per gate, that a property file is
 * claimed by `agreement` and NOT by `render` — because the paragraph above is exactly the risk of
 * a file claimed by both or by neither, and it should be checked rather than promised.
 * See `campaign-p5/DEVIATIONS.md` D-010 / PD-P5-010.
 */
/* The agreement project lives in its own file so nothing jest does not recognise is exported from
   here — an unknown key makes jest print a Validation Warning on EVERY run in the repository, and a
   warning everyone learns to scroll past is how a real one goes unread. */
const {
  AGREEMENT_PROPERTY_PATTERN,
  EXPO_TRANSFORM_IGNORE,
} = require('./tools/p5/agreement.jest.cjs');

module.exports = {
  /**
   * WORKERS ARE CAPPED — PD-MDC-068.
   *
   * jest defaults to (logical CPUs − 1) workers: 31 on the campaign's machine, each a full jest-expo
   * render environment. Under the emulator and the rest of a working desktop that starved the render
   * suites — properties "did not pass" for no reason in the code (PD-MDC-060's intermittent flake),
   * and on 2026-09-04 the host killed the standing regression outright for lack of memory. Eight
   * workers keep every ladder inside a few gigabytes; the suites are the same suites, only fewer at
   * once, and a worker that grows past the idle limit is recycled rather than kept.
   */
  maxWorkers: 8,
  workerIdleMemoryLimit: '1GB',
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testMatch: ['**/__tests__/**/*.test.ts'],
      modulePathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.expo/'],
    },
    {
      displayName: 'render',
      preset: 'jest-expo',
      roots: ['<rootDir>/src'],
      testMatch: ['**/__tests__/**/*.render.test.tsx'],
      /* The group-A properties are `*.agreement.render.test.tsx` and belong to the third project.
         Without this they would be claimed by both, run twice, and fail the blanket suite. */
      testPathIgnorePatterns: [AGREEMENT_PROPERTY_PATTERN],
      modulePathIgnorePatterns: ['<rootDir>/.expo/'],
      /**
       * A FALLBACK RESOLUTION ROOT, AND WHY IT IS NOT A WIDENING.
       *
       * `@smartcard/data-authority-adapter` is file-linked: `node_modules/@smartcard/...` is a
       * SYMLINK to `../smartcard-data-pipeline/dist/adapter-package`. Jest resolves from a file's
       * REAL path, so babel-injected `@babel/runtime` helpers are looked for beside the pipeline's
       * dist directory, which has no `node_modules`, and the mount dies with
       * "Cannot find module @babel/runtime/helpers/interopRequireDefault".
       *
       * `modulePaths` entries are APPENDED LAST — `jest-resolve/build/nodeModulesPaths.js` line 115
       * is `dirs.push(...options.paths)` — so this can only rescue a resolution that already FAILED.
       * It cannot move one that already succeeded, which is why it was decidable by measurement:
       * PD-MDC-014 ran the closed P2 and P5 ladders with this line alone and both were unmoved
       * (suite 1235 of 1235, render-harness 41 of 41, 5 of 5 agreement gates green).
       *
       * IT IS LOAD-BEARING FOR E2, NOT ONLY FOR THE GATE THAT FOUND IT. `screens.render.test.tsx`
       * derives its population from `src/screens/**` and mounts every file it finds, so the first
       * screen to import the adapter needs this whether or not it brings its own test.
       *
       * DELIBERATELY NOT MIRRORED INTO THE `agreement` PROJECT, which `tools/p5/agreement.jest.cjs`
       * calls an identical environment. That file belongs to a closed campaign, and the asymmetry
       * cannot bite: the group-A properties import a NAMED set of components and derive their
       * population from `BOTTOM_NAVIGATION` and the shipped catalog, never from `src/screens/**`,
       * so no adapter-importing screen can enter their graph — and if one ever did, a missing
       * resolution root is a hard resolver error, which is a red rather than a silence.
       */
      modulePaths: ['<rootDir>/node_modules'],
      setupFilesAfterEnv: ['<rootDir>/tools/p2/jest/render-setup.ts'],
      /**
       * WHICH node_modules PACKAGES GO THROUGH BABEL — and this list is DERIVED, not guessed.
       *
       * jest-expo's preset already names the React Native and Expo families. It does not name the
       * packages THIS app adds on top, and the first run showed exactly what that costs: nineteen
       * of twenty-one screens died with "Cannot use import statement outside a module", every one
       * of them from a transitive import of a package shipping untranspiled ESM.
       *
       * So the extra names below are taken from this app's own dependency list — the ones that
       * ship ESM and are reachable from a screen — rather than added one at a time as each new
       * error appears. `p2:gate -- render-harness` re-derives the population from disk on every
       * run, so a package added later that breaks a screen shows up as a screen that stopped
       * rendering, which is a failure rather than a silence.
       */
      transformIgnorePatterns: EXPO_TRANSFORM_IGNORE,
    },
  ],
  collectCoverageFrom: [
    'src/engines/purchaseGate.ts',
    'src/engines/cardRoleEngine.ts',
  ],
  coverageThreshold: {
    global: { branches: 90, functions: 90, lines: 90, statements: 90 },
  },
};
