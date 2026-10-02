// THE EXPO CONFIG, BUILT FROM identity.json — criterion A10, Owner Decision OD-2's rider.
//
// `app.json` used to hold the display name, slug, scheme, bundle identifier and Android package
// directly. OD-2 defers the final public branding and asks that these stay "configurable in one
// place from P2 onward… do not scatter the string through source". A static app.json IS one of the
// places they were scattered to.
//
// This file is that config now, generated from `identity.json`, which the app also reads. Renaming
// the product is a change to one file.
//
// PLAIN CommonJS AND A JSON SOURCE, deliberately: Expo's config loader evaluates this in Node
// before any TypeScript exists, so a `.ts` source of truth would have needed a compiled copy for
// Expo to read — which is two homes for one fact, and the thing being fixed.

const identity = require('./identity.json');

/** @type {import('@expo/config-types').ExpoConfig} */
module.exports = {
  name: identity.displayName,
  slug: identity.slug,
  scheme: identity.scheme,
  version: identity.version,
  // OD-14 — `newArchEnabled` · CLOSED — APPROVED (2026-08-23):
  //
  //   > "restore `newArchEnabled: true` and then prove it on a physical device or emulator.
  //   > RESTORING THE FLAG WITHOUT A DEVICE RUN PROVES NOTHING: the whole point of the criterion is
  //   > that the inherited app has never been shown to run natively at all."
  //
  // Present in HEAD's `app.json`, deleted in the working tree it was inherited from, and still
  // `true` in `android/gradle.properties` — so the two halves of the build disagreed. MMKV expects
  // the New Architecture, which is what made the disagreement dangerous rather than untidy.
  //
  // This restores the flag. The device half is criterion F2 and Phase 11, and the `newarch` gate
  // reports it as UNPROVEN rather than counting the flag as the proof.
  newArchEnabled: true,
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
    bundleIdentifier: identity.bundleIdentifier,
    buildNumber: identity.iosBuildNumber,
  },
  android: {
    package: identity.androidPackage,
    versionCode: identity.androidVersionCode,
  },
  plugins: [
    'expo-asset',
    'expo-font',
    'expo-secure-store',
    '@react-native-community/datetimepicker',
    'expo-notifications',
  ],
};
