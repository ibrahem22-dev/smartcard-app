import type { AppStateStatus } from 'react-native';

export function getNextPrivacyOverlayVisible(
  currentVisible: boolean,
  nextState: AppStateStatus,
  isUnlocked: boolean,
): boolean {
  if (nextState === 'inactive' || nextState === 'background') {
    return true;
  }

  if (nextState === 'active' && isUnlocked) {
    return false;
  }

  return currentVisible;
}
