import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppText } from '../../components/AppText';
import { RtlScrollView } from '../../components/rtl';
import { useAppDirection } from '../../hooks/useAppDirection';
import type { RootStackParamList } from '../../navigation/types';
import { getSupabase } from '../../services/supabase';

type RegisterScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Register'
>;

export function RegisterScreen({
  navigation,
}: RegisterScreenProps): React.ReactElement {
  const { isRTL, textAlign, writingDirection } = useAppDirection();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleContinue(): Promise<void> {
    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedName === '' || normalizedEmail === '') {
      setErrorMessage('יש להזין שם מלא ואימייל.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
      });

      if (error !== null) {
        setErrorMessage('לא הצלחנו לשלוח קוד אימות. נסה שוב.');
        return;
      }

      navigation.navigate('OTPVerify', {
        email: normalizedEmail,
      });
    } catch {
      setErrorMessage('לא הצלחנו לשלוח קוד אימות. נסה שוב.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function continueWithoutAccount(): void {
    navigation.navigate('Onboarding');
  }

  return (
    <SafeAreaView
      className="flex-1 bg-slate-50 dark:bg-app-dark"
      key={isRTL ? 'register-rtl' : 'register-ltr'}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <RtlScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="w-full gap-5 px-6 py-8">
            <View className="gap-2">
              <AppText className="text-3xl font-extrabold text-slate-900 dark:text-white">
                יצירת חשבון
              </AppText>
              <AppText className="text-base text-slate-600 dark:text-slate-300">
                נשלח קוד חד-פעמי לאימייל שלך.
              </AppText>
            </View>

            <View className="gap-2">
              <AppText className="font-bold text-slate-800 dark:text-slate-100">
                שם מלא
              </AppText>
              <TextInput
                autoCapitalize="words"
                autoComplete="name"
                className="min-h-[52px] rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                onChangeText={setFullName}
                style={{ textAlign, writingDirection }}
                value={fullName}
              />
            </View>

            <View className="gap-2">
              <AppText className="font-bold text-slate-800 dark:text-slate-100">
                אימייל
              </AppText>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                className="min-h-[52px] rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                keyboardType="email-address"
                onChangeText={setEmail}
                style={{ textAlign, writingDirection }}
                value={email}
              />
            </View>

            <View className="gap-2">
              <AppText className="font-bold text-slate-800 dark:text-slate-100">
                טלפון (אופציונלי)
              </AppText>
              <TextInput
                autoComplete="tel"
                className="min-h-[52px] rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                keyboardType="phone-pad"
                onChangeText={setPhone}
                style={{ textAlign, writingDirection }}
                value={phone}
              />
            </View>

            {errorMessage !== null ? (
              <AppText className="text-sm font-bold text-red-600 dark:text-red-300">
                {errorMessage}
              </AppText>
            ) : null}

            <Pressable
              accessibilityRole="button"
              className="min-h-[52px] items-center justify-center rounded-xl bg-blue-600 px-4 shadow-sm"
              disabled={isSubmitting}
              onPress={() => {
                void handleContinue();
              }}
            >
              <AppText className="text-lg font-extrabold text-white">
                {isSubmitting ? 'שולח…' : 'המשך'}
              </AppText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              className="min-h-[48px] items-center justify-center px-4"
              onPress={continueWithoutAccount}
            >
              <AppText className="font-bold text-blue-700 dark:text-blue-300">
                המשך ללא חשבון
              </AppText>
            </Pressable>
          </View>
        </RtlScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
