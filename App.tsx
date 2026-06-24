import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/navigation/RootNavigator';
import { keyVault } from './src/security/keyVault';


export default function App(): React.ReactElement {
  const [vaultReady, setVaultReady] = useState(false);
  



  useEffect(() => {
    keyVault
      .initializeOnFirstLaunch()
      .then(() => setVaultReady(true))
      .catch(() => setVaultReady(true));
  }, []);

  if (!vaultReady) {
    return <View style={{ flex: 1, backgroundColor: '#F9FAFB' }} />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
