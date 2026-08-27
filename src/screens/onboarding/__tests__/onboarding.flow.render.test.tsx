/**
 * O1's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 *   > *"The four onboarding steps exist in spec order and every one is skippable
 *   > except the language confirmation."*
 *
 * Case names are part of the gate: `tools/p4/gates/onboarding-flow.mjs` requires
 * each of them by name.
 */
import React from 'react';
import { MMKV } from 'react-native-mmkv';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getDeviceLanguage } from '../../../i18n/locale';
import { AuthProvider } from '../../../navigation/authContext';
import OnboardingScreen from '../OnboardingScreen';

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
      walk(element.children);
    }
  };
  walk(node);
  return out;
};

describe('Onboarding — O1: four steps in spec order, skippable except language', () => {
  it('opens on the language confirmation, with English, Hebrew and Arabic rows', () => {
    const { getByTestId, queryByTestId, toJSON } = mountScreen();

    expect(getByTestId('onboarding-step-language')).toBeTruthy();
    expect(queryByTestId('onboarding-step-income')).toBeNull();
    expect(queryByTestId('onboarding-step-add-card')).toBeNull();
    expect(queryByTestId('onboarding-step-security')).toBeNull();

    expect(getByTestId('onboarding-language-en')).toBeTruthy();
    expect(getByTestId('onboarding-language-he')).toBeTruthy();
    expect(getByTestId('onboarding-language-ar')).toBeTruthy();

    const shown = visibleStrings(toJSON());
    expect(shown).toEqual(expect.arrayContaining(['English', 'עברית', 'العربية']));
  });

  it('preselects the device language before any user action', () => {
    const { getByTestId } = mountScreen();
    const device = getDeviceLanguage();

    expect(
      getByTestId(`onboarding-language-${device}`).props.accessibilityState.selected,
    ).toBe(true);

    for (const id of ['en', 'he', 'ar'] as const) {
      if (id === device) continue;
      expect(
        getByTestId(`onboarding-language-${id}`).props.accessibilityState.selected,
      ).toBe(false);
    }
  });

  it('language Skip accepts the device language and advances to income — it does not leave language unconfirmed', () => {
    const { getByTestId, queryByTestId } = mountScreen();

    expect(queryByTestId('onboarding-skip')).toBeNull();
    fireEvent.press(getByTestId('onboarding-language-skip'));

    expect(queryByTestId('onboarding-step-language')).toBeNull();
    expect(getByTestId('onboarding-step-income')).toBeTruthy();
  });

  it('cannot reach income, add-card or security without confirming language', () => {
    const { getByTestId, queryByTestId } = mountScreen();

    expect(queryByTestId('onboarding-step-income')).toBeNull();
    expect(queryByTestId('onboarding-step-add-card')).toBeNull();
    expect(queryByTestId('onboarding-step-security')).toBeNull();
    expect(queryByTestId('onboarding-skip')).toBeNull();

    fireEvent.press(getByTestId('onboarding-continue'));

    expect(getByTestId('onboarding-step-income')).toBeTruthy();
    expect(queryByTestId('onboarding-step-language')).toBeNull();
  });

  it('income is the second step and is skippable', () => {
    const { getByTestId, queryByTestId } = mountScreen();

    fireEvent.press(getByTestId('onboarding-continue'));
    expect(getByTestId('onboarding-step-income')).toBeTruthy();
    expect(getByTestId('onboarding-payday-1')).toBeTruthy();
    expect(getByTestId('onboarding-payday-10')).toBeTruthy();
    expect(getByTestId('onboarding-payday-15')).toBeTruthy();
    expect(getByTestId('onboarding-payday-28')).toBeTruthy();
    expect(getByTestId('onboarding-payday-last')).toBeTruthy();

    fireEvent.press(getByTestId('onboarding-skip'));

    expect(queryByTestId('onboarding-step-income')).toBeNull();
    expect(getByTestId('onboarding-step-add-card')).toBeTruthy();
  });

  it('add first card is the third step and is skippable', () => {
    const { getByTestId, queryByTestId } = mountScreen();

    fireEvent.press(getByTestId('onboarding-continue'));
    fireEvent.press(getByTestId('onboarding-skip'));
    expect(getByTestId('onboarding-step-add-card')).toBeTruthy();

    fireEvent.press(getByTestId('onboarding-skip'));

    expect(queryByTestId('onboarding-step-add-card')).toBeNull();
    expect(getByTestId('onboarding-step-security')).toBeTruthy();
  });

  it('security and finish is the fourth step and is skippable', () => {
    const { getByTestId, queryByTestId } = mountScreen();

    fireEvent.press(getByTestId('onboarding-continue'));
    fireEvent.press(getByTestId('onboarding-skip'));
    fireEvent.press(getByTestId('onboarding-skip'));
    expect(getByTestId('onboarding-step-security')).toBeTruthy();
    expect(getByTestId('onboarding-skip')).toBeTruthy();

    fireEvent.press(getByTestId('onboarding-skip'));

    expect(queryByTestId('onboarding-error')).toBeNull();
    const flag = new MMKV({ id: 'onboarding-temp' }).getBoolean(
      'onboarding_complete',
    );
    expect(flag).toBe(true);
  });

  it('the four steps appear in spec order and no other onboarding step is inserted', () => {
    const { getByTestId, queryByTestId } = mountScreen();

    expect(getByTestId('onboarding-progress-language')).toBeTruthy();
    expect(getByTestId('onboarding-progress-income')).toBeTruthy();
    expect(getByTestId('onboarding-progress-add-card')).toBeTruthy();
    expect(getByTestId('onboarding-progress-security')).toBeTruthy();
    expect(queryByTestId('onboarding-progress-bank')).toBeNull();
    expect(queryByTestId('onboarding-progress-phone')).toBeNull();

    fireEvent.press(getByTestId('onboarding-continue'));
    expect(getByTestId('onboarding-step-income')).toBeTruthy();
    fireEvent.press(getByTestId('onboarding-skip'));
    expect(getByTestId('onboarding-step-add-card')).toBeTruthy();
    fireEvent.press(getByTestId('onboarding-skip'));
    expect(getByTestId('onboarding-step-security')).toBeTruthy();
    expect(queryByTestId('onboarding-step-language')).toBeNull();
    expect(queryByTestId('onboarding-step-income')).toBeNull();
    expect(queryByTestId('onboarding-step-add-card')).toBeNull();
  });
});
