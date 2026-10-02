/**
 * O3's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 * Copy is checked against spec §18-A wording, not a paraphrase. English is
 * forced so the assertion reads the spec's own English rather than a locale
 * accident.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../../../navigation/authContext';
import { useLanguageStore } from '../../../store/useLanguageStore';
import OnboardingScreen from '../OnboardingScreen';

const INCOME_SPEC =
  "This is how SmartCard knows what's safe. It never leaves your device.";
const SCOPED_CLAIM = 'Your financial data lives only on this device.';
const RETIRED_CLAIM = 'All data lives on this device.';

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

const textOf = (node: { props: { children?: unknown } }): string =>
  String(node.props.children ?? '');

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
      const element = n as { children?: unknown };
      walk(element.children);
    }
  };
  walk(node);
  return out;
};

describe('Onboarding — O3: copy checked against spec §18-A, not a paraphrase', () => {
  beforeEach(() => {
    useLanguageStore.getState().setLanguageChoice('en');
  });

  it('every step states why the data is asked and where it stays', () => {
    const { getByTestId } = mountScreen();

    expect(textOf(getByTestId('onboarding-why')).length).toBeGreaterThan(0);
    expect(textOf(getByTestId('onboarding-where')).length).toBeGreaterThan(0);

    fireEvent.press(getByTestId('onboarding-continue'));
    expect(textOf(getByTestId('onboarding-why')).length).toBeGreaterThan(0);
    expect(textOf(getByTestId('onboarding-where')).length).toBeGreaterThan(0);

    fireEvent.press(getByTestId('onboarding-skip'));
    expect(textOf(getByTestId('onboarding-why')).length).toBeGreaterThan(0);
    expect(textOf(getByTestId('onboarding-where')).length).toBeGreaterThan(0);

    fireEvent.press(getByTestId('onboarding-skip'));
    expect(textOf(getByTestId('onboarding-why')).length).toBeGreaterThan(0);
    expect(textOf(getByTestId('onboarding-where')).length).toBeGreaterThan(0);
  });

  it('income paints the spec §6 line verbatim — not a paraphrase', () => {
    const { getByTestId } = mountScreen();
    fireEvent.press(getByTestId('onboarding-continue'));
    expect(textOf(getByTestId('onboarding-where'))).toBe(INCOME_SPEC);
  });

  it('add-card and security paint the scoped §18-A claim verbatim', () => {
    const { getByTestId } = mountScreen();
    fireEvent.press(getByTestId('onboarding-continue'));
    fireEvent.press(getByTestId('onboarding-skip'));
    expect(textOf(getByTestId('onboarding-where'))).toBe(SCOPED_CLAIM);
    fireEvent.press(getByTestId('onboarding-skip'));
    expect(textOf(getByTestId('onboarding-where'))).toBe(SCOPED_CLAIM);
  });

  it('the retired OD-11 sentence All data lives on this device is absent from every step', () => {
    const { getByTestId, toJSON } = mountScreen();
    const frames: string[][] = [visibleStrings(toJSON())];
    fireEvent.press(getByTestId('onboarding-continue'));
    frames.push(visibleStrings(toJSON()));
    fireEvent.press(getByTestId('onboarding-skip'));
    frames.push(visibleStrings(toJSON()));
    fireEvent.press(getByTestId('onboarding-skip'));
    frames.push(visibleStrings(toJSON()));

    for (const strings of frames) {
      expect(strings).not.toContain(RETIRED_CLAIM);
      expect(strings.some((s) => /all data lives on this device/i.test(s))).toBe(
        false,
      );
    }
  });
});
