/**
 * THE SETTINGS / MORE SPLIT, RENDERED.
 *
 * More is a feature hub; Settings is a preferences screen; the promo-code control that had no
 * provider is gone. The last of those is asserted as an ABSENCE, because a dead control that
 * refuses every time is the thing V9's completion matrix left open.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../../navigation/authContext';
import { keyVault } from '../../security/keyVault';
import { MMKV_KEYS } from '../../store/keys';

import { MoreScreen } from '../MoreScreen';
import { SettingsScreen } from '../SettingsScreen';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useUserStore } from '../../store/useUserStore';
import type { UserProfile } from '../../types/user.types';

/**
 * THE PROVIDERS THESE SCREENS HAVE IN PRODUCTION, and nothing else.
 *
 * `ProfileSwitcher` calls `useAuth()`, which throws outside `AuthProvider` BY DESIGN — that throw
 * is the provider doing its job. Supplying the real context is the opposite of mocking the screen:
 * it is what makes the screen's own code run at all. The navigation prop stays a stub because
 * these cases are about WHICH route a control asks for, which a real navigator would swallow.
 */
const wrap = (node: React.ReactElement): React.ReactElement => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}
  >
    <AuthProvider>
      <NavigationContainer>{node}</NavigationContainer>
    </AuthProvider>
  </SafeAreaProvider>
);

const PROFILE: UserProfile = {
  id: 'p1',
  monthlyIncome: 14_000,
  createdAt: 1,
  updatedAt: 1,
};

/* React Navigation's props, narrowed to what these two screens use. */
const navigationStub = (record: string[]) =>
  ({ navigate: (route: string): void => { record.push(route); } }) as never;

describe('settings and more', () => {
  beforeEach(() => {
    /* The store writes the profile back to the encrypted vault and REFUSES without an active
       profile id — the same refusal every other setter makes. The render harness unlocks a real
       keyVault, so the id is seeded here rather than the refusal being mocked away. */
    keyVault.getEncryptedStorage().set(MMKV_KEYS.activeProfileId, PROFILE.id);
    act(() => {
      useLanguageStore.getState().setLanguageChoice('he');
      useUserStore.setState({ profile: PROFILE });
    });
  });

  it('More lists the product’s tools and reaches Settings', () => {
    const routes: string[] = [];
    const tree = render(wrap(<MoreScreen navigation={navigationStub(routes)} route={{} as never} />));
    for (const id of [
      'more-entry-settings',
      'more-entry-learn',
      'more-entry-glossary',
      'more-entry-installments',
      'more-entry-contact',
    ]) {
      expect(tree.getByTestId(id)).toBeTruthy();
    }
    fireEvent.press(tree.getByTestId('more-entry-settings'));
    expect(routes).toEqual(['Settings']);
  });

  it('Settings groups account, language, preferences and data', () => {
    const tree = render(
      wrap(<SettingsScreen navigation={navigationStub([])} route={{} as never} />),
    );
    expect(tree.getByTestId('settings-screen')).toBeTruthy();
    expect(tree.getByTestId('settings-language')).toBeTruthy();
    expect(tree.getByTestId('settings-budget-input')).toBeTruthy();
    expect(tree.getByTestId('data-privacy-entry')).toBeTruthy();
    expect(tree.getByTestId('vault-export-import-entry')).toBeTruthy();
    expect(tree.getByTestId('crash-log-entry')).toBeTruthy();
  });

  it('carries no promo-code or subscription control', () => {
    const tree = render(
      wrap(<SettingsScreen navigation={navigationStub([])} route={{} as never} />),
    );
    const painted = JSON.stringify(tree.toJSON());
    expect(painted).not.toMatch(/קוד קידום|promo|subscription|מנוי/i);
  });

  it('saves a budget target and clears it on an empty field', () => {
    const tree = render(
      wrap(<SettingsScreen navigation={navigationStub([])} route={{} as never} />),
    );
    fireEvent.changeText(tree.getByTestId('settings-budget-input'), '9000');
    fireEvent.press(tree.getByTestId('settings-budget-save'));
    expect(useUserStore.getState().profile?.monthlyBudgetTargetIls).toBe(9_000);

    fireEvent.changeText(tree.getByTestId('settings-budget-input'), '');
    fireEvent.press(tree.getByTestId('settings-budget-save'));
    expect(useUserStore.getState().profile?.monthlyBudgetTargetIls).toBeUndefined();
  });

  it('refuses a budget that is not a positive amount, and says so', () => {
    const tree = render(
      wrap(<SettingsScreen navigation={navigationStub([])} route={{} as never} />),
    );
    fireEvent.changeText(tree.getByTestId('settings-budget-input'), 'לא מספר');
    fireEvent.press(tree.getByTestId('settings-budget-save'));
    expect(tree.getByTestId('settings-budget-error')).toBeTruthy();
    expect(useUserStore.getState().profile?.monthlyBudgetTargetIls).toBeUndefined();
  });

  it('says a target cannot be saved when no profile is loaded', () => {
    act(() => { useUserStore.setState({ profile: null }); });
    const tree = render(
      wrap(<SettingsScreen navigation={navigationStub([])} route={{} as never} />),
    );
    expect(tree.getByTestId('settings-budget-no-profile')).toBeTruthy();
    expect(tree.queryByTestId('settings-budget-input')).toBeNull();
  });

  it('switches language and the screen follows without a reinstall', () => {
    const tree = render(
      wrap(<SettingsScreen navigation={navigationStub([])} route={{} as never} />),
    );
    fireEvent.press(tree.getByTestId('settings-language-en'));
    expect(useLanguageStore.getState().resolvedLanguage).toBe('en');
    const en = render(
      wrap(<SettingsScreen navigation={navigationStub([])} route={{} as never} />),
    );
    expect(String(en.getByTestId('settings-budget-input').props.accessibilityLabel))
      .toBe('Monthly spending target');

    fireEvent.press(en.getByTestId('settings-language-ar'));
    expect(useLanguageStore.getState().resolvedLanguage).toBe('ar');
    const ar = render(
      wrap(<SettingsScreen navigation={navigationStub([])} route={{} as never} />),
    );
    expect(String(ar.getByTestId('settings-budget-input').props.accessibilityLabel))
      .toBe('هدف الإنفاق الشهري');
  });

  it('marks the chosen language as checked for a screen reader', () => {
    act(() => { useLanguageStore.getState().setLanguageChoice('he'); });
    const tree = render(
      wrap(<SettingsScreen navigation={navigationStub([])} route={{} as never} />),
    );
    expect(tree.getByTestId('settings-language-he').props.accessibilityState.checked).toBe(true);
    expect(tree.getByTestId('settings-language-en').props.accessibilityState.checked).toBe(false);
  });
});
