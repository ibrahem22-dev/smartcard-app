import { registerRootComponent } from 'expo';
import { I18nManager } from 'react-native';

import App from './App';
import { getInitialLanguage } from './src/hooks/useLanguage';

const initialLanguage = getInitialLanguage();
const shouldUseRtl = initialLanguage === 'he' || initialLanguage === 'ar';

I18nManager.allowRTL(shouldUseRtl);
I18nManager.forceRTL(shouldUseRtl);

registerRootComponent(App);
