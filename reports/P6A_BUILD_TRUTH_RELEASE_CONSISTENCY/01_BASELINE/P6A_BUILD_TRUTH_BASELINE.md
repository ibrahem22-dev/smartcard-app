# WP1 Evidence Recovery Baseline

Captured: 2026-08-31T09:14:38+03:00.

## Repository

- Path: `C:\Users\ebrah\smartcard-app`
- Branch: `wip/expo-57-working-tree`
- HEAD: `d0f0c0d0d473097900cdf3ab2c42e1dbad2a2eff`
- Upstream: `origin/wip/expo-57-working-tree`
- Initial status: only `reports/p4/d0f0c0d0d473.json` and `reports/p5/d0f0c0d0d473.json` were untracked; nothing was staged or tracked-modified.

## Evidence search before creation

The entire repository was searched before this directory was created. Each requested report name returned zero files, the directory name `P6A_BUILD_TRUTH_RELEASE_CONSISTENCY` returned zero directories, and content searches for the prior verdict returned zero files.

| Target | Count before recovery |
|---|---:|
| `P6A_FINAL_EXECUTION_REPORT.md` | 0 |
| `P6A_REQUIREMENT_STATUS_MATRIX.md` | 0 |
| `P6A_TEST_EXECUTION_REPORT.md` | 0 |
| `P6A_GIT_CHANGE_MANIFEST.md` | 0 |
| `P6A_RELEASE_BUILD_CONSISTENCY_MATRIX.md` | 0 |
| `P6A_NEGATIVE_CONTROL_MATRIX.md` | 0 |
| `P6A_BUILD_TRUTH_RELEASE_CONSISTENCY` directory | 0 |

## Implementation materialization result

The former WP1 source working tree was not present. `vaultBackup.ts`, `LearnScreen.tsx`, `DataPrivacyScreen.tsx`, `expoPackSetStore.ts`, `learnContent.ts`, `releaseConsistency.test.ts`, and `fxStalePropagation.test.ts` were absent. `package.json` had neither `expo-document-picker` nor `expo-sharing`.

Some partial/native remnants exist: the pre-WP1 notification scheduler remains in tracked source; the ignored generated Android manifest contains remote-messaging removal entries; and the prior APK existed before rebuild. This is case **B: some material exists, but the previous completion claim was overstated**.

## Pre-rebuild APK fact

Before validation rebuilt it, `android\app\build\outputs\apk\release\app-release.apk` existed, was 113,185,711 bytes, and had SHA-256 `E0C01AA45FA8BB2BE0F3A73B31BCBE8EFF967EF369E6C93645217F6CE0DA58B7`. Because the source that produced it was absent, it was an orphaned build artifact rather than reproducible build evidence.
