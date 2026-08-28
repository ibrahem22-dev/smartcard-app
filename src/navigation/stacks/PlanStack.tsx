import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CalendarScreen } from '../../screens/CalendarScreen';
import { CommitmentsScreen } from '../../screens/plan/CommitmentsScreen';
import { SegmentedTab } from '../SegmentedTab';
import { BOTTOM_NAVIGATION } from '../ia';
import type { PlanStackParamList } from '../types';

const Stack = createNativeStackNavigator<PlanStackParamList>();

/**
 * PLAN — Spec §4: *"**Plan** contains an internal segmented control: **Calendar | Commitments**."*
 *
 * Same shape as Wallet and the same component, deliberately: two segmented controls written twice
 * are two controls that start behaving differently, and a user learns the pattern is not a pattern.
 *
 * Commitments used to render `NotYetSurface`, owned by "P5b — Commitments". **P5 built it**, so
 * that placeholder is gone from this route and from the bundle: criterion B2, and *"a placeholder
 * that is still reachable is still shipped."* Calendar is a P2/P3 screen P5 extends in PHASE-6
 * rather than replaces — four of the five P5 surfaces were never placeholders (assumption A10).
 */
const PLAN = BOTTOM_NAVIGATION.find((i) => i.key === 'Plan');

function PlanRoot(): React.ReactElement {
  return (
    <SegmentedTab
      segments={PLAN?.segments ?? []}
      testID="plan-segments"
      render={(segment): React.ReactElement =>
        segment === 'Calendar' ? <CalendarScreen /> : <CommitmentsScreen />
      }
    />
  );
}

export function PlanStack(): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen component={PlanRoot} name="PlanRoot" options={{ title: 'Plan' }} />
    </Stack.Navigator>
  );
}
