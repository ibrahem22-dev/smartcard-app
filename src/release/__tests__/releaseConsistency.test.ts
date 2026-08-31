import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(__dirname, '..', '..', '..');
const sourceRoot = join(root, 'src');

function text(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return name === '__tests__' ? [] : sourceFiles(path);
    }
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('release-build source consistency', () => {
  it('gates the EngineProbe route and entry behind __DEV__', () => {
    const stack = text('src/navigation/stacks/MoreStack.tsx');
    const settings = text('src/screens/SettingsScreen.tsx');
    expect(stack).toMatch(/__DEV__\s*\?\s*\([\s\S]*name="EngineProbe"/);
    expect(settings).toMatch(/__DEV__\s*\?\s*\([\s\S]*testID="dev-engine-probe-entry"/);
  });

  it('gates the inherited promotion/account surface behind __DEV__', () => {
    expect(text('src/screens/SettingsScreen.tsx')).toMatch(
      /__DEV__\s*\?\s*\([\s\S]*testID="dev-promo-entry"/,
    );
  });

  it('keeps the BOI live-fetch module reachable only from the dev probe', () => {
    const consumers = sourceFiles(sourceRoot)
      .filter((path) => readFileSync(path, 'utf8').includes("data/fx/liveFetch"))
      .map((path) => relative(root, path).replaceAll('\\', '/'));
    expect(consumers).toEqual(['src/dev/EngineProbeScreen.tsx']);
  });

  it('contains no remote push-token acquisition route', () => {
    const offenders = sourceFiles(sourceRoot).filter((path) =>
      /getExpoPushTokenAsync|getDevicePushTokenAsync/.test(readFileSync(path, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('removes Firebase remote-push entry points from the merged Android manifest', () => {
    const manifest = text('android/app/src/main/AndroidManifest.xml');
    for (const component of [
      'ExpoFirebaseMessagingService',
      'FirebaseInstanceIdReceiver',
      'com.google.firebase.messaging.FirebaseMessagingService',
      'com.google.firebase.components.ComponentDiscoveryService',
      'com.google.firebase.provider.FirebaseInitProvider',
    ]) {
      expect(manifest).toMatch(
        new RegExp(`${component.replaceAll('.', '\\.') }[^>]*tools:node="remove"`),
      );
    }
  });

  it('does not request notification permission during authenticated navigation', () => {
    const navigator = text('src/navigation/AuthenticatedNavigator.tsx');
    expect(navigator).not.toContain('requestPermissionsAsync');
    expect(navigator).not.toContain('scheduleAnnualGlobalReminder');
  });
});
