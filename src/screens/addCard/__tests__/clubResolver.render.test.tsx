/**
 * W3 rendered — three questions identify a club or end honestly without one.
 */
import React, { useState } from 'react';
import { fireEvent } from '@testing-library/react-native';

import { AppText } from '../../../components/AppText';
import { currentCatalogClubs, type ClubResolution } from '../../../data/adapter/clubResolver';
import { renderScreen } from '../../../../tools/p2/jest/renderScreen';
import { ClubResolver } from '../ClubResolver';

function OutcomeHost(): React.ReactElement {
  const [resolution, setResolution] = useState<ClubResolution | null>(null);
  return (
    <>
      <ClubResolver onResolved={setResolution} />
      {resolution !== null ? (
        <AppText testID={`club-resolver-outcome-${resolution.outcome}`}>{resolution.outcome}</AppText>
      ) : null}
    </>
  );
}

describe("Club resolver — W3 three questions on the rendered surface", () => {
  it('opens on question 1 over derived institutions', () => {
    const { getByTestId, queryByTestId } = renderScreen(OutcomeHost);
    expect(getByTestId('club-resolver')).toBeTruthy();
    expect(getByTestId('club-resolver-q1')).toBeTruthy();
    expect(queryByTestId('club-resolver-q2')).toBeNull();
    expect(queryByTestId('club-resolver-q3')).toBeNull();
  });

  it('three unsure/none answers end honestly without a club', () => {
    const { getByTestId } = renderScreen(OutcomeHost);
    fireEvent.press(getByTestId('club-resolver-q1-unsure'));
    fireEvent.press(getByTestId('club-resolver-q2-unsure'));
    fireEvent.press(getByTestId('club-resolver-none'));
    expect(getByTestId('club-resolver-outcome-unknown')).toBeTruthy();
  });

  it('picking a remaining club after three questions identifies it', () => {
    const club = currentCatalogClubs()[0];
    if (club === undefined) throw new Error('no CURRENT clubs');
    const { getByTestId } = renderScreen(OutcomeHost);
    fireEvent.press(getByTestId(`club-resolver-org-${club.orgId}`));
    fireEvent.changeText(getByTestId('club-resolver-q2-input'), club.displayName);
    fireEvent.press(getByTestId('club-resolver-q2-next'));
    fireEvent.press(getByTestId(`club-resolver-pick-${club.nodeId}`));
    expect(getByTestId('club-resolver-outcome-identified')).toBeTruthy();
  });
});
