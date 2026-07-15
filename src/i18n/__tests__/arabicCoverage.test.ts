import fs from 'fs';
import path from 'path';

import { arBySource } from '../ar';
import { enBySource } from '../en';

const SRC_ROOT = path.resolve(__dirname, '..', '..');

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === '__tests__' ||
        entry.name === 'node_modules' ||
        entry.name === 'i18n' ||
        entry.name === 'engines' ||
        entry.name === 'security' ||
        entry.name === 'data'
      ) {
        continue;
      }
      walkTsFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function extractQuotedTKeys(source: string): string[] {
  const keys: string[] = [];
  const re = /\bt\(\s*(['"`])((?:\\.|(?!\1).)*)\1/gs;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const raw = match[2];
    if (raw === undefined) {
      continue;
    }
    keys.push(
      raw
        .replace(/\\n/g, '\n')
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\\`/g, '`'),
    );
  }
  return keys;
}

function extractGlossaryTermKeys(source: string): string[] {
  const block = source.match(/const GLOSSARY_TERMS = \[([\s\S]*?)\] as const/);
  if (block === null || block[1] === undefined) {
    return [];
  }
  const body = block[1];
  const keys: string[] = [];
  const fieldRe = /(title|explanation|example):\s*'((?:\\'|[^'])*)'/g;
  let match: RegExpExecArray | null;
  while ((match = fieldRe.exec(body)) !== null) {
    const raw = match[2];
    if (raw === undefined) {
      continue;
    }
    keys.push(raw.replace(/\\'/g, "'"));
  }
  return keys;
}

function collectUsedHebrewKeys(): string[] {
  const keys = new Set<string>();
  for (const file of walkTsFiles(SRC_ROOT)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const key of extractQuotedTKeys(text)) {
      if (/[֐-׿]/.test(key)) {
        keys.add(key);
      }
    }
  }

  const glossaryPath = path.join(SRC_ROOT, 'screens', 'GlossaryScreen.tsx');
  if (fs.existsSync(glossaryPath)) {
    const glossaryText = fs.readFileSync(glossaryPath, 'utf8');
    for (const key of extractGlossaryTermKeys(glossaryText)) {
      if (/[֐-׿]/.test(key)) {
        keys.add(key);
      }
    }
  }

  return [...keys].sort((a, b) => a.localeCompare(b, 'he'));
}

describe('Arabic translation coverage (Owner-locked MVP language)', () => {
  test('every English-mapped key has an Arabic translation', () => {
    const missing = Object.keys(enBySource).filter(
      key => arBySource[key] === undefined,
    );
    expect(missing).toEqual([]);
  });

  test('no Arabic value is empty or accidentally left in Hebrew source form', () => {
    for (const [key, value] of Object.entries(arBySource)) {
      expect(value.trim().length).toBeGreaterThan(0);
      // A Hebrew-keyed entry whose value still equals the key was never
      // translated. Non-Hebrew keys (dev-only English labels) are exempt.
      const keyHasHebrew = /[֐-׿]/.test(key);
      if (keyHasHebrew) {
        expect(value).not.toBe(key);
      }
    }
  });

  test('every t()-used Hebrew key (incl. Glossary override class) has Arabic', () => {
    const used = collectUsedHebrewKeys();
    const missing = used.filter(key => arBySource[key] === undefined);
    expect(missing).toEqual([]);
  });

  test('every t()-used Hebrew key (incl. Glossary override class) has English', () => {
    const used = collectUsedHebrewKeys();
    const missing = used.filter(key => enBySource[key] === undefined);
    expect(missing).toEqual([]);
  });

  test('Glossary term titles have distinct Arabic (not Hebrew leftover)', () => {
    const titles = [
      'מסגרת אשראי',
      'חזרת חיוב',
      'ריבית דריבית',
      'עמלת המרה',
      'תשלומים',
      'חיוב נדחה',
      'מועד חיוב',
      'מסלול',
      'מועדון',
    ];
    for (const title of titles) {
      expect(arBySource[title]).toBeDefined();
      expect(arBySource[title]).not.toBe(title);
      expect(/[\u0600-\u06FF]/.test(arBySource[title] ?? '')).toBe(true);
    }
  });
});
