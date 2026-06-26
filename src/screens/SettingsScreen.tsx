import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { SettingsStackParamList } from '../navigation/types';
import { rtl } from '../utils/rtlStyles';

type SettingsScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  'SettingsRoot'
>;

export function SettingsScreen({
  navigation,
}: SettingsScreenProps): React.ReactElement {
  return (
    <View className="flex-1 bg-slate-50 p-5 dark:bg-neutral-950" style={rtl.screen}>
      <Text
        className="mb-[18px] text-right text-[26px] font-extrabold text-slate-900 dark:text-white"
        style={rtl.text}
      >
        הגדרות
      </Text>
      <Pressable
        accessibilityRole="button"
        className="min-h-[50px] items-center justify-center rounded-lg bg-slate-900 dark:bg-white"
        onPress={(): void => navigation.navigate('Contact')}
      >
        <Text
          className="text-center text-base font-extrabold text-white dark:text-slate-900"
          style={rtl.text}
        >
          צור קשר עם חברת האשראי
        </Text>
      </Pressable>
    </View>
  );
}
