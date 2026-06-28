import { registerRootComponent } from 'expo';

import i18n from './src/i18n';
import { getNormalizedLocale } from './src/i18n/locale';

i18n.changeLanguage(getNormalizedLocale());

// eslint-disable-next-line @typescript-eslint/no-require-imports
const App = require('./App').default;
registerRootComponent(App);
