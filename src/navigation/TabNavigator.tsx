// /src/navigation/TabNavigator.tsx
//
// Spec §4's bottom navigation. Reachable only from inside AuthenticatedNavigator, which mounts
// only when AuthGate reports UNLOCKED.

import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { HomeStack } from './stacks/HomeStack';
import { MoreStack } from './stacks/MoreStack';
import { PlanStack } from './stacks/PlanStack';
import { WalletStack } from './stacks/WalletStack';
import { useAppDirection } from '../hooks/useAppDirection';
import { useTranslation } from '../hooks/useTranslation';
import { BOTTOM_NAVIGATION, RAISED_ACTION, RAISED_ACTION_ROUTE, TAB_ITEMS } from './ia';
import type { AuthenticatedStackParamList, TabParamList } from './types';
import { getTabsForDirection } from '../utils/direction';
import { ACCENT, CHROME, TEXT } from '../theme/tokens';

const Tab = createBottomTabNavigator<TabParamList>();

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Icons, keyed by the IA's route names. Declared beside the IA rather than inside it because an
 * icon is presentation and the IA is structure — the `nav` gate reads the structure and should not
 * have an opinion about glyphs.
 */
const ICONS: Record<string, IoniconName> = {
  Home: 'home-outline',
  Wallet: 'wallet-outline',
  Check: 'checkmark-circle',
  Plan: 'calendar-outline',
  More: 'ellipsis-horizontal',
};

const TAB_COMPONENTS: Record<string, React.ComponentType> = {
  Home: HomeStack,
  Wallet: WalletStack,
  Plan: PlanStack,
  More: MoreStack,
};

/**
 * THE RAISED CENTRE ACTION — Spec §4.
 *
 *   > *"**Check** is a raised center action button (brand teal) that opens a full-screen modal task
 *   > flow. **It is a task, not a tab; no tab is highlighted while inside it.**"*
 *
 * It is rendered OUTSIDE `Tab.Navigator`, absolutely positioned over the bar. That placement is the
 * mechanism, not a styling choice: a `Tab.Screen` would put Check in the route tree, give it a tab
 * to highlight, and let the tab bar sit above the modal it opened. Pressing this navigates the
 * AUTHENTICATED stack, one level above the tabs, so the modal covers the bar and no tab changes.
 */
function RaisedCheckAction(): React.ReactElement | null {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthenticatedStackParamList>>();

  if (RAISED_ACTION === undefined) return null;

  return (
    <View className="absolute inset-x-0 bottom-0 items-center" pointerEvents="box-none">
      <Pressable
        accessibilityLabel={t(RAISED_ACTION.label)}
        accessibilityRole="button"
        className={`-mb-1 min-h-[56px] min-w-[56px] items-center justify-center rounded-full ${ACCENT.solid}`}
        onPress={(): void => {
          navigation.navigate(RAISED_ACTION_ROUTE);
        }}
        testID="raised-check-action"
      >
        <Ionicons color={CHROME.white} name={ICONS.Check} size={28} />
      </Pressable>
      <AppText className={`text-xs font-bold ${TEXT.onAccent}`}>
        {t(RAISED_ACTION.label)}
      </AppText>
    </View>
  );
}

export function TabNavigator(): React.ReactElement {
  const { t } = useTranslation();
  const { directionKey, isRTL } = useAppDirection();

  // Order comes from the IA, mirrored in turn from the spec. Direction reverses it for RTL, which
  // is why the raised action sits at the centre in both: the centre of five is the centre either
  // way round.
  const tabOrder = getTabsForDirection(
    TAB_ITEMS.map((i) => i.key) as (keyof TabParamList)[],
    isRTL,
  );

  return (
    <View className="flex-1">
      <Tab.Navigator
        key={directionKey}
        screenOptions={({ route }): BottomTabNavigationOptions => ({
          headerShown: false,
          tabBarActiveTintColor: CHROME.accent,
          tabBarInactiveTintColor: CHROME.subtle,
          tabBarLabel: t(
            BOTTOM_NAVIGATION.find((i) => i.key === route.name)?.label ?? route.name,
          ),
          tabBarStyle: {
            backgroundColor: CHROME.appDark,
            borderTopColor: CHROME.hairlineDark,
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name={ICONS[route.name] ?? 'ellipse-outline'} size={size} />
          ),
        })}
      >
        {tabOrder.map((name) => {
          const component = TAB_COMPONENTS[name];
          // A tab in the IA with no component is a mistake in this file, not a state to render
          // around. Skipping it silently would produce a bar with four items where the spec says
          // four and hide which one went missing.
          if (component === undefined) return null;
          return <Tab.Screen component={component} key={name} name={name} />;
        })}
      </Tab.Navigator>
      <RaisedCheckAction />
    </View>
  );
}
