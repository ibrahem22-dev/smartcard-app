import React from 'react';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';

import { CheckInputScreen } from '../../screens/check/CheckInputScreen';
import { CheckVerdictScreen } from '../../screens/check/CheckVerdictScreen';
import { verdictPropsFromDraft } from '../../check/checkLoop';
import { useActivityStore } from '../../store/useActivityStore';
import { useCardsStore } from '../../store/useCardsStore';
import { useUserStore } from '../../store/useUserStore';
import type { CheckStackParamList } from '../types';

const Stack = createNativeStackNavigator<CheckStackParamList>();

type InputProps = NativeStackScreenProps<CheckStackParamList, 'CheckInput'>;
type VerdictProps = NativeStackScreenProps<CheckStackParamList, 'CheckVerdict'>;

function CheckInputRoute({ navigation }: InputProps): React.ReactElement {
  const entries = useCardsStore((s) => s.entries);
  const ownedCards = entries.map((entry) => ({
    cardId: entry.user.cardId,
    displayName: entry.user.displayName,
  }));
  return (
    <CheckInputScreen
      onCheck={(draft): void => {
        navigation.navigate('CheckVerdict', { draft });
      }}
      {...(ownedCards.length > 0 ? { ownedCards } : {})}
    />
  );
}

function CheckVerdictRoute({ route }: VerdictProps): React.ReactElement {
  const draft = route.params?.draft;
  const profile = useUserStore((s) => s.profile);
  const entries = useCardsStore((s) => s.entries);
  const purchases = useActivityStore((s) => s.purchases);

  if (draft === undefined) {
    return <CheckVerdictScreen />;
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const props = verdictPropsFromDraft(draft, {
    profile,
    cards: entries.map((entry) => ({
      cardId: entry.user.cardId,
      creditLimit: entry.user.framework.creditLimit,
    })),
    purchases,
    todayIso,
  });
  return <CheckVerdictScreen {...props} />;
}

/**
 * THE CHECK TASK'S OWN STACK — what `CheckModal` mounts, and criterion B2.
 *
 * Two routes: ask a question, get an answer, log the purchase. The stack is
 * NOT where the modal presentation lives — that stays on `CheckModal`.
 */
export function CheckStack(): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen component={CheckInputRoute} name="CheckInput" options={{ title: 'Check' }} />
      <Stack.Screen
        component={CheckVerdictRoute}
        name="CheckVerdict"
        options={{ title: 'Verdict' }}
      />
    </Stack.Navigator>
  );
}
