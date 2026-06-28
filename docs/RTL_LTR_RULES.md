# RTL / LTR Rules — SmartCard (mandatory for all agents)

**Status:** Permanent architecture. Do not bypass with per-screen patches.

## Languages

| Language | Layout | Text align | Writing direction |
|---|---|---|---|
| Hebrew (`he`) | RTL | right | rtl |
| English (`en`) | LTR | left | ltr |

Each language is a full mirrored experience — not mixed direction on one screen.

## Strategy A — Native RTL + full Activity restart (device-verified)

**Root cause:** `layoutRTL=true` from store/helpers while `I18nManager.isRTL=false` means Yoga, React Navigation, and tab bar stay LTR. Text may align right but the app is not a true RTL layout.

**How layout works:**

1. `src/i18n/applyNativeDirection.ts` — **sole** module that calls `I18nManager.forceRTL` / `swapLeftAndRightInRTL`.
2. `index.js` (first import chain) — read MMKV language → `applyNativeDirectionForLanguage` → if `I18nManager.isRTL` mismatch → **native restart** via `react-native-restart`.
3. `isLayoutRTL()` / `useAppDirection()` read **`I18nManager.isRTL`** (not store alone).
4. `App.tsx` — splash until native direction synced; `NavigationContainer key={directionKey}`; root `View key={directionKey}` with `direction: rtl|ltr`.
5. Horizontal rows: plain `flex-row` — Yoga mirrors under native RTL. **Never** `row-reverse`.
6. Language switch in Settings: persist MMKV → `applyNativeDirectionForLanguage` → restart alert → **do not** update store/i18n until after restart.

`MainApplication.kt` keeps `I18nUtil.allowRTL(ctx, true)` only — never permanent `forceRTL(true)` in Kotlin.

### Acceptance (debug banner)

| Language | Required |
|---|---|
| Hebrew | `nativeRTL=true`, `root=rtl`, green banner |
| English | `nativeRTL=false`, `root=ltr`, green banner |

If Hebrew shows `nativeRTL=false`, the bug is **not** fixed.

| Module | Role |
|---|---|
| `src/i18n/applyNativeDirection.ts` | `forceRTL`, `swapLeftAndRightInRTL`, navigation key |
| `src/utils/reloadApp.ts` | `react-native-restart` → `Updates.reloadAsync` → `DevSettings.reload` fallback |
| `src/utils/locale.ts` | Resolve `he` / `en` from MMKV + device (`iw`→`he`) |
| `src/utils/directionValues.ts` | Pure RTL/LTR math (testable) |
| `src/utils/direction.ts` | `isLayoutRTL()` from `I18nManager`, boot sync |
| `src/hooks/useAppDirection.ts` | Hook for screens/components |
| `src/components/AppText.tsx` | All text — uses `useAppDirection()` |
| `App.tsx` | Direction gate + keyed `NavigationContainer` |
| `index.js` | Apply native direction before `registerRootComponent` |

## Rules for developers / agents

### DO

- Use `<AppText>` for all visible text (never raw `<Text>`).
- Use `useAppDirection()` or `rtl.row` / `inputStyle()` for direction-sensitive UI.
- Use `style={rtl.row}` or `useAppDirection().row` for horizontal rows.
- Use `getTrailingOffset()` / `trailingOffset()` for badges on the trailing edge.
- On language change: persist MMKV → `applyNativeDirectionForLanguage` → native restart.
- Key `NavigationContainer` and root shell with `getDirectionNavigationKey(language)`.
- Verify bottom tab order after each language switch (native RTL mirrors declaration order).
- Add new Hebrew strings to `enBySource` in `src/i18n/en.ts`.
- Rebuild native after adding `react-native-restart` or `MainApplication.kt` changes: `npx expo run:android --device --clear`.

### DO NOT

- Call `I18nManager.forceRTL` outside `src/i18n/applyNativeDirection.ts`.
- Call `I18nManager.allowRTL(false)` — always `allowRTL(true)`.
- Use store language alone for layout when `I18nManager.isRTL` disagrees.
- Use `flexDirection: 'row-reverse'` or `flex-row-reverse` (double-flip under native RTL).
- Hardcode `left/right/ml/mr/pl/pr/flex-row` in reusable UI unless direction-independent.
- Hardcode `textAlign: 'left'|'right'` (ESLint blocks this except intentional center).
- Put `className` on `ScrollView` / `KeyboardAvoidingView` (Android NativeWind crash).
- Call `forceRTL` inside `useEffect` or screen bodies (too late — boot + restart only).
- Read `getLocales()` outside `locale.ts` / `getDeviceLanguage()`.

## Why `row-reverse` is forbidden

`I18nManager.forceRTL(true)` makes Yoga mirror plain `flexDirection: 'row'`.
Adding `row-reverse` flips **twice** → Hebrew looks LTR (tabs, rows, menus wrong).

## Language switch flow

1. User picks language in Settings.
2. Write `app:language_preference` to MMKV **first**.
3. `applyNativeDirectionForLanguage(newLang)`.
4. If `I18nManager.isRTL` ≠ expected → restart alert → `restartAppForDirectionChange`.
5. **Skip** `setPreference` / `i18n.changeLanguage` until after restart when direction changes.
6. After restart: `index.js` → apply direction → `syncBootLanguage()` → `i18n` → App.

## New screen checklist

- [ ] Root: `SafeAreaView` or `useSafeAreaInsets()`
- [ ] All text: `<AppText>`
- [ ] Rows: `style={rtl.row}` — no `row-reverse`
- [ ] TextInput: `style={inputStyle()}`
- [ ] No `text-left` / `text-right` NativeWind on text
- [ ] `enBySource` entries for new `t('...')` strings

## Verification

```powershell
adb uninstall com.smartcard.app
npx expo start -c
npx expo run:android --device --clear
```

```powershell
npx tsc --noEmit
npx jest src/utils/__tests__/direction.test.ts
```

Manual:

1. English fresh launch → `lang=en nativeRTL=false root=ltr`.
2. Switch Hebrew → restart → `lang=he nativeRTL=true root=rtl`.
3. Switch English → restart → `lang=en nativeRTL=false root=ltr`.
4. Visit Home, Purchase, Cards, Calendar, Settings, Glossary — full mirror each language.

## Related docs

- `AGENTS.md` §14 — binding RTL contract
- `docs/RTL-AGENT-GUARD.md` — regression history and recovery
