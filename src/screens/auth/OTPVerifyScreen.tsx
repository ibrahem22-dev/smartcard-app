import React, { useEffect, useState } from 'react';
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
import { FeatureGate } from '../../components/FeatureGate';
import { useAppDirection } from '../../hooks/useAppDirection';
import type { RootStackParamList } from '../../navigation/types';
import { getSupabase } from '../../services/supabase';

type OTPVerifyScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'OTPVerify'
>;

const OTP_EXPIRY_SECONDS = 10 * 60;
const RESEND_DELAY_SECONDS = 60;

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
    .toString()
    .padStart(2, '0')}`;
}

export function OTPVerifyScreen({
  navigation,
  route,
}: OTPVerifyScreenProps): React.ReactElement {
  const { isRTL, textAlign, writingDirection } = useAppDirection();
  const [token, setToken] = useState('');
  const [expirySeconds, setExpirySeconds] = useState(OTP_EXPIRY_SECONDS);
  const [resendSeconds, setResendSeconds] = useState(RESEND_DELAY_SECONDS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const timer = setInterval((): void => {
      setExpirySeconds(current => Math.max(0, current - 1));
      setResendSeconds(current => Math.max(0, current - 1));
    }, 1_000);

    return (): void => clearInterval(timer);
  }, []);

  function updateToken(value: string): void {
    setToken(value.replace(/\D/g, '').slice(0, 6));
  }

  async function handleVerify(): Promise<void> {
    if (token.length !== 6 || expirySeconds === 0) {
      setErrorMessage(
        expirySeconds === 0
          ? 'תוקף הקוד פג. שלח קוד חדש.'
          : 'יש להזין קוד בן 6 ספרות.',
      );
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.verifyOtp({
        email: route.params.email,
        token,
        type: 'email',
      });

      if (error !== null) {
        setErrorMessage('הקוד שגוי או שפג תוקפו.');
        return;
      }

      navigation.navigate('Lock', { mode: 'pin_setup' });
    } catch {
      setErrorMessage('לא הצלחנו לאמת את הקוד. נסה שוב.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend(): Promise<void> {
    if (resendSeconds > 0) {
      return;
    }

    setErrorMessage(null);
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email: route.params.email,
    });

    if (error !== null) {
      setErrorMessage('לא הצלחנו לשלוח קוד חדש.');
      return;
    }

    setToken('');
    setExpirySeconds(OTP_EXPIRY_SECONDS);
    setResendSeconds(RESEND_DELAY_SECONDS);
  }

  return (
    <SafeAreaView
      className="flex-1 bg-slate-50 dark:bg-app-dark"
      key={isRTL ? 'otp-rtl' : 'otp-ltr'}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-center"
      >
        <View className="w-full gap-5 px-6 py-8">
          <AppText className="text-3xl font-extrabold text-slate-900 dark:text-white">
            אימות אימייל
          </AppText>
          <AppText className="text-base text-slate-600 dark:text-slate-300">
            הזן את הקוד שנשלח אל {route.params.email}
          </AppText>

          <TextInput
            autoFocus
            className="min-h-[60px] rounded-xl border border-slate-300 bg-white px-4 text-2xl tracking-[10px] text-slate-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={updateToken}
            style={{ textAlign, writingDirection }}
            value={token}
          />

          <AppText className="text-sm text-slate-600 dark:text-slate-300">
            תוקף הקוד: {formatCountdown(expirySeconds)}
          </AppText>

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
              void handleVerify();
            }}
          >
            <AppText className="text-lg font-extrabold text-white">
              {isSubmitting ? 'מאמת…' : 'אימות'}
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            className="min-h-[48px] items-center justify-center px-4"
            disabled={resendSeconds > 0}
            onPress={() => {
              void handleResend();
            }}
          >
            <AppText className="font-bold text-blue-700 dark:text-blue-300">
              {resendSeconds > 0
                ? `שלח שוב בעוד ${resendSeconds} שניות`
                : 'שלח שוב'}
            </AppText>
          </Pressable>

          <FeatureGate feature="ProUpgrade">
            <View className="rounded-xl border border-slate-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
              <AppText className="font-bold text-slate-700 dark:text-slate-200">
                אימות באמצעות SMS
              </AppText>
            </View>
          </FeatureGate>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
