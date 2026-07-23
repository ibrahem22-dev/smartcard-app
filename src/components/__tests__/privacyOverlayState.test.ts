import {
  getNextPrivacyOverlayVisible,
  shouldPreventScreenCapture,
} from '../privacyOverlayState';

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

  test('active app state hides the overlay so the lock screen remains usable', (): void => {
    expect(getNextPrivacyOverlayVisible(true, 'active', false)).toBe(false);
  });

  test('screen capture is prevented while the app is inactive', (): void => {
    expect(shouldPreventScreenCapture('inactive', true)).toBe(true);
  });

  test('screen capture is prevented while the app is backgrounded', (): void => {
    expect(shouldPreventScreenCapture('background', true)).toBe(true);
  });

  test('screen capture is prevented while the session is locked', (): void => {
    expect(shouldPreventScreenCapture('active', false)).toBe(true);
  });

  test('screen capture is allowed only for an active unlocked session', (): void => {
    expect(shouldPreventScreenCapture('active', true)).toBe(false);
  });
});
