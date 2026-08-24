import React from 'react';
import { render } from '@testing-library/react-native';

import { AppText } from '../AppText';
import { CrossSetReference } from '../CrossSetReference';
import type { ReferenceResolution } from '../../data/adapter/crossSet';

/**
 * CRITERION C4's RENDER HALF — *"renders as **absent, never as an error**"*.
 *
 * The resolver is proven against the real packs in `crossSetSkew.test.ts`. This is the other half:
 * that a miss puts NOTHING on the screen. A placeholder, a dash, a "not available" chip or a
 * skeleton that never resolves are all error messages in a costume, and a device holding Tuesday's
 * catalog beside Friday's benefits is working correctly.
 */

const resolution = <T,>(over: Partial<ReferenceResolution<T>>): ReferenceResolution<T> => ({
  state: 'PRESENT',
  id: 'card:test',
  ownedBy: 'catalog',
  heldVersion: '2026.08.22+3',
  ...over,
});

describe('C4 — an absent cross-set reference renders as nothing', () => {
  it('renders the referent when it is present — the control', () => {
    const { getByTestId } = render(
      <CrossSetReference
        resolution={resolution({ state: 'PRESENT', value: 'Amex Platinum' })}
        render={(name) => <AppText testID="referent">{name}</AppText>}
      />,
    );
    expect(getByTestId('referent')).toBeTruthy();
  });

  it('renders NOTHING when the referent is absent in this version', () => {
    const { toJSON, queryByTestId } = render(
      <CrossSetReference
        resolution={resolution<string>({ state: 'ABSENT_IN_THIS_VERSION' })}
        render={(name) => <AppText testID="referent">{name}</AppText>}
      />,
    );
    expect(toJSON()).toBeNull();
    expect(queryByTestId('referent')).toBeNull();
  });

  it('renders NOTHING when the reference is malformed', () => {
    const seen: string[] = [];
    const { toJSON } = render(
      <CrossSetReference
        resolution={resolution<string>({ state: 'UNRESOLVABLE_REFERENCE', id: '' })}
        render={(name) => <AppText testID="referent">{name}</AppText>}
        onUnresolvable={(id) => seen.push(id)}
      />,
    );
    // Nothing on screen, and the diagnostic still fires — a user cannot act on a corrupt pack, and
    // showing them a corruption notice would be worse than showing them a shorter row.
    expect(toJSON()).toBeNull();
    expect(seen).toEqual(['']);
  });

  it('never renders the value when the state is not PRESENT', () => {
    // A resolution carrying a value it should not have is a defect somewhere upstream. The
    // component must not become the place that leaks it.
    const { toJSON } = render(
      <CrossSetReference
        resolution={resolution({ state: 'ABSENT_IN_THIS_VERSION', value: 'leaked' })}
        render={(name) => <AppText testID="referent">{name}</AppText>}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders a caller-supplied fallback when one is given', () => {
    const { getByTestId } = render(
      <CrossSetReference
        resolution={resolution<string>({ state: 'ABSENT_IN_THIS_VERSION' })}
        render={(name) => <AppText testID="referent">{name}</AppText>}
        whenAbsent={<AppText testID="quiet-fallback">—</AppText>}
      />,
    );
    expect(getByTestId('quiet-fallback')).toBeTruthy();
  });
});
