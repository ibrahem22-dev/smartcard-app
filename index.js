// @ts-check
// RTL BOOTSTRAP — MUST BE FIRST IMPORT (see AGENTS §14, RULE RTL-1).
// languageService normalizes the locale (Samsung 'iw'→'he') and sets the native
// I18nManager direction synchronously, before navigation or any component mounts.
import {
  getNormalizedLocale,
  rtlDirectionChanged,
} from './src/utils/languageService';

import { registerRootComponent } from 'expo';

const resolvedLang = getNormalizedLocale();

// forceRTL only takes visual effect after a JS reload. If languageService flipped
// the direction, force a single reload on the first boot after a new build so the
// layout is not left mirrored/broken. Dev: Fast Refresh is not enough — reload
// manually (shake → Reload) after the direction flips.
if (rtlDirectionChanged && !__DEV__) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Updates = require('expo-updates');
  Updates.reloadAsync();
}

// Load after RTL resolution — avoid side effects before boot prefs are read.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const i18n = require('./src/i18n').default;
i18n.changeLanguage(resolvedLang);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const App = require('./App').default;
registerRootComponent(App);
