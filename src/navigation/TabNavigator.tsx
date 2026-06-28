// /src/navigation/TabNavigator.tsx
//
// The 5 financial tabs. This navigator can only be reached from inside
// AuthenticatedNavigator, which only mounts when AuthGate reports UNLOCKED.
// Purchase Gate is the primary, center action.
//
// Labels are English-only placeholders for the skeleton stage; localized
// Hebrew/Arabic copy lands in the M3 UX copy pass.

import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';

import { CalendarStack } from './stacks/CalendarStack';
import { useTranslation } from '../hooks/useTranslation';
import { CardsStack } from './stacks/CardsStack';
import { HomeStack } from './stacks/HomeStack';
import { PurchaseGateStack } from './stacks/PurchaseGateStack';
import { SettingsStack } from './stacks/SettingsStack';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<keyof TabParamList, IoniconName> = {
  Home: 'home-outline',
  PurchaseGate: 'checkmark-circle-outline',
  Cards: 'card-outline',
  Calendar: 'calendar-outline',
  Settings: 'menu-outline',
};

const LABELS: Record<keyof TabParamList, string> = {
  Home: 'בית',
  PurchaseGate: 'בדיקת קנייה',
  Cards: 'כרטיסים',
  Calendar: 'לוח',
  Settings: 'תפריט',
};

export function TabNavigator(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      // Tabs render start-to-end; RTL is handled globally by I18nManager.
      screenOptions={({ route }): BottomTabNavigationOptions => ({
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabel: t(LABELS[route.name]),
        tabBarStyle: {
          backgroundColor: '#141414',
          borderTopColor: '#262626',
          // RTL RULE RTL-4: never row-reverse — I18nManager mirrors tab order natively.
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="PurchaseGate" component={PurchaseGateStack} />
      <Tab.Screen name="Cards" component={CardsStack} />
      <Tab.Screen name="Calendar" component={CalendarStack} />
      <Tab.Screen name="Settings" component={SettingsStack} />
    </Tab.Navigator>
  );
}
