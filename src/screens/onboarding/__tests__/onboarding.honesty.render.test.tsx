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

import { APP_NAME } from '../../../config/identity';
import { AuthProvider } from '../../../navigation/authContext';
import { useLanguageStore } from '../../../store/useLanguageStore';
import OnboardingScreen from '../OnboardingScreen';

/*
 * THE SENTENCE IS PINNED VERBATIM; THE PRODUCT NAME IS READ FROM THE SAME PLACE THE SCREEN READS IT.
 *
 * This constant used to spell the product name out — "This is how SmartCard knows what's safe." —
 * and MDC-RENAME turned it red, because the screen renders `t('… {{app}} …', { app: APP_NAME })`
 * and `APP_NAME` is `identity.displayName`, which the Owner ruled to TREVIK. The app was right and
 * this expectation was stale.
 *
 * Re-spelling it as "TREVIK" would fix today and break on the next rename, which is the whole
 * defect a second time. So the brand token now comes from `config/identity` — the ONE source T6
 * established — and the words around it stay frozen. What O3 actually guards is unweakened: the
 * sentence is still matched whole, a paraphrase still fails, and the claim "It never leaves your
 * device" is still verbatim. It gains a property it did not have: if the rename ever regresses in
 * the copy layer while identity.json says otherwise, this line fails instead of passing quietly.
 */
const INCOME_SPEC =
  `This is how ${APP_NAME} knows what's safe. It never leaves your device.`;
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
