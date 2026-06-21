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

import { CalendarScreen } from '../screens/CalendarScreen';
import { CardsScreen } from '../screens/CardsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { PurchaseGateScreen } from '../screens/PurchaseGateScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
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
  Home: 'Home',
  PurchaseGate: 'Purchase Gate',
  Cards: 'Cards',
  Calendar: 'Calendar',
  Settings: 'Settings',
};

export function TabNavigator(): React.ReactElement {
  return (
    <Tab.Navigator
      // Tabs render start-to-end; RTL is handled globally by I18nManager.
      screenOptions={({ route }): BottomTabNavigationOptions => ({
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabel: LABELS[route.name],
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="PurchaseGate" component={PurchaseGateScreen} />
      <Tab.Screen name="Cards" component={CardsScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
