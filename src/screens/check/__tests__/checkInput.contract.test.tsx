/**
 * C1's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 *   > *"A screen assertion is measured against the rendered surface, not the source. A test that
 *   > greps a component file for a string proves the string is in the file."*
 *
 * So nothing here reads `CheckInputScreen.tsx` as text. The screen is mounted, the field is typed
 * into, the chips and the button are pressed, and every claim is made about what came back —
 * either what is on screen or what the surface handed to its caller when a person acted on it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE CASE NAMES ARE PART OF THE GATE
 *
 * `tools/p4/gates/check-input-contract.mjs` requires each of these by NAME through
 * `requireJestCases`, so a case that is renamed, skipped or deleted fails the gate instead of
 * quietly disappearing from a suite that still reports green. Renaming one means updating the gate,
 * on purpose: the criterion is what is being measured, not the file.
 *
 * WHAT EACH CASE PROVES, against C1's own clauses —
 *   *"Amount greater than zero and currency are required with the shekel as default; category,
 *   plan and card preselect are optional."*
 *
 *   1. shekel already selected …………………… currency required, ₪ default, with no user action
 *   2. refuses with nothing typed ………………… amount required
 *   3. refuses zero, negative, non-numeric … amount must be GREATER THAN zero, and a number
 *   4. proceeds on a positive amount ……………… the contract satisfied is the contract actionable
 *   5. shekel travels with the draft ………………… the default is a real value, not a highlight
 *   6. usable and unusable again ……………………… the refusal is live, not a first-render state
 *   7. every currency the type defines ……… the currency is a genuine choice, ₪ merely the default
 *   8. no figure the screen computed ………………… contract §5 B1 / spec §20, read off the render
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CheckInputScreen, type CheckInputDraft } from '../CheckInputScreen';
import { Currency } from '../../../types/purchase.types';

/**
 * The screen inside the one provider it genuinely cannot mount without, and nothing else.
 *
 * `RtlScreen safe` renders a `SafeAreaView`, which reads insets from context. Supplying them is
 * the same act `tools/p2/jest/renderScreen.tsx` performs for the render harness — giving a
 * component the environment production gives it. No application code is mocked here: a screen
 * whose own logic had to be stubbed out to render would not have been shown to render at all.
 */
const mountScreen = (onCheck?: (draft: CheckInputDraft) => void) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      {onCheck ? <CheckInputScreen onCheck={onCheck} /> : <CheckInputScreen />}
    </SafeAreaProvider>,
  );

/** Everything the tree actually puts in front of a person: text children and field values. */
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
      const value = element.props?.['value'];
      if (typeof value === 'string') {
        out.push(value);
      }
      walk(element.children);
    }
  };
  walk(node);
  return out;
};

