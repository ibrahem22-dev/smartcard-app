/**
 * R4's evidence, MEASURED ON THE RENDERED SURFACE — contract §2 rule 9.
 *
 * FX Compare renders identically from Check Verdict and from Card DNA.
 * Compared as rendered trees, not by eye.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { compareAbroad } from '../../../engines/fx';
import { FxCompareFromCardDna } from '../FxCompareFromCardDna';
import { FxCompareFromCheckVerdict } from '../FxCompareFromCheckVerdict';

const comparison = compareAbroad({
  amount: 1_000,
  currency: 'EUR',
  mode: 'purchase',
  rate: {
    currency: 'EUR',
    quoteUnit: 1,
    rateIlsPerQuoteUnit: 4.02,
    rateDate: '2026-08-24',
    fetchDate: '2026-08-24',
    source: 'BUNDLED',
    provenance: 'ESTIMATE',
    rateBasis: 'BOI_REPRESENTATIVE',
  },
  cards: [
    { cardId: 'cheapest', fxPercent: 2 },
    { cardId: 'mid', fxPercent: 3 },
  ],
});

const wrap = (node: React.ReactElement) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      {node}
    </SafeAreaProvider>,
  );

describe('FX Compare — R4: identical render from both entry points', () => {
  it('Check Verdict and Card DNA entries produce the same rendered tree', () => {
    const fromVerdict = wrap(<FxCompareFromCheckVerdict comparison={comparison} />);
    const fromDna = wrap(<FxCompareFromCardDna comparison={comparison} />);
    expect(JSON.stringify(fromVerdict.toJSON())).toEqual(JSON.stringify(fromDna.toJSON()));
  });

  it('the identity holds for an empty mount as well as a populated comparison', () => {
    const fromVerdict = wrap(<FxCompareFromCheckVerdict />);
    const fromDna = wrap(<FxCompareFromCardDna />);
    expect(JSON.stringify(fromVerdict.toJSON())).toEqual(JSON.stringify(fromDna.toJSON()));
  });
});
