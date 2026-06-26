import React, { useEffect, useState } from 'react';
import {
  AppState,
  Image,
  StyleSheet,
  View,
  type AppStateStatus,
  type ImageSourcePropType,
} from 'react-native';

import { useAuth } from '../navigation/authContext';
import { getNextPrivacyOverlayVisible } from './privacyOverlayState';

const SPLASH_IMAGE: ImageSourcePropType = require('../../android/app/src/main/res/drawable-xxxhdpi/splashscreen_logo.png');

export function PrivacyOverlay(): React.ReactElement | null {
  const { isUnlocked } = useAuth();
  const [isHidden, setIsHidden] = useState(false);

  useEffect((): (() => void) => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus): void => {
        if (nextState === 'inactive' || nextState === 'background') {
          setIsHidden((currentVisible: boolean): boolean =>
            getNextPrivacyOverlayVisible(currentVisible, nextState, isUnlocked),
          );
          return;
        }

        setIsHidden((currentVisible: boolean): boolean =>
          getNextPrivacyOverlayVisible(currentVisible, nextState, isUnlocked),
        );
      },
    );

    return (): void => subscription.remove();
  }, [isUnlocked]);

  useEffect((): void => {
    if (isUnlocked) {
      setIsHidden(false);
    }
  }, [isUnlocked]);

  if (!isHidden) {
    return null;
  }

  return (
    <View pointerEvents="auto" style={styles.overlay}>
      <Image source={SPLASH_IMAGE} style={styles.image} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0A0A0A',
    zIndex: 9999,
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
