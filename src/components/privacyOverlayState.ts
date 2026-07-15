import type { AppStateStatus } from 'react-native';

export function getNextPrivacyOverlayVisible(
  currentVisible: boolean,
  nextState: AppStateStatus,
  _isUnlocked: boolean,
): boolean {
  if (nextState === 'inactive' || nextState === 'background') {
    return true;
  }

  if (nextState === 'active') {
    return false;
  }

  return currentVisible;
}
