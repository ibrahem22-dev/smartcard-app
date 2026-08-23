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
 */
module.exports = {
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
      modulePathIgnorePatterns: ['<rootDir>/.expo/'],
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
      transformIgnorePatterns: [
        'node_modules/(?!(.pnpm|(jest-)?react-native|@react-native|@react-native-community'
          + '|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation'
          + '|@sentry/react-native|native-base|standard-navigation'
          // added for this app, from its own dependencies:
          + '|react-native-safe-area-context|react-native-screens|react-native-svg'
          + '|react-native-qrcode-svg|react-native-purchases|react-native-css-interop'
          + '|nativewind|@noble|@supabase|zustand|uuid))',
        'node_modules/react-native-reanimated/plugin/',
        'node_modules/@react-native/babel-preset/',
      ],
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
