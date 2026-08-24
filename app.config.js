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
