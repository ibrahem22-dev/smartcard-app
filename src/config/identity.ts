import identity from '../../identity.json';

/**
 * THE APP'S IDENTITY, AS THE APP SEES IT — criterion A10, Owner Decision OD-2's rider.
 *
 *   > **OD-2.** *"Keep app identifier, bundle id, display name and asset references **configurable
 *   > in one place** from P2 onward… **do not scatter the string through source**."*
 *
 * This is a VIEW of `identity.json`, not a second copy. `app.config.js` reads the same file to build
 * the Expo config, so the name in the app store, the name in a biometric prompt and the name on the
 * lock screen are one value.
 *
 * Before this, three source files carried `SmartCard` as literal text — two biometric prompts and a
 * lock-screen string. Renaming the product would have meant finding all of them, and the one that
 * was missed would have shown a user the old name **at the moment they were being asked to
 * authenticate**, which is the worst possible moment to look unfamiliar.
 *
 * The i18n layer is the one place the name may legitimately appear inside other text, because a
 * sentence like "Unlock SmartCard" has to be translated as a sentence. Those strings interpolate
 * `{{app}}` rather than embedding the name.
 */
export const APP_IDENTITY = {
  /** What a person sees. The working name until OD-2 rules; P7 is its trigger. */
  displayName: identity.displayName,
  slug: identity.slug,
  scheme: identity.scheme,
  bundleIdentifier: identity.bundleIdentifier,
  androidPackage: identity.androidPackage,
  version: identity.version,
} as const;

/**
 * The name as it appears inside a translated sentence.
 *
 * Exported separately so a call site reads `t('פתיחת {{app}}', { app: APP_NAME })` — the sentence
 * is translated, the name is substituted, and neither is embedded in the other.
 */
export const APP_NAME: string = identity.displayName;

/**
 * THE STORAGE NAMESPACE — the one identity field a rename must NOT change.
 *
 * Every other value here is branding and moves when OD-2 rules. This one names the store real
 * users' preferences live in: change it and every existing install opens a new, empty store,
 * losing their language, theme and onboarding state with no error at all, because a fresh store is
 * a valid store.
 *
 * It reads the same as the slug today. That coincidence is why it is a separate field.
 */
export const STORAGE_NAMESPACE: string = identity.storageNamespace;
