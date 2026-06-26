import React from 'react';
import {
  I18nManager,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { SettingsStackParamList } from '../navigation/types';

type SettingsScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  'SettingsRoot'
>;

export function SettingsScreen({
  navigation,
}: SettingsScreenProps): React.ReactElement {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>הגדרות</Text>
      <Pressable
        accessibilityRole="button"
        onPress={(): void => navigation.navigate('Contact')}
        style={styles.linkButton}
      >
        <Text style={styles.linkButtonText}>צור קשר עם חברת האשראי</Text>
      </Pressable>
    </View>
  );
}

const writingDirection = I18nManager.isRTL ? 'rtl' : 'ltr';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  title: {
    marginBottom: 18,
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
    writingDirection,
  },
  linkButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#0F172A',
  },
  linkButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    writingDirection,
  },
});
