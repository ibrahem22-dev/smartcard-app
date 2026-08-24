import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AddCardScreen } from '../../screens/AddCardScreen';
import { CardDetailScreen } from '../../screens/CardDetailScreen';
import { CardsScreen } from '../../screens/CardsScreen';
import { InterestCalculatorScreen } from '../../screens/InterestCalculatorScreen';
import { NotYetSurface } from '../../components/NotYetSurface';
import { SegmentedTab } from '../SegmentedTab';
import { BOTTOM_NAVIGATION } from '../ia';
import type { WalletStackParamList } from '../types';

const Stack = createNativeStackNavigator<WalletStackParamList>();

/**
 * WALLET — Spec §4: *"**Wallet** contains an internal segmented control: **Cards | Benefits**."*
 *
 * The segments are NOT routes. They swap content inside one tab, which is what keeps the route tree
 * agreeing with a five-item navigation bar — a segmented control that registered routes would make
 * the tree say seven where the spec says five, and A1 measures exactly that.
 *
 * Benefits renders `NotYetSurface`: contract §9 sends the Wallet CONTENT surfaces to P5a/P5b and
 * this work package is the shell. A route that exists and says "not yet" is honest; a route missing
 * from the IA would put the shell out of step with the spec, which is the thing being measured.
 *
 * The segments come from `ia.ts`, not from a list here — one declaration, and the gate reads it.
 */
const WALLET = BOTTOM_NAVIGATION.find((i) => i.key === 'Wallet');

function WalletRoot(): React.ReactElement {
  return (
    <SegmentedTab
      segments={WALLET?.segments ?? []}
      testID="wallet-segments"
      render={(segment): React.ReactElement =>
        segment === 'Cards' ? (
          <CardsScreen />
        ) : (
          <NotYetSurface
            ownedBy="P5b — Benefits Hub (contract §9: Wallet content surfaces)"
            testID="wallet-benefits-not-yet"
            title="הטבות"
          />
        )
      }
    />
  );
}

export function WalletStack(): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen component={WalletRoot} name="WalletRoot" options={{ title: 'Wallet' }} />
      <Stack.Screen component={AddCardScreen} name="AddCard" options={{ title: 'Add Card' }} />
      <Stack.Screen component={CardDetailScreen} name="CardDetail" options={{ title: 'Card' }} />
      <Stack.Screen
        component={InterestCalculatorScreen}
        name="InterestCalculator"
        options={{ title: 'Interest Calculator' }}
      />
    </Stack.Navigator>
  );
}
