/**
 * C5-style render evidence for M5 — measured on the rendered CardTile.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { Image } from 'react-native';

import { CardTile } from '../CardTile';
import { maskLast4 } from '../../media/maskLast4';

const subject = {
  subjectKind: 'card' as const,
  subjectId: 'card:max:gold',
  fallbackClass: 'card' as const,
};

describe('CardTile — M5 resolver tile plus last4 mask', () => {
  it('paints the resolver surface and the nickname with no last4', () => {
    const { getByTestId, queryByTestId } = render(
      <CardTile nickname="Max Gold" subject={subject} />,
    );
    expect(getByTestId('card-tile-surface')).toBeTruthy();
    expect(getByTestId('card-tile-nickname').props.children).toBe('Max Gold');
    expect(queryByTestId('card-tile-mask')).toBeNull();
  });

  it('the masked group is built from last4 alone', () => {
    const { getByTestId } = render(
      <CardTile last4="5564" nickname="Max Gold" subject={subject} />,
    );
    expect(String(getByTestId('card-tile-mask').props.children)).toContain('5564');
    expect(maskLast4('5564')).toBe('•••• •••• •••• 5564');
  });

  it('omitting last4 is the normal tile, not a degraded one', () => {
    const { queryByTestId } = render(<CardTile nickname="Club" subject={subject} />);
    expect(queryByTestId('card-tile-mask')).toBeNull();
  });

  it('the tile is the resolver surface, not a hard-coded image path', () => {
    const { UNSAFE_queryAllByType, getByTestId } = render(
      <CardTile nickname="Max Gold" subject={subject} />,
    );
    expect(UNSAFE_queryAllByType(Image).length).toBe(0);
    expect(getByTestId('card-tile-surface')).toBeTruthy();
  });
});
