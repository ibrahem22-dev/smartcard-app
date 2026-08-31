import React, { useEffect } from 'react';
import { View } from 'react-native';
import {
  DarkTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import './global.css';
import { useAppDirection } from './src/hooks/useAppDirection';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useLanguageStore } from './src/store/useLanguageStore';
import { getRootDirectionStyle } from './src/utils/direction';
import { expoPackSetStore } from './src/data/adapter/import/expoPackSetStore';
import { recoverAtStartup } from './src/data/adapter/import/packSetImport';

const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#141414',
    card: '#141414',
    text: '#FFFFFF',
  },
};

function DirectionSplash(): React.ReactElement {
  return <View style={{ flex: 1, backgroundColor: '#141414' }} />;
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

  useEffect(() => {
    void hydrateLanguage();
  }, [hydrateLanguage]);

  useEffect(() => {
    void recoverAtStartup(expoPackSetStore()).catch((): void => {
      // A failed recovery leaves the signed bundled last-known-good packs in use.
    });
  }, []);

  const showMainUi = isHydrated;

  return (
    <>
      {/* SDK 57 edge-to-edge no longer supports status-bar color/translucency. */}
      <StatusBar style="light" />
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
