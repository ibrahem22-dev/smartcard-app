# RTL Agent Guard — Do Not Regress (ISSUE-RTL-ROOT-FIX-02)

**Primary reference: [`RTL_LTR_RULES.md`](./RTL_LTR_RULES.md)** — central direction layer, agent rules, checklist.

**Read this before any UI, navigation, or language task.** Full contract: AGENTS.md §14.

## Why RTL keeps breaking after agent sessions

Three independent bugs were found that **stack together** and look like “random” regressions when Hebrew/English are switched or new screens are added:

### 1. Double-flip: manual `row-reverse` + native RTL

`I18nManager.forceRTL(true)` makes Yoga mirror plain `flexDirection: 'row'` automatically.

If a component **also** sets `row-reverse` (or `flex-row-reverse`), layout flips twice and Hebrew looks LTR.

**Known offender (fixed):** `TabNavigator.tsx` `tabBarStyle.flexDirection: 'row-reverse'`.

**Rule:** NEVER add `row-reverse` / `flex-row-reverse`. ESLint blocks `flexDirection: 'row-reverse'`.

### 2. Text/layout desync: two sources of “is RTL?”

| Source | What it controls | When it updates |
|---|---|---|
| `I18nManager.isRTL` | Yoga layout (rows, tabs, nav) | After `forceRTL` + **JS reload** |
| `useLanguageStore.isRTL` | Was used by `AppText` / `inputStyle` | **Immediately** on Settings language tap |

Updating the store **before** reload made Hebrew text align right while the layout stayed LTR (or the reverse after en→he). Screenshots showed headings on the wrong side and tabs in the wrong order.

**Rule:** `AppText`, `inputStyle()`, and absolute positions (`FeatureGate` badge) MUST use **`I18nManager.isRTL`**, not `useLanguageStore.isRTL`.

On language change that flips direction: persist MMKV → `applyNativeRtlDirection()` → reload → **do not** call `setPreference` / `i18n.changeLanguage` until reload (see `SettingsScreen.switchLanguage`).

### 3. `allowRTL(false)` on English

Calling `I18nManager.allowRTL(false)` when switching to English **disabled** native RTL capability. Returning to Hebrew after a hot reload could leave layout stuck LTR.

**Rule:** Always `I18nManager.allowRTL(true)`. Only `forceRTL` changes per language (`he`→`true`, `en`→`false`). Use `applyNativeRtlDirection()` in `languageService.ts`.

### 4. Dev boot skipped direction reload

`index.js` previously skipped reload when `rtlDirectionChanged` in `__DEV__`. After a language change, Metro hot refresh did **not** apply `forceRTL`, so developers saw broken layout until a manual reload.

**Rule:** `index.js` reloads in dev **and** production when direction changes at boot.

## Required stack (all three layers)

1. **`android/.../MainApplication.kt`** — `I18nUtil.allowRTL(ctx, true)` only. Never `forceRTL(true)` here.
2. **`index.js`** — import `languageService` **first**; reload if `rtlDirectionChanged`.
3. **`languageService.ts`** — `getNormalizedLocale()` (`iw`→`he`); `applyNativeRtlDirection()` on import.

## New screen checklist

- [ ] All text via `<AppText>` (never raw `<Text>`)
- [ ] Rows: `style={rtl.row}` or `flex-row` — **no** `row-reverse`
- [ ] TextInput: `style={inputStyle()}`
- [ ] No hardcoded `textAlign: 'left'|'right'`
- [ ] No `className` on `ScrollView` / `KeyboardAvoidingView` (Android NativeWind crash)
- [ ] New Hebrew `t('...')` strings → `enBySource` in `src/i18n/en.ts`
- [ ] Rebuild native after `MainApplication.kt` changes: `npx expo run:android --device`

## Recovery if RTL regresses again

1. Grep: `row-reverse`, `flex-row-reverse`, `forceRTL(true)` in native code
2. Confirm `AppText` still uses `I18nManager.isRTL`
3. Confirm `index.js` first import is `languageService`
4. Switch he↔en in Settings → tap OK to reload → verify **both** tabs and headings
5. Full native rebuild on Samsung device (emulator hides `iw` locale bugs)
