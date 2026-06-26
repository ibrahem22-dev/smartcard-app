import { getNextPrivacyOverlayVisible } from '../privacyOverlayState';

describe('privacy overlay state', (): void => {
  test('inactive app state shows the privacy overlay', (): void => {
    expect(getNextPrivacyOverlayVisible(false, 'inactive', true)).toBe(true);
  });

  test('background app state shows the privacy overlay', (): void => {
    expect(getNextPrivacyOverlayVisible(false, 'background', true)).toBe(true);
  });

  test('active app state hides the overlay when session is unlocked', (): void => {
    expect(getNextPrivacyOverlayVisible(true, 'active', true)).toBe(false);
  });

  test('active app state keeps the overlay when session is locked', (): void => {
    expect(getNextPrivacyOverlayVisible(true, 'active', false)).toBe(true);
  });
});
