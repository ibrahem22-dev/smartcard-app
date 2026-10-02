/**
 * node:crypto SHIM FOR METRO (React Native / Hermes) — PHASE-7 device-evidence repair.
 *
 * WHY THIS EXISTS. The data-authority adapter (pipeline-owned, OD-20) verifies pack and
 * FX-snapshot artifacts with Node's crypto: sha256 integrity hashes (`createHash`) and
 * Ed25519 signature verification (`verify`/`createPublicKey`, plus `sign`/`createPrivateKey`
 * on the development-key path). Metro cannot resolve the `node:crypto` specifier on device,
 * so any bundle that reaches the adapter entry failed to build — which is what crashed the
 * dev launcher before this shim existed.
 *
 * WHAT IT IS. A pure-JS implementation of exactly the subset the adapter's compiled output
 * uses, built on @noble/hashes + @noble/curves — the same pure-JS crypto choice this app
 * already made in src/security/keyVault.ts ("managed-workflow safe", no native module, no
 * rebuild). It does NOT weaken verification: Ed25519 is still Ed25519, sha256 is still
 * sha256; only the runtime providing them changes.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not silently accept unknown algorithms, wrong
 * key formats, or non-Ed25519 keys — every unsupported input throws with the reason named,
 * mirroring the adapter's own refusal style. The pipeline keeps using real node:crypto;
 * jest runs in Node and never loads this file; metro.config.js maps ONLY `node:crypto`.
 */
const { sha256 } = require('@noble/hashes/sha2.js');
const { bytesToHex } = require('@noble/hashes/utils.js');
const { ed25519 } = require('@noble/curves/ed25519.js');

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToB64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;
    out += B64[b0 >> 2];
    if (b1 === undefined) {
      out += `${B64[(b0 & 3) << 4]}==`;
      break;
    }
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    if (b2 === undefined) {
      out += `${B64[(b1 & 15) << 2]}=`;
      break;
    }
    out += B64[((b1 & 15) << 2) | (b2 >> 6)];
    out += B64[b2 & 63];
  }
  return out;
}

function b64ToBytes(text) {
  const clean = String(text).replace(/[^A-Za-z0-9+/=]/g, '');
  const out = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    if (ch === '=') break;
    buffer = (buffer << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

function toBytes(input) {
  if (typeof input === 'string') return new TextEncoder().encode(input);
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer ?? input);
  }
  throw new TypeError(`node-crypto shim: cannot read payload of type ${typeof input}`);
}

/** RFC 8410: Ed25519 SPKI is a fixed 44-byte DER — algorithm prefix then the raw 32-byte key. */
const ED25519_SPKI_PREFIX = [0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00];
/** RFC 8410: Ed25519 PKCS#8 v1 private key is a fixed 48-byte DER — prefix then the raw 32-byte key. */
const ED25519_PKCS8_PREFIX = [0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20];

function pemDer(pem) {
  const body = String(pem)
    .split(/\r?\n/)
    .filter((line) => !line.includes('-----') && line.trim() !== '')
    .join('');
  return b64ToBytes(body);
}

function derPrefixMatches(der, prefix) {
  if (der.length !== prefix.length + 32) return false;
  return prefix.every((byte, index) => der[index] === byte);
}

function createPublicKey(pem) {
  const der = pemDer(pem);
  if (!derPrefixMatches(der, ED25519_SPKI_PREFIX)) {
    throw new Error('node-crypto shim: public key PEM is not an Ed25519 SPKI subjectPublicKeyInfo');
  }
  return {
    asymmetricKeyType: 'ed25519',
    export: () => der.slice(),
    rawPublic: der.slice(der.length - 32),
  };
}

function createPrivateKey(pem) {
  const der = pemDer(pem);
  if (!derPrefixMatches(der, ED25519_PKCS8_PREFIX)) {
    throw new Error('node-crypto shim: private key PEM is not an Ed25519 PKCS#8 PrivateKeyInfo');
  }
  return {
    asymmetricKeyType: 'ed25519',
    export: () => der.slice(),
    rawPrivate: der.slice(der.length - 32),
  };
}

function createHash(algorithm) {
  if (algorithm !== 'sha256') {
    throw new Error(`node-crypto shim: hash algorithm "${algorithm}" is not supported (sha256 only)`);
  }
  let chunks = [];
  return {
    update(data) {
      chunks.push(toBytes(data));
      return this;
    },
    digest(encoding) {
      const digest = sha256(concat(chunks));
      chunks = [];
      if (encoding === 'hex') return bytesToHex(digest);
      if (encoding === 'base64') return bytesToB64(digest);
      if (encoding === undefined || encoding === 'buffer') return digest;
      throw new Error(`node-crypto shim: digest encoding "${encoding}" is not supported`);
    },
  };
}

function concat(arrays) {
  const total = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    out.set(arr, offset);
    offset += arr.length;
  }
  return out;
}

/**
 * One-shot Ed25519 operations. Node passes `null` as the algorithm when the key type implies
 * it — that null is load-bearing here: anything else is refused rather than guessed.
 */
function sign(algorithm, payload, key) {
  if (algorithm !== null) {
    throw new Error('node-crypto shim: sign() supports only the key-implied form (algorithm null)');
  }
  return ed25519.sign(toBytes(payload), key.rawPrivate);
}

function verify(algorithm, payload, key, signature) {
  if (algorithm !== null) {
    throw new Error('node-crypto shim: verify() supports only the key-implied form (algorithm null)');
  }
  try {
    return ed25519.verify(toBytes(signature), toBytes(payload), key.rawPublic);
  } catch {
    return false;
  }
}

module.exports = {
  createHash,
  createPublicKey,
  createPrivateKey,
  sign,
  verify,
};

// envelope.js and snapshot-manifest.js call Buffer.from(...) directly in their function
// bodies. This module is loaded by those modules' first `require("node:crypto")`, so making
// the global available HERE means every later adapter call sees it — no earlier execution
// order assumption anywhere else in the app.
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = require('buffer').Buffer;
}
