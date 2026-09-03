import React, { useEffect } from 'react';
import { View } from 'react-native';
import {
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import './global.css';
import { useAppDirection } from './src/hooks/useAppDirection';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useLanguageStore } from './src/store/useLanguageStore';
import { CHROME } from './src/theme/tokens';
import { PLEX_FONT_ASSETS } from './src/theme/typography';
import { getRootDirectionStyle } from './src/utils/direction';

/**
 * THE NAVIGATION CHROME, ON THE FROZEN LIGHT PALETTE.
 *
 * This was `DarkTheme` with `#141414` written into it three times — a dark theme and three raw hex
 * literals, in the one file A8's scanner does not reach because it walks `src/`. V1 is light only
 * under OQ-MDC-027 option 1, so a dark navigation theme was a dark-mode value active in the
 * shipping build, and the literals were exactly the "no hardcoded colour outside the token module"
 * that T1 forbids. Both are gone: the theme is light, and every colour comes from `CHROME`.
 */
const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: CHROME.appLight,
    card: CHROME.white,
    text: CHROME.ink,
    border: CHROME.hairline,
    primary: CHROME.accent,
  },
};

function DirectionSplash(): React.ReactElement {
  return <View style={{ flex: 1, backgroundColor: CHROME.appLight }} />;
}

function AppShell(): React.ReactElement {
  const dir = useAppDirection();

  // T-24: do NOT key this View (or NavigationContainer) on directionKey.
  // Remounting unmounts AuthProvider → bootstrap UNKNOWN/LOCK flash even when
  // the in-memory DEK/session is still valid. Direction updates via style +
  // RtlRow/AppText; TabNavigator may remount tabs without remounting auth.
  return (
    <View style={getRootDirectionStyle(dir.language)}>
      <RootNavigator />
    </View>
  );
}

export default function App(): React.ReactElement {
  const isHydrated = useLanguageStore(state => state.isHydrated);
  const hydrateLanguage = useLanguageStore(state => state.hydrateLanguage);

  /**
   * THE TWELVE PLEX FACES, LOADED BEFORE ANYTHING RENDERS.
   *
   * React Native does not resolve a font stack: `fontFamily` names ONE registered face, and an
   * unregistered name falls back to the system font SILENTLY. So a screen painted before the faces
   * are ready would render in the platform default and look, to anyone watching, exactly like a
   * successful load. Rendering waits for `fontsLoaded` for that reason, on the same splash the
   * language hydration already uses.
   */
  const [fontsLoaded] = useFonts(PLEX_FONT_ASSETS);

  useEffect(() => {
    void hydrateLanguage();
  }, [hydrateLanguage]);

  const showMainUi = isHydrated && fontsLoaded;

  return (
    <>
      {/* SDK 57 edge-to-edge no longer supports status-bar color/translucency. */}
      <StatusBar style="dark" />
      {!showMainUi ? (
        <DirectionSplash />
      ) : (
        <SafeAreaProvider>
          <NavigationContainer theme={navigationTheme}>
            <AppShell />
          </NavigationContainer>
        </SafeAreaProvider>
      )}
    </>
  );
}
