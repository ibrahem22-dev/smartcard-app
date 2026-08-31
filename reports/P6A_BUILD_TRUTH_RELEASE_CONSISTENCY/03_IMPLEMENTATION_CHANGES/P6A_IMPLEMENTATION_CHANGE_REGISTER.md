# P6-A Implementation Change Register

## Functional changes

| Area | Files | Change |
|---|---|---|
| Notifications | `src/services/notificationScheduler.ts`, `src/navigation/AuthenticatedNavigator.tsx`, `src/screens/DataPrivacyScreen.tsx`, `src/navigation/authContext.tsx`, `src/store/keys.ts`, Android manifest | Explicit opt-in; generic payloads; billing/waiver/annual schedules; no automatic auth-time prompt; reset cancellation; Firebase remote entry points removed |
| Vault transfer | `src/services/vaultBackup.ts`, `src/screens/DataPrivacyScreen.tsx`, package/config files | Encrypted export/import with integrity, schema/version refusal, user-selected destination, rollback, temporary ciphertext cleanup |
| Learn/privacy navigation | `src/data/adapter/learnContent.ts`, `src/screens/LearnScreen.tsx`, `src/screens/DataPrivacyScreen.tsx`, More stack/types/settings | HE/AR/EN canonical Learn plus Data & Privacy control surface |
| Pack update | `src/data/adapter/import/expoPackSetStore.ts`, `App.tsx` | Persistent stage/backup/promote and startup recovery preserving bundled/installed LKG |
| Stale/display truth | `src/data/adapter/fxStaleness.ts`, FX/currency engines and surfaces, money hook/util and ratio callers | Deterministic stale propagation and correct ratio percent formatting |
| Release gating | Settings/More stack, `src/release/__tests__/releaseConsistency.test.ts`, Android manifest | Dev-only UI/BOI path absent from release JS; remote-push manifest entry points removed |

## Tests added or updated

- Added: vault backup, Learn content, persistent pack store, FX stale propagation, release consistency, money ratio formatting.
- Updated: notification privacy/permission/billing controls and honesty registry.
- Existing Card DNA/Wallet conflict tests were retained according to spec §11-A; a temporary contrary Wallet change was reverted before final evidence.

## Dependencies

Added Expo-SDK-compatible `expo-document-picker` and `expo-sharing`. The install reported 21 existing dependency audit findings (13 moderate, 8 high); no unscoped automatic dependency rewrite was performed.

## Deliberately unchanged

No legal draft, Legal Operator determination, `Israeli Laws/**`, `_archive/**`, product identity, bundle/package ID, production network topology, analytics transport, or pipeline source was changed.

