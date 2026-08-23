/**
 * RENDER A SCREEN INSIDE THE PROVIDERS AND THE NAVIGATOR THE APP ITSELF GIVES IT.
 *
 * THE DISTINCTION THIS FILE EXISTS TO KEEP. Mocking a screen's own logic to make it mount would
 * make E2 a measurement of the mocks. Supplying the context it has in production is the opposite:
 * it is the only way to render the screen's REAL code at all, because a component that calls
 * `useAuth()` outside `AuthProvider`, or `useRoute()` outside a navigator, throws BY DESIGN — and
 * that throw is the provider doing its job, not the screen being broken.
 *
 * So this supplies exactly what `App.tsx` and the navigators supply, and nothing else. No
 * screen-specific stubbing, no per-screen special cases, no list of screens that get extra help.
 *
 * THE SCREEN IS MOUNTED AS A REAL ROUTE, not as a bare component with props sprinkled on. Passing a
 * hand-made `route` object would satisfy `route.params` and still fail `useRoute()`, because that
 * hook reads React Navigation's context rather than props. Registering the component in an actual
 * `Stack.Screen` gives it both, from the library, the way production does.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../../../src/navigation/authContext';

const Stack = createNativeStackNavigator();

/**
 * Route params default to EMPTY, and the harness never guesses them.
 *
 * Filling them with plausible values would be inventing the screen's inputs, and a screen that
 * renders only because the harness guessed its parameters has not been shown to render — it has
 * been shown to render one guess.
 *
 * A screen may instead DECLARE a fixture, at `src/screens/__tests__/fixtures/<Screen>.params.json`.
 * That is a different act from guessing: the values are committed, reviewable in a diff, and
 * labelled as inputs rather than presented as findings. Everything without a declared fixture still
 * gets `{}`.
 */
export const renderScreen = (
  Component: React.ComponentType<Record<string, unknown>>,
  initialParams: Record<string, unknown> = {},
) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <AuthProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen
              name="ScreenUnderTest"
              component={Component as React.ComponentType<object>}
              initialParams={initialParams}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>,
  );
