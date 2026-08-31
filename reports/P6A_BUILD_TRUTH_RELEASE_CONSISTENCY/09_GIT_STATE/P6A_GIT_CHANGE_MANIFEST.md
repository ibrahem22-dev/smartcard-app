# P6-A Git Change Manifest

## Baseline

- Branch: `wip/expo-57-working-tree`
- Starting/ending commit: `d0f0c0d0d473097900cdf3ab2c42e1dbad2a2eff` (no commit created)
- Upstream: `origin/wip/expo-57-working-tree`
- Staged files: none
- Pre-existing owner work preserved: `reports/p4/d0f0c0d0d473.json`, `reports/p5/d0f0c0d0d473.json`

## Work Package 1 changes

Application/config changes are enumerated in `03_IMPLEMENTATION_CHANGES/P6A_IMPLEMENTATION_CHANGE_REGISTER.md`. Test changes are enumerated there and in the execution report. This evidence tree is new under `reports/P6A_BUILD_TRUTH_RELEASE_CONSISTENCY/`.

`tools/p2/boundary-controls.json` was refreshed by the repository's own negative-control command with the current SHA/time. No source reset, clean, stash, checkout, commit, merge, rebase, branch switch, or push occurred.

## Excluded paths

No file under the legal package, `Israeli Laws/**`, `_archive/**`, the data-pipeline repository, or MDC staging was modified.

## Ending state

Final tracked content changes:

```text
App.tsx
app.config.js
package-lock.json
package.json
src/data/adapter/fxStaleness.ts
src/engines/__tests__/honestyEngine.test.ts
src/engines/currency.ts
src/engines/fx.ts
src/hooks/useMoney.ts
src/navigation/AuthenticatedNavigator.tsx
src/navigation/authContext.tsx
src/navigation/stacks/MoreStack.tsx
src/navigation/types.ts
src/screens/SettingsScreen.tsx
src/screens/cardDna/SectionDActiveNow.tsx
src/screens/check/CheckVerdictScreen.tsx
src/screens/fx/FxCompareSheet.tsx
src/screens/home/HomeLoadBar.tsx
src/screens/plan/CommitmentsSummary.tsx
src/services/__tests__/notificationScheduler.test.ts
src/services/notificationScheduler.ts
src/store/keys.ts
src/utils/money.ts
tools/p2/boundary-controls.json
```

`src/data/adapter/conflictRender.ts` appears as worktree-modified because of the checkout's line-ending/stat state, but `git diff`, `git diff --raw`, and `git diff --numstat` report no content change. It is not claimed as a Work Package content change.

Final untracked Work Package files:

```text
reports/P6A_BUILD_TRUTH_RELEASE_CONSISTENCY/** (the ten reports in this package)
src/data/adapter/__tests__/learnContent.test.ts
src/data/adapter/import/__tests__/expoPackSetStore.test.ts
src/data/adapter/import/expoPackSetStore.ts
src/data/adapter/learnContent.ts
src/engines/__tests__/fxStalePropagation.test.ts
src/release/__tests__/releaseConsistency.test.ts
src/screens/DataPrivacyScreen.tsx
src/screens/LearnScreen.tsx
src/services/__tests__/vaultBackup.test.ts
src/services/vaultBackup.ts
src/utils/__tests__/money.test.ts
```

Final untracked pre-existing owner files, still preserved:

```text
reports/p4/d0f0c0d0d473.json
reports/p5/d0f0c0d0d473.json
```

Nothing is staged. Build output under ignored Android build directories is identified by path/hash in the release audit.
