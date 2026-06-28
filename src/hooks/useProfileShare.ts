import { useCallback, useState } from 'react';
import { Camera } from 'expo-camera';

import {
  createSecureProfileId,
  decryptProfileTransferPayload,
  encryptProfileTransferPayload,
} from '../security/keyVault';
import { useCardsStore } from '../store/useCardsStore';
import { useProfileStore } from '../store/useProfileStore';
import type { AppProfile, ProfileLanguagePreference } from '../types/profile.types';
import type {
  ProfileShareMode,
  TransferProfile,
  UseProfileShareResult,
} from '../types/profileShare.types';
import {
  buildImportedCards,
  parseTransferProfile,
  serializeTransferProfile,
} from '../utils/profileShareCodec';

export function useProfileShare(): UseProfileShareResult {
  const activeProfile = useProfileStore(state => state.activeProfile);
  const addProfile = useProfileStore(state => state.addProfile);
  const cards = useCardsStore(state => state.cards);
  const importProfileCards = useCardsStore(
    state => state.importProfileCards,
  );
  const [mode, setModeState] = useState<ProfileShareMode>('export');
  const [transferPin, setTransferPinState] = useState('');
  const [encodedPayload, setEncodedPayload] = useState<string | null>(null);
  const [scannedPayload, setScannedPayload] = useState<string | null>(null);
  const [preview, setPreview] = useState<TransferProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);

  const clearEphemeralState = useCallback((): void => {
    setTransferPinState('');
    setEncodedPayload(null);
    setScannedPayload(null);
    setPreview(null);
    setError(null);
    setCameraPermissionGranted(false);
  }, []);

  function setMode(nextMode: ProfileShareMode): void {
    clearEphemeralState();
    setModeState(nextMode);
  }

  function setTransferPin(value: string): void {
    setTransferPinState(value.replace(/\D/g, '').slice(0, 4));
    setEncodedPayload(null);
    setPreview(null);
    setError(null);
  }

  async function generateExport(): Promise<void> {
    if (activeProfile === null || !/^\d{4}$/.test(transferPin)) {
      setError('INVALID_EXPORT_INPUT');
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      const payload = serializeTransferProfile(activeProfile, cards);
      const encoded = await encryptProfileTransferPayload(
        JSON.stringify(payload),
        transferPin,
      );
      setEncodedPayload(encoded);
    } catch {
      setError('EXPORT_FAILED');
    } finally {
      setIsBusy(false);
    }
  }

  async function requestCamera(): Promise<void> {
    try {
      const permission = await Camera.requestCameraPermissionsAsync();
      setCameraPermissionGranted(permission.granted);
      if (!permission.granted) {
        setError('CAMERA_PERMISSION_DENIED');
      }
    } catch {
      setCameraPermissionGranted(false);
      setError('CAMERA_PERMISSION_DENIED');
    }
  }

  function acceptScannedPayload(payload: string): void {
    setScannedPayload(payload);
    setPreview(null);
    setCameraPermissionGranted(false);
    setError(null);
  }

  async function decryptImport(): Promise<void> {
    if (scannedPayload === null || !/^\d{4}$/.test(transferPin)) {
      setError('INVALID_IMPORT_INPUT');
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      const plaintext = await decryptProfileTransferPayload(
        scannedPayload,
        transferPin,
      );
      const parsedJson: unknown = JSON.parse(plaintext);
      const parsedProfile = parseTransferProfile(parsedJson);
      if (parsedProfile === null) {
        setError('INVALID_PROFILE_PAYLOAD');
        return;
      }
      setPreview(parsedProfile);
    } catch {
      setPreview(null);
      setError('DECRYPT_FAILED');
    } finally {
      setIsBusy(false);
    }
  }

  async function importProfile(
    languagePreference: ProfileLanguagePreference,
  ): Promise<void> {
    if (preview === null) {
      setError('PREVIEW_REQUIRED');
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      const profileId = createSecureProfileId();
      const importedCards = buildImportedCards(profileId, preview.cards);
      const profile: AppProfile = {
        id: profileId,
        displayName: preview.displayName,
        bankName: preview.bankName,
        languagePreference,
        cardIds: importedCards.map(card => card.cardId),
      };
      addProfile(profile);
      importProfileCards(profileId, importedCards);
      clearEphemeralState();
    } catch {
      setError('IMPORT_FAILED');
      throw new Error('IMPORT_FAILED');
    } finally {
      setIsBusy(false);
    }
  }

  return {
    activeProfile,
    mode,
    setMode,
    transferPin,
    setTransferPin,
    encodedPayload,
    scannedPayload,
    preview,
    error,
    isBusy,
    cameraPermissionGranted,
    generateExport,
    requestCamera,
    acceptScannedPayload,
    decryptImport,
    importProfile,
    clearEphemeralState,
  };
}
