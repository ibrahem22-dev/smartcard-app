/**
 * GATE: no-card-credentials — criterion W6.  →  `NO-CARD-CREDENTIALS OK`
 *
 * Capture accepts a CardProduct reference and at most four digits. No PAN, CVV/CVC,
 * PIN, expiry secret or other card credential in the wizard field, type, validator
 * or stored record.
 *
 * NEGATIVE CONTROL (contract §7.1 W6): add a sixteen-digit card-number field to the
 * wizard and watch this gate fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['W6'];
export const SENTINEL = 'NO-CARD-CREDENTIALS OK';
export const MEASURES = 'source+render';

const SCREEN = 'src/screens/AddCardScreen.tsx';
const VAULT = 'src/data/adapter/wizardVault.ts';
const TYPES = 'src/types/card.types.ts';
const RENDER = 'src/screens/__tests__/addCard.credentials.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';

const CREDENTIAL = /\b(cardNumber|card_number|fullPan|fullPAN|\bPAN\b|cvv|cvc|cvv2|securityCode|expiryDate|expirationDate|expirySecret|cardPin)\b/i;
const SIXTEEN = /maxLength=\{1[69]\}/;

const RENDER_CASES = [
  'the digits field accepts exactly four and no sixteen-digit card-number field exists',
  'the wizard paints no CVV, CVC, PIN or expiry secret field',
];

const projectConfig = (root, displayName, suite) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) return { error: JEST_CONFIG + ' does not exist' };
  const config = createRequire(import.meta.url)(configPath);
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const project = projects.find((p) => p && p.displayName === displayName);
  if (!project) return { error: JEST_CONFIG + ' has no "' + displayName + '" project' };
  return { config: { ...project, rootDir: root, testMatch: ['**/' + suite] } };
};

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

export const run = async ({ root }) => {
  for (const file of [SCREEN, VAULT, TYPES, RENDER]) {
    if (!existsSync(join(root, file))) {
      return fail(file + ' does not exist — W6 has no capture path to sweep');
    }
  }

  const screen = readFileSync(join(root, SCREEN), 'utf8');
  const vault = readFileSync(join(root, VAULT), 'utf8');
  const types = stripComments(readFileSync(join(root, TYPES), 'utf8'));

  if (!screen.includes('testID="add-card-last4"') || !screen.includes('maxLength={4}')) {
    return fail(SCREEN + ' lost the four-digit last4 field');
  }
  if (!/\\?\\^\\d\{4\}\\$/.test(screen) && !screen.includes('/^\\d{4}$/')) {
    return fail(SCREEN + ' does not require exactly four digits on save');
  }
  if (SIXTEEN.test(screen)) {
    return fail(SCREEN + ' has a 16/19-digit field — W6 allows at most four digits');
  }

  for (const [file, src] of [[SCREEN, screen], [VAULT, vault], [TYPES, types]]) {
    const hit = src.match(CREDENTIAL);
    if (hit) {
      return fail(file + ' names a card credential (' + hit[0] + ') — W6 is an absence');
    }
  }

  const user = types.match(/export\s+interface\s+UserCard\s*\{[\s\S]*?\n\}/);
  if (!user) return fail(TYPES + ' has no UserCard interface');
  if (!/\blast4\?/.test(user[0])) {
    return fail(TYPES + ' UserCard.last4 must stay optional — four digits, not a required PAN');
  }

  const renderCfg = projectConfig(root, 'render', RENDER);
  if (renderCfg.error) return fail(renderCfg.error);
  const rendered = requireJestCases(root, RENDER, RENDER_CASES, [
    '--config', JSON.stringify(renderCfg.config),
  ]);
  if (rendered.problems.length) {
    return fail(rendered.problems.join(' · '), rendered.summary ?? undefined);
  }

  return ok(SENTINEL, [
    SCREEN + ' last4 is maxLength 4; no PAN/CVV/PIN/expiry field, type or validator',
    TYPES + ' UserCard carries optional last4, not a credential',
    RENDER + ' · ' + rendered.summary,
  ].join('\n'));
};
