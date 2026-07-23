import * as ScreenCapture from 'expo-screen-capture';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Image,
  StyleSheet,
  View,
  type AppStateStatus,
  type ImageSourcePropType,
} from 'react-native';

import { useAuth } from '../navigation/authContext';
import {
  getNextPrivacyOverlayVisible,
  shouldPreventScreenCapture,
} from './privacyOverlayState';

const SPLASH_IMAGE: ImageSourcePropType = require('../../android/app/src/main/res/drawable-xxxhdpi/splashscreen_logo.png');
const SCREEN_CAPTURE_KEY = 'privacy-overlay';

export function PrivacyOverlay(): React.ReactElement | null {
  const { isUnlocked } = useAuth();
  const [isHidden, setIsHidden] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const desiredScreenCaptureProtectionRef = useRef(true);
  const screenCaptureOperationRef = useRef<Promise<void>>(Promise.resolve());

  const updateScreenCaptureProtection = useCallback(
    (shouldPrevent: boolean): void => {
      desiredScreenCaptureProtectionRef.current = shouldPrevent;
      screenCaptureOperationRef.current = screenCaptureOperationRef.current
        .catch((): void => undefined)
        .then(async (): Promise<void> => {
          if (desiredScreenCaptureProtectionRef.current) {
            await ScreenCapture.preventScreenCaptureAsync(SCREEN_CAPTURE_KEY);
            return;
          }

          await ScreenCapture.allowScreenCaptureAsync(SCREEN_CAPTURE_KEY);
        })
        .catch((): void => undefined);
    },
    [],
  );

  useEffect((): (() => void) => {
    const changeSubscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus): void => {
        appStateRef.current = nextState;
        updateScreenCaptureProtection(
          shouldPreventScreenCapture(nextState, isUnlocked),
        );

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

    const blurSubscription = AppState.addEventListener('blur', (): void => {
      updateScreenCaptureProtection(true);
    });

    const focusSubscription = AppState.addEventListener('focus', (): void => {
      appStateRef.current = AppState.currentState;
      updateScreenCaptureProtection(
        shouldPreventScreenCapture(appStateRef.current, isUnlocked),
      );
    });

    return (): void => {
      changeSubscription.remove();
      blurSubscription.remove();
      focusSubscription.remove();
    };
  }, [isUnlocked, updateScreenCaptureProtection]);

  useEffect((): void => {
    if (isUnlocked) {
      setIsHidden(false);
    }

    updateScreenCaptureProtection(
      shouldPreventScreenCapture(appStateRef.current, isUnlocked),
    );
  }, [isUnlocked, updateScreenCaptureProtection]);

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
