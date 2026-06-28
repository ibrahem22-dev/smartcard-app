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
import { RootNavigator } from './src/navigation/RootNavigator';
import { keyVault } from './src/security/keyVault';

const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#141414',
    card: '#141414',
    text: '#FFFFFF',
  },
};

export default function App(): React.ReactElement {
  const [vaultReady, setVaultReady] = useState(false);

  useEffect(() => {
    keyVault
      .initializeOnFirstLaunch()
      .then(() => setVaultReady(true))
      .catch(() => setVaultReady(true));
  }, []);

  return (
    <>
      <StatusBar
        style="light"
        backgroundColor="#141414"
        translucent={false} // required — Android default is true, causes content overlap
      />
      {!vaultReady ? (
        <View style={{ flex: 1, backgroundColor: '#141414' }} />
      ) : (
        <SafeAreaProvider>
          <NavigationContainer theme={navigationTheme}>
            <View style={{ flex: 1 }}>
              <RootNavigator />
            </View>
          </NavigationContainer>
        </SafeAreaProvider>
      )}
    </>
  );
}
