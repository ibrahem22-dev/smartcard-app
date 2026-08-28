/**
 * THE `agreement` JEST PROJECT, KEPT OUT OF `jest.config.cjs`'s EXPORTED OBJECT.
 *
 * P5's five cross-surface agreement properties are **deliberately red** until the surfaces they
 * compare exist (`campaign-p5/P5_EXECUTION_PLAN.md` §1.1), and `npx jest` — the suite step of both
 * `tools/p4/all.mjs` and `tools/p5/all.mjs` — runs every project it is given. So they are not in
 * `projects`, and their five gates run them with this config instead.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY IT IS A SEPARATE FILE RATHER THAN AN EXTRA KEY ON THE CONFIG
 *
 * It was an extra key at first, and jest validated the config and printed
 *
 *     ● Validation Warning:
 *       Unknown option "agreementProject" … was found.
 *
 * on **every jest invocation in the repository** — three warnings on every run of every suite, in
 * a project whose whole discipline is that output means something. A warning everyone learns to
 * scroll past is how a real one goes unread. `jest.config.cjs` requires this file for the one
 * pattern it needs and exports nothing jest does not recognise.
 */
const AGREEMENT_PROPERTIES = '**/__tests__/**/*.agreement.render.test.tsx';
const AGREEMENT_PROPERTY_PATTERN = '\\.agreement\\.render\\.test\\.tsx$';

const EXPO_TRANSFORM_IGNORE = [
  'node_modules/(?!(.pnpm|(jest-)?react-native|@react-native|@react-native-community'
    + '|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation'
    + '|@sentry/react-native|native-base|standard-navigation'
    // added for this app, from its own dependencies:
    + '|react-native-safe-area-context|react-native-screens|react-native-svg'
    + '|react-native-qrcode-svg|react-native-purchases|react-native-css-interop'
    + '|nativewind|@noble|@supabase|zustand|uuid))',
  'node_modules/react-native-reanimated/plugin/',
  'node_modules/@react-native/babel-preset/',
];

/** Identical environment to `render` — these properties mount the same components. */
const agreementProject = {
  displayName: 'agreement',
  preset: 'jest-expo',
  roots: ['<rootDir>/src'],
  testMatch: [AGREEMENT_PROPERTIES],
  modulePathIgnorePatterns: ['<rootDir>/.expo/'],
  setupFilesAfterEnv: ['<rootDir>/tools/p2/jest/render-setup.ts'],
  transformIgnorePatterns: EXPO_TRANSFORM_IGNORE,
};

module.exports = {
  AGREEMENT_PROPERTIES,
  AGREEMENT_PROPERTY_PATTERN,
  EXPO_TRANSFORM_IGNORE,
  agreementProject,
};