describe('Check Input — C1: amount > 0 and a currency, shekel by default, everything else optional', () => {
  it('renders with the shekel already selected, before any user action', () => {
    const { getByTestId } = mountScreen();

    // Read off the rendered control, not off a variable the test also owns: the shekel is the
    // one currency in the selected state on the first frame.
    expect(getByTestId('check-input-currency-ILS').props.accessibilityState.selected).toBe(true);
    for (const other of Object.values(Currency).filter((c) => c !== Currency.ILS)) {
      expect(getByTestId(`check-input-currency-${other}`).props.accessibilityState.selected)
        .toBe(false);
    }
  });

  it('refuses to proceed with no amount typed', () => {
    const onCheck = jest.fn();
    const { getByTestId, queryByTestId } = mountScreen(onCheck);

    fireEvent.press(getByTestId('check-input-submit'));

    // The refusal is behavioural — nothing left the screen — and it is also SAID on the surface.
    expect(onCheck).not.toHaveBeenCalled();
    expect(queryByTestId('check-input-refusal')).not.toBeNull();
  });

  it('refuses zero, a negative amount and text that is not a number', () => {
    const onCheck = jest.fn();
    const { getByTestId } = mountScreen(onCheck);

    // Every shape of "not an amount above zero" C1 has to exclude, each typed for real.
    for (const typed of ['0', '0.00', '-1', '-0.01', 'abc', '   ', '1,5', '']) {
      fireEvent.changeText(getByTestId('check-input-amount'), typed);
      fireEvent.press(getByTestId('check-input-submit'));
      expect(onCheck).not.toHaveBeenCalled();
    }
  });

  it('proceeds on a positive amount with no category, no installments and no card chosen', () => {
    const onCheck = jest.fn();
    const { getByTestId, queryByTestId } = mountScreen(onCheck);

    fireEvent.changeText(getByTestId('check-input-amount'), '250');
    fireEvent.press(getByTestId('check-input-submit'));

    expect(onCheck).toHaveBeenCalledTimes(1);
    const draft = onCheck.mock.calls[0]?.[0] as CheckInputDraft;
    expect(draft.amount).toBe(250);

    // The optional half of C1: nothing was chosen, and the screen still produced a usable input.
    expect(draft.category).toBeNull();
    expect(draft.installments).toBeNull();
    expect(draft.cardId).toBeNull();

    // The refusal is gone once the contract is met — it is a state, not decoration.
    expect(queryByTestId('check-input-refusal')).toBeNull();
  });

  it('sends the shekel as the currency when the user changed nothing', () => {
    const onCheck = jest.fn();
    const { getByTestId } = mountScreen(onCheck);

    fireEvent.changeText(getByTestId('check-input-amount'), '19.9');
    fireEvent.press(getByTestId('check-input-submit'));

    const draft = onCheck.mock.calls[0]?.[0] as CheckInputDraft;
    expect(draft.currency).toBe(Currency.ILS);
    expect(draft.amount).toBe(19.9);
  });

  it('lets the amount become usable and unusable again as the field is edited', () => {
    const onCheck = jest.fn();
    const { getByTestId, queryByTestId } = mountScreen(onCheck);

    fireEvent.changeText(getByTestId('check-input-amount'), '100');
    expect(queryByTestId('check-input-refusal')).toBeNull();

    // Cleared back to nothing: the screen must refuse again rather than remember it once agreed.
    fireEvent.changeText(getByTestId('check-input-amount'), '');
    expect(queryByTestId('check-input-refusal')).not.toBeNull();
    fireEvent.press(getByTestId('check-input-submit'));
    expect(onCheck).not.toHaveBeenCalled();

    fireEvent.changeText(getByTestId('check-input-amount'), '100');
    fireEvent.press(getByTestId('check-input-submit'));
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  it('offers every currency the type defines and switches to the one tapped', () => {
    const onCheck = jest.fn();
    const { getByTestId } = mountScreen(onCheck);

    // The population is DERIVED from the Currency type. A currency added upstream that this screen
    // never renders fails here instead of being silently unreachable.
    for (const currency of Object.values(Currency)) {
      expect(getByTestId(`check-input-currency-${currency}`)).toBeTruthy();
    }

    fireEvent.press(getByTestId(`check-input-currency-${Currency.USD}`));
    expect(getByTestId('check-input-currency-USD').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('check-input-currency-ILS').props.accessibilityState.selected).toBe(false);

    fireEvent.changeText(getByTestId('check-input-amount'), '40');
    fireEvent.press(getByTestId('check-input-submit'));
    expect((onCheck.mock.calls[0]?.[0] as CheckInputDraft).currency).toBe(Currency.USD);
  });

  it('shows no figure the screen computed — only the amount the person typed', () => {
    const { getByTestId, toJSON } = mountScreen();

    fireEvent.changeText(getByTestId('check-input-amount'), '1234.5');

    /**
     * Contract §5 B1 and spec §20: no surface holds recommendation logic. A total, a monthly
     * payment, a threshold or a percentage derived from the typed amount would appear here as a
     * SECOND number on the surface — so the assertion is that there is no second number.
     *
     * This is measured on the rendered tree rather than on the source for the reason rule 9 gives:
     * a source scan for arithmetic proves what the file contains, and a screen can render a
     * derived figure that arrived some other way.
     */
    const KEYPAD_NOISE = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.']);
    const numeric = visibleStrings(toJSON()).filter(
      (s) => /\d/.test(s) && !KEYPAD_NOISE.has(s),
    );
    expect(numeric).toEqual(['1234.5']);
  });
});
