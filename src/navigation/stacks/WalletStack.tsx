import React from 'react';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';

import { AddCardScreen } from '../../screens/AddCardScreen';
import { CardDetailScreen } from '../../screens/CardDetailScreen';
import { CardsScreen } from '../../screens/CardsScreen';
import { CardDnaScreen } from '../../screens/cardDna/CardDnaScreen';
import { InterestCalculatorScreen } from '../../screens/InterestCalculatorScreen';
import { FxCompareFromCardDna } from '../../screens/fx/FxCompareFromCardDna';
import { NotYetSurface } from '../../components/NotYetSurface';
import { SegmentedTab } from '../SegmentedTab';
import { BOTTOM_NAVIGATION } from '../ia';
import type { WalletStackParamList } from '../types';

type WalletStackRoutes = WalletStackParamList & {
  CardEdit: { cardId: string };
};

type CardEditRouteProps = NativeStackScreenProps<WalletStackRoutes, 'CardEdit'>;
type LegacyCardDetailProps = React.ComponentProps<typeof CardDetailScreen>;

const Stack = createNativeStackNavigator<WalletStackRoutes>();

function CardEditRoute({
  navigation,
  route,
}: CardEditRouteProps): React.ReactElement {
  return (
    <CardDetailScreen
      navigation={navigation as unknown as LegacyCardDetailProps['navigation']}
      route={
        { ...route, name: 'CardDetail' } as unknown as LegacyCardDetailProps['route']
      }
    />
  );
}

/**
 * WALLET — Spec §4: *"**Wallet** contains an internal segmented control: **Cards | Benefits**."*
 *
 * The segments are NOT routes. They swap content inside one tab, which is what keeps the route tree
 * agreeing with a five-item navigation bar — a segmented control that registered routes would make
 * the tree say seven where the spec says five, and A1 measures exactly that.
 *
 * Benefits renders `NotYetSurface`, and it is **not P5's**. Spec §26 and P5 contract §17 keep the
 * Benefits Hub, Benefit Detail, matching, the cost breakdown and stacking in **V1.x**, so this route
 * keeps its evidenced empty state and P5 does not build the destination — criterion N8 requires
 * Card DNA's "View all benefits" link to behave honestly about a screen that is not built, not to
 * build it. A route that exists and says "not yet" is honest; a route missing from the IA would put
 * the shell out of step with the spec, which is the thing being measured.
 *
 * Its `ownedBy` used to read "P5b — Benefits Hub", which was the only place in the shipped product
 * telling a reader that P5 owed a Benefits Hub. `OWNER_AMENDMENTS_RAISED.md` A-4 recorded the
 * disagreement as advisory and one-directional — *"it cannot add work to P5, it can only mislead a
 * reader"* — and delegated the correction to the P5 work package already editing this file.
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
            ownedBy="V1.x — Benefits Hub (spec §26; P5 contract §17)"
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
      <Stack.Screen component={CardDnaScreen} name="CardDetail" options={{ title: 'Card' }} />
      <Stack.Screen component={CardEditRoute} name="CardEdit" options={{ title: 'Edit Card' }} />
      <Stack.Screen
        component={InterestCalculatorScreen}
        name="InterestCalculator"
        options={{ title: 'Interest Calculator' }}
      />
      <Stack.Screen
        component={FxCompareFromCardDna}
        name="CardDnaFxCompare"
        options={{ title: 'FX Compare' }}
      />
    </Stack.Navigator>
  );
}
