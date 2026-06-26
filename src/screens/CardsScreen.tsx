import React from 'react';
import {
  I18nManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useCardsStore } from '../store/useCardsStore';
import { CardIssuer, type CardInput } from '../types/card.types';

const ISSUER_LABELS: Record<CardIssuer, string> = {
  [CardIssuer.Max]: 'Max',
  [CardIssuer.Isracard]: 'Isracard',
  [CardIssuer.Cal]: 'CAL',
};

function getClubLabel(card: CardInput): string {
  if (card.unknownClub === true) {
    return 'מועדון לא ידוע 🔍';
  }

  return card.bankName ?? 'מועדון רגיל';
}

export function CardsScreen(): React.ReactElement {
  const cards = useCardsStore(state => state.cards);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>הכרטיסים שלי</Text>
          <Text style={styles.subtitle}>כל הכרטיסים שנשמרו במכשיר.</Text>
        </View>

        {cards.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>לא נמצאו כרטיסים</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {cards.map((card: CardInput): React.ReactElement => (
              <View key={card.cardId} style={styles.cardRow}>
                <View style={styles.cardTextGroup}>
                  <Text style={styles.cardName}>{card.displayName}</Text>
                  <Text style={styles.cardMeta}>
                    {ISSUER_LABELS[card.issuer]} · {getClubLabel(card)}
                  </Text>
                  <Text style={styles.cardMeta}>מסתיים ב-{card.last4}</Text>
                </View>

                {card.unknownClub === true ? (
                  <Pressable accessibilityRole="button" style={styles.editButton}>
                    <Text style={styles.editButtonText}>עריכה</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable accessibilityRole="button" style={styles.addButton}>
          <Text style={styles.addButtonText}>הוסף כרטיס</Text>
        </Pressable>
      </View>
    </View>
  );
}

const writingDirection = I18nManager.isRTL ? 'rtl' : 'ltr';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 96,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
    writingDirection,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
    textAlign: 'right',
    writingDirection,
  },
  emptyState: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
    writingDirection,
  },
  list: {
    gap: 12,
  },
  cardRow: {
    minHeight: 108,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  cardTextGroup: {
    flex: 1,
    alignItems: 'stretch',
  },
  cardName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
    writingDirection,
  },
  cardMeta: {
    marginTop: 5,
    fontSize: 14,
    color: '#475569',
    textAlign: 'right',
    writingDirection,
  },
  editButton: {
    minHeight: 36,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: 12,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0369A1',
    textAlign: 'center',
    writingDirection,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  addButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    writingDirection,
  },
});
