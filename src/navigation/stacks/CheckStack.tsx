import React from 'react';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';

import { CheckInputScreen } from '../../screens/check/CheckInputScreen';
import { CheckVerdictScreen } from '../../screens/check/CheckVerdictScreen';
import { verdictPropsFromDraft } from '../../check/checkLoop';
import { classifyCollection } from '../../store/hydration';
import { useActivityStore } from '../../store/useActivityStore';
import { useCardsStore } from '../../store/useCardsStore';
import { useLoansStore } from '../../store/useLoansStore';
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
  const [committedActivityId, setCommittedActivityId] = React.useState<string | null>(null);
  const draft = route.params?.draft;
  const profile = useUserStore((s) => s.profile);
  /* THE COMPOSED ENGINE VIEW, not the stored entries — Owner ruling OQ-P5-002. The scoring engine
     needs `isActive` and `displayName`, which the {cardId, creditLimit} projection dropped. This is
     the same `cards` array every P5 surface reads. */
  const cards = useCardsStore((s) => s.cards);
  const purchases = useActivityStore((s) => s.purchases);
  /* THE VAULT'S EXISTING COMMITMENTS — Owner ruling OQ-P5-001, 2026-08-29.
     This route read profile, cards and purchases and stopped there, so the Check loop could not
     have seen the user's תשלומים or loans however it was written. Both stores were already
     populated and already read by every P5 surface; this route simply never asked. */
  const installments = useCardsStore((s) => s.obligations);
  const cardsHydration = useCardsStore((s) => s.hydration);
  const loans = useLoansStore((s) => s.loans);
  const loansHydration = useLoansStore((s) => s.hydration);

  if (draft === undefined) {
    return <CheckVerdictScreen />;
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const props = verdictPropsFromDraft(draft, {
    profile,
    cards,
    purchases,
    todayIso,
    installments,
    loans,
    /* `classifyCollection` and not `length === 0`. hydration.ts: "Reading items.length === 0
       directly is the bug." An empty list from a store that has not loaded is a loading artifact,
       and it is the single most optimistic input the verdict engine accepts. */
    commitmentReadiness: {
      installments: classifyCollection(cardsHydration, installments.length),
      loans: classifyCollection(loansHydration, loans.length),
    },
    /* C1's closed plain-purchase rendering keeps its prospective strip semantics. An installment
       pair replaces the prospect after commit so the persisted M + M(N-1) is not shown beside a
       second T hold. */
    includeProspectivePurchase: draft.installments === null || committedActivityId === null,
  });
  return (
    <CheckVerdictScreen
      {...props}
      onPurchaseLifecycleChange={setCommittedActivityId}
    />
  );
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
