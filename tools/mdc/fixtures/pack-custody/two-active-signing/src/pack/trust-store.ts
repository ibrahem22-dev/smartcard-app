export const TRUST_STORE = [
  {
    keyId: 'PROD-RELEASE-fixtureaaaaaaaaaaaa',
    custody: 'HARDWARE_BACKED',
    lifecycle: 'ACTIVE_SIGNING',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nFIXTURE\n-----END PUBLIC KEY-----\n',
  },
  {
    keyId: 'PROD-RELEASE-fixturebbbbbbbbbbbb',
    custody: 'HARDWARE_BACKED',
    lifecycle: 'ACTIVE_SIGNING',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nFIXTURE\n-----END PUBLIC KEY-----\n',
  },
  {
    keyId: 'DEV-KEY-NOT-FOR-RELEASE-fixture-dev',
    custody: 'OWNER_LOCAL_DEV_NOT_FOR_RELEASE',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nFIXTURE\n-----END PUBLIC KEY-----\n',
  },
];
export const RETIRED_KEY_IDS: readonly string[] = [
  'DEV-KEY-NOT-FOR-RELEASE-fixture-retired',
];
