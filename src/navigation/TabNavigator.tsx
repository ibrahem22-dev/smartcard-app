// /src/navigation/TabNavigator.tsx
//
// The 5 financial tabs. This navigator can only be reached from inside
// AuthenticatedNavigator, which only mounts when AuthGate reports UNLOCKED.

import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';

import { CalendarStack } from './stacks/CalendarStack';
import { useAppDirection } from '../hooks/useAppDirection';
import { useTranslation } from '../hooks/useTranslation';
import { CardsStack } from './stacks/CardsStack';
import { HomeStack } from './stacks/HomeStack';
import { PurchaseGateStack } from './stacks/PurchaseGateStack';
import { SettingsStack } from './stacks/SettingsStack';
import type { TabParamList } from './types';
import { getTabsForDirection } from '../utils/direction';

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

const TAB_COMPONENTS: Record<keyof TabParamList, React.ComponentType> = {
  Home: HomeStack,
  PurchaseGate: PurchaseGateStack,
  Cards: CardsStack,
  Calendar: CalendarStack,
  Settings: SettingsStack,
};

const BASE_TAB_ORDER: (keyof TabParamList)[] = [
  'Home',
  'PurchaseGate',
  'Cards',
  'Calendar',
  'Settings',
];

export function TabNavigator(): React.ReactElement {
  const { t } = useTranslation();
  const { directionKey, isRTL } = useAppDirection();
  const tabOrder = getTabsForDirection(BASE_TAB_ORDER, isRTL);

  return (
    <Tab.Navigator
      key={directionKey}
      screenOptions={({ route }): BottomTabNavigationOptions => ({
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabel: t(LABELS[route.name]),
        tabBarStyle: {
          backgroundColor: '#141414',
          borderTopColor: '#262626',
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name]} size={size} color={color} />
        ),
      })}
    >
      {tabOrder.map(name => (
        <Tab.Screen
          key={name}
          component={TAB_COMPONENTS[name]}
          name={name}
        />
      ))}
    </Tab.Navigator>
  );
}
