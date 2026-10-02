/**
 * O4's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 * The Finish setup card on Home carries every onboarding step the user skipped,
 * survives remount, and can be dismissed without inventing a fifth onboarding step.
 */
import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { renderScreen } from '../../../tools/p2/jest/renderScreen';
import { useFinishSetupStore } from '../../store/useFinishSetupStore';
import { HomeScreen } from '../HomeScreen';

describe('Home — O4: persistent dismissible Finish setup for skipped steps', () => {
  beforeEach(() => {
    useFinishSetupStore.getState().recordSkipped([]);
  });

  it('Home does not show Finish setup when nothing was skipped', () => {
    const { queryByTestId } = renderScreen(HomeScreen);
    expect(queryByTestId('home-finish-setup')).toBeNull();
  });

  it('the checklist carries every skipped step and never language confirmation', () => {
    useFinishSetupStore.getState().recordSkipped(['income', 'add-card', 'security']);
    const { getByTestId, queryByTestId } = renderScreen(HomeScreen);

    expect(getByTestId('home-finish-setup')).toBeTruthy();
    expect(getByTestId('home-finish-setup-item-income')).toBeTruthy();
    expect(getByTestId('home-finish-setup-item-add-card')).toBeTruthy();
    expect(getByTestId('home-finish-setup-item-security')).toBeTruthy();
    expect(queryByTestId('home-finish-setup-item-language')).toBeNull();
  });

  it('the checklist lists only the steps that were actually skipped', () => {
    useFinishSetupStore.getState().recordSkipped(['income']);
    const { getByTestId, queryByTestId } = renderScreen(HomeScreen);

    expect(getByTestId('home-finish-setup-item-income')).toBeTruthy();
    expect(queryByTestId('home-finish-setup-item-add-card')).toBeNull();
    expect(queryByTestId('home-finish-setup-item-security')).toBeNull();
  });

  it('dismiss hides the checklist and the hide survives remount', () => {
    useFinishSetupStore.getState().recordSkipped(['income', 'add-card']);
    const first = renderScreen(HomeScreen);
    fireEvent.press(first.getByTestId('home-finish-setup-dismiss'));
    expect(first.queryByTestId('home-finish-setup')).toBeNull();
    first.unmount();

    useFinishSetupStore.getState().hydrate();
    const second = renderScreen(HomeScreen);
    expect(second.queryByTestId('home-finish-setup')).toBeNull();
    second.unmount();
  });
});
