/**
 * O2's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 *   > *"No login, account, OTP or email appears anywhere in the onboarding flow,
 *   > derived by sweeping the rendered surfaces."*
 *
 * The population of onboarding screens is derived from disk. Walking only
 * OnboardingScreen's first frame would miss later steps, and walking a
 * hand-kept list of "the copy we checked" would go silent the day a fifth
 * step landed.
 */
import React from 'react';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../../../navigation/authContext';
import OnboardingScreen from '../OnboardingScreen';

const ONBOARDING_DIR = join(__dirname, '..');

const collectOnboardingScreens = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === '__tests__') continue;
      collectOnboardingScreens(p, acc);
    } else if (entry.endsWith('.tsx') && !entry.includes('.test.')) {
      acc.push(entry);
    }
  }
  return acc.sort();
};

const FORBIDDEN: readonly { readonly id: string; readonly re: RegExp }[] = [
  { id: 'login', re: /\blog[\s-]?in\b/i },
  { id: 'sign-in', re: /\bsign[\s-]?in\b/i },
  { id: 'sign-up', re: /\bsign[\s-]?up\b/i },
  { id: 'account', re: /\baccounts?\b/i },
  { id: 'otp', re: /\botp\b/i },
  { id: 'email', re: /\be-?mails?\b/i },
  { id: 'password', re: /\bpasswords?\b/i },
  { id: 'username', re: /\busernames?\b/i },
  { id: 'he-login', re: /התחברות|הרשמה/ },
  { id: 'he-email', re: /אימייל|דוא["״']?ל/ },
  { id: 'he-password', re: /סיסמ[הא]/ },
  { id: 'he-otp', re: /קוד חד[\s-]?פעמי|סיסמה חד[\s-]?פעמית/ },
  { id: 'ar-login', re: /تسجيل الدخول|إنشاء حساب/ },
  { id: 'ar-email', re: /بريد إلكتروني|البريد/ },
  { id: 'ar-password', re: /كلمة المرور|كلمة السر/ },
];

const ACCOUNT_INPUTS = new Set([
  'email-address',
  'emailAddress',
  'username',
  'password',
  'email',
  'oneTimeCode',
  'sms-otp',
  'smsOTP',
]);

const mountScreen = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <AuthProvider>
        <OnboardingScreen />
      </AuthProvider>
    </SafeAreaProvider>,
  );

const visibleStrings = (node: unknown): string[] => {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (typeof n === 'string') {
      out.push(n);
      return;
    }
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (n !== null && typeof n === 'object') {
      const element = n as { props?: Record<string, unknown>; children?: unknown };
      const props = element.props ?? {};
      for (const key of ['value', 'placeholder', 'accessibilityLabel', 'title'] as const) {
        const value = props[key];
        if (typeof value === 'string') out.push(value);
      }
      walk(element.children);
    }
  };
  walk(node);
  return out;
};

const accountInputHits = (node: unknown): string[] => {
  const hits: string[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (n === null || typeof n !== 'object') return;
    const element = n as { props?: Record<string, unknown>; children?: unknown };
    const props = element.props ?? {};
    for (const key of ['keyboardType', 'textContentType', 'autoComplete', 'autoCompleteType']) {
      const value = props[key];
      if (typeof value === 'string' && ACCOUNT_INPUTS.has(value)) {
        hits.push(`${key}=${value}`);
      }
    }
    walk(element.children);
  };
  walk(node);
  return hits;
};

const forbiddenHits = (strings: readonly string[]): string[] => {
  const hits: string[] = [];
  for (const text of strings) {
    for (const rule of FORBIDDEN) {
      if (rule.re.test(text)) hits.push(`${rule.id} ← "${text}"`);
    }
  }
  return hits;
};

const sweep = (node: unknown): string[] => [
  ...forbiddenHits(visibleStrings(node)),
  ...accountInputHits(node).map((hit) => `input ${hit}`),
];

describe('Onboarding — O2: no login, account, OTP or email, derived from the rendered flow', () => {
  it('the onboarding directory has at least one surface to sweep — a sweep of nothing is not a sweep', () => {
    const screens = collectOnboardingScreens(ONBOARDING_DIR);
    expect(screens.length).toBeGreaterThan(0);
    expect(screens).toContain('OnboardingScreen.tsx');
  });

  it('language step paints no login, account, OTP or email', () => {
    const { getByTestId, toJSON } = mountScreen();
    expect(getByTestId('onboarding-step-language')).toBeTruthy();
    expect(sweep(toJSON())).toEqual([]);
  });

  it('income step paints no login, account, OTP or email', () => {
    const { getByTestId, toJSON } = mountScreen();
    fireEvent.press(getByTestId('onboarding-continue'));
    expect(getByTestId('onboarding-step-income')).toBeTruthy();
    expect(sweep(toJSON())).toEqual([]);
  });

  it('add-card step paints no login, account, OTP or email', () => {
    const { getByTestId, toJSON } = mountScreen();
    fireEvent.press(getByTestId('onboarding-continue'));
    fireEvent.press(getByTestId('onboarding-skip'));
    expect(getByTestId('onboarding-step-add-card')).toBeTruthy();
    expect(sweep(toJSON())).toEqual([]);
  });

  it('security step paints no login, account, OTP or email', () => {
    const { getByTestId, toJSON } = mountScreen();
    fireEvent.press(getByTestId('onboarding-continue'));
    fireEvent.press(getByTestId('onboarding-skip'));
    fireEvent.press(getByTestId('onboarding-skip'));
    expect(getByTestId('onboarding-step-security')).toBeTruthy();
    expect(sweep(toJSON())).toEqual([]);
  });

  it('no onboarding TextInput asks for email, password or OTP', () => {
    const { getByTestId, toJSON } = mountScreen();
    expect(accountInputHits(toJSON())).toEqual([]);
    fireEvent.press(getByTestId('onboarding-continue'));
    expect(accountInputHits(toJSON())).toEqual([]);
    fireEvent.press(getByTestId('onboarding-skip'));
    expect(accountInputHits(toJSON())).toEqual([]);
    fireEvent.press(getByTestId('onboarding-skip'));
    expect(accountInputHits(toJSON())).toEqual([]);
  });
});
