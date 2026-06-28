import React, { useEffect, useState } from 'react';
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
import { keyVault } from './src/security/keyVault';
import { useLanguageStore } from './src/store/useLanguageStore';
import { getRootDirectionStyle } from './src/utils/direction';

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

  return (
    <View key={dir.directionKey} style={getRootDirectionStyle(dir.language)}>
      <RootNavigator />
    </View>
  );
}

export default function App(): React.ReactElement {
  const [vaultReady, setVaultReady] = useState(false);
  const isHydrated = useLanguageStore(state => state.isHydrated);
  const hydrateLanguage = useLanguageStore(state => state.hydrateLanguage);
  const dir = useAppDirection();

  useEffect(() => {
    hydrateLanguage();
    keyVault
      .initializeOnFirstLaunch()
      .then(() => setVaultReady(true))
      .catch(() => setVaultReady(true));
  }, [hydrateLanguage]);

  const showMainUi = vaultReady && isHydrated;

  return (
    <>
      <StatusBar
        style="light"
        backgroundColor="#141414"
        translucent={false}
      />
      {!showMainUi ? (
        <DirectionSplash />
      ) : (
        <SafeAreaProvider>
          <NavigationContainer key={`nav-${dir.directionKey}`} theme={navigationTheme}>
            <AppShell />
          </NavigationContainer>
        </SafeAreaProvider>
      )}
    </>
  );
}
