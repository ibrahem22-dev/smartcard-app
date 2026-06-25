// /src/screens/LockScreen.tsx
//
// Placeholder lock screen shown whenever AuthGate is not UNLOCKED.
// English-only placeholder copy for the skeleton stage; localized Hebrew/Arabic
// copy lands in the M3 UX copy pass (do not author RTL literals here yet).
//
// The "debug unlock" button is TEMPORARY scaffolding so the authenticated tree
// can be exercised before AUTH-01 wires real biometric/PIN auth. It calls the
// auth context (which calls keyVault.unlock()) and lets AuthGate re-register
// the authenticated branch.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../navigation/authContext';

export function LockScreen(): React.ReactElement {
  const auth = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Authenticate to continue</Text>

      {__DEV__ && auth.debugUnlock !== undefined ? (
        <Pressable
          accessibilityRole="button"
          style={styles.debugButton}
          onPress={() => {
            void auth.debugUnlock?.();
          }}
        >
          <Text style={styles.debugButtonText}>DEBUG: Unlock</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0F172A',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  debugButton: {
    marginTop: 40,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: '#2563EB',
  },
  debugButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
