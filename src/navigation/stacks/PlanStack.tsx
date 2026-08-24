import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CalendarScreen } from '../../screens/CalendarScreen';
import { NotYetSurface } from '../../components/NotYetSurface';
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
 * Commitments renders `NotYetSurface` — contract §9 sends the Plan content surfaces to P5a/P5b.
 */
const PLAN = BOTTOM_NAVIGATION.find((i) => i.key === 'Plan');

function PlanRoot(): React.ReactElement {
  return (
    <SegmentedTab
      segments={PLAN?.segments ?? []}
      testID="plan-segments"
      render={(segment): React.ReactElement =>
        segment === 'Calendar' ? (
          <CalendarScreen />
        ) : (
          <NotYetSurface
            ownedBy="P5b — Commitments (contract §9: Plan content surfaces)"
            testID="plan-commitments-not-yet"
            title="התחייבויות"
          />
        )
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
