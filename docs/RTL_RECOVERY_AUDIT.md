# RTL/LTR Codebase Recovery Audit

Branch: `audit/rtl-recovery-cleanup` (created from `fix/rtl-final-root-cause`).
Backups: `rtl-current-working-tree-before-audit.patch` at repo root (full pre-audit diff).
No `git reset --hard`, no deletions, no engine/business-logic changes.

## 1. Pre-audit state

- All failed RTL work was **uncommitted** (working tree only). HEAD `4ace88f` == `main`
  == `origin/main` is the clean baseline.
- Raw `git diff` looked catastrophic: 68 files / ~8,800 lines. Ignoring whitespace +
  EOL (`git diff -w --ignore-cr-at-eol`) it collapses to **35 files / ~530 insertions**.
  The other ~33 files (`types/*.ts`, `security/keyVault.ts`, `coverage/*.html`,
  `.cursorrules`) are **pure CRLF<->LF churn — zero real change.** No engines, types,
  security, or business logic were actually modified.

## 2. Strategy found in the code

- **Live strategy: Manual Dynamic RTL** (Zustand `resolvedLanguage` is the source of
  truth; no runtime `I18nManager.forceRTL`). Reactivity and instant switch are wired:
  `setLanguageChoice` updates store + i18n immediately; `directionKey` change remounts
  the root View, `NavigationContainer`, and `Tab.Navigator` via `key`.
- **No active Native RTL** at runtime. `I18nManager` appears only in a test mock and the
  dev-only `RtlDebugBanner`. `react-native-restart` is in `package.json` but **imported
  nowhere** (orphan dependency).
- Auto-detect is correct in current code: `getDeviceLanguage` / `getNormalizedLocale`
  handle `en`, `he`, and Samsung's legacy `iw`.

Conclusion: the runtime is **not** strategy-mixed. Kept Manual Dynamic (matches the
"instant switch, no reload" product requirement). Removed the orphaned Native-restart
remnants from consideration.

## 3. Root cause (evidence-based)

`RtlRow` applied **two compounding RTL mechanisms on the same node**:

```tsx
// BEFORE (buggy)
style={{ flexDirection: dir.rowDirection /* row-reverse */,
         direction: dir.writingDirection /* 'rtl' */ }}
```

In Hebrew, `direction:'rtl'` makes Yoga lay the row right-to-left, and
`flexDirection:'row-reverse'` reverses it **again** -> the two cancel and the row
renders **left-to-right**. That is the reported "Hebrew RTL not resolved." English
(`row` + `ltr`) has no conflict, so English looked fine.

The same `direction:'rtl'` was also set on the root container, `RtlScreen`, `RtlView`,
and `RtlScrollView`, so it **cascaded** down and re-introduced the double flip even where
`RtlRow` alone would have been correct.

Why tests passed while the device failed: unit tests assert the helpers return the
**correct values** (`'row-reverse'`, `'rtl'`, reversed tab array). No unit test can see
Yoga's native layout double-negation — only a real device/Yoga shows it.

Supporting evidence: zero NativeWind directional classes remain in screens (already
stripped), and **zero logical `start`/`end` props** exist anywhere — so nothing depended
on `direction:'rtl'` to resolve edges. Removing it is safe.

## 4. Fix applied (minimum, single mechanism)

One RTL mechanism only — explicit and deterministic, no reliance on Yoga `direction`
cascade (which is unreliable on RN's old architecture without `I18nManager.isRTL`):

- Rows mirror via `flexDirection: 'row-reverse'` (`RtlRow`).
- Text aligns via `textAlign` + `writingDirection` (`RtlText` / `AppText`) — unchanged.
- Removed the `direction: 'rtl'` **layout** style from: `getRootDirectionStyle`,
  `RtlRow`, `RtlView`, `RtlScreen`, `RtlScrollView`.

Files changed: `src/components/rtl/RtlRow.tsx`, `RtlView.tsx`, `RtlScreen.tsx`,
`RtlScrollView.tsx`, `src/utils/direction.ts`. No screen content/structure changed.

## 5. Cleanup (deprecated, not deleted)

Marked `// @deprecated ... not used at runtime` (no importers found):
`src/utils/locale.ts` (dup re-export of `src/i18n/locale.ts`),
`src/utils/directionValues.ts` (re-export shim),
`src/utils/rtlStyles.ts` (`useRtlStyles` — also a layering violation: a util importing a
hook), `src/debug/rtlDebugLog.ts`.

Flagged for follow-up (not changed this pass):
- `src/debug/rtlDebugLog.ts` posts to a **localhost debug endpoint via `fetch()`**
  (`http://127.0.0.1:7453/...`). Dev-only and orphaned, but should be removed from the
  tree before any release.
- `react-native-restart` dependency is unused — remove from `package.json` after the
  fix is device-verified (left in place now to avoid an unverifiable lockfile change).
- `DirectionLabScreen` is registered in `SettingsStack`. Gate it behind `__DEV__` or
  remove from the production navigator before release.
- `RtlDebugBanner` is wired in `App.tsx` but already `__DEV__`-guarded (returns null in
  prod) — acceptable to keep for now.

## 6. Verification status (HONEST)

- TypeScript: baseline `tsc --noEmit` was **clean (exit 0)** before edits. Post-edit
  re-run could **not** be trusted in the Linux sandbox: the sandbox mount desynced and
  served stale/partial copies of just-edited files, producing false TS1005 syntax errors
  at non-existent line numbers. The editor-side files read back complete and valid. Re-run
  `npx tsc --noEmit` locally on Windows to confirm.
- Tests: not re-run (same sandbox-mount blocker). Run `npm test` locally.
- Android build: **BLOCKED** — Windows path-length Gradle error. See
  `ANDROID_BUILD_PATH_LENGTH_FIX.md`.
- Device: **NOT VERIFIED — DO NOT CLAIM FIXED.**

## 7. On-device verification checklist (after build runs)

Hebrew (RTL): rows right-to-left, text right-aligned, tabs reversed, back glyph points
right. English (LTR): rows left-to-right, text left-aligned, tabs normal. Switch language
in Settings -> updates instantly, no restart. Check: Home, Cards, PurchaseGate, Calendar,
Settings, Glossary, bottom tabs, and a `flex-row` content row on each.

Status: **CODE CLEANED / ROOT CAUSE IDENTIFIED / DEVICE VERIFICATION BLOCKED.**
