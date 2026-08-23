#!/usr/bin/env node
/**
 * THE A8 MIGRATION, SECOND PASS — hex literals in React Native style props.
 *
 *     node tools/p2/migrate-colour-values.mjs           report
 *     node tools/p2/migrate-colour-values.mjs --write   apply
 *
 * The first pass moved 296 className sites off raw hues. What it could not touch is colour that
 * reaches React Native as a VALUE rather than as a class: `headerStyle`, `tabBarActiveTintColor`,
 * `placeholderTextColor`, `StyleSheet.create`. NativeWind does not reach those props, so they were
 * written as hex and stayed hex.
 *
 * They are the same defect. `#141414` written in three navigation stacks is the same fact in three
 * places, and `tailwind.config.js` holds a fourth copy under the name `app-dark`. The token module
 * already names every one of these values — this pass just makes the source say the name.
 *
 * A JSX attribute string becomes a braced expression:  `placeholderTextColor="#94A3B8"`
 *                                                   →  `placeholderTextColor={CHROME.subtle}`
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const WRITE = process.argv.includes('--write');

/** Every hex the token module names, and the name it gives it. */
const VALUES = {
  '#141414': 'CHROME.appDark',
  '#1E1E1E': 'CHROME.darkSurface',
  '#F8FAFC': 'CHROME.appLight',
  '#FFFFFF': 'CHROME.white',
  '#0F172A': 'CHROME.ink',
  '#334155': 'CHROME.inkMuted',
  '#64748B': 'CHROME.muted',
  '#94A3B8': 'CHROME.subtle',
  '#CBD5E1': 'CHROME.hairline',
  '#262626': 'CHROME.hairlineDark',
  '#475569': 'CHROME.inkDark',
  '#1E293B': 'CHROME.surfaceDark',
  '#2563EB': 'CHROME.accent',
  '#0A0A0A': 'CHROME.privacyScrim',
  '#FCA5A5': 'CHROME.dangerSoft',
};

const walk = (dir, acc = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__') walk(p, acc); }
    else if (/\.tsx?$/.test(e)) acc.push(p);
  }
  return acc;
};

const files = walk(join(ROOT, 'src'))
  .filter((f) => !/theme[\\/]tokens\.ts$/.test(f))
  // useTheme owns the BRAND maps and is migrated by hand: its hexes are issuer identity, not chrome.
  .filter((f) => !/hooks[\\/]useTheme\.ts$/.test(f));

const HEX_LITERAL = /(['"])(#[0-9a-fA-F]{3,8})\1/g;

let changedFiles = 0, changedSites = 0;
const unknown = new Map();

for (const abs of files) {
  const rel = relative(ROOT, abs).replace(/\\/g, '/');
  const original = readFileSync(abs, 'utf8');
  const crlf = original.includes('\r\n');
  let src = original.replace(/\r\n/g, '\n');
  let sites = 0;

  const next = src.replace(HEX_LITERAL, (whole, quote, hex, offset) => {
    const token = VALUES[hex.toUpperCase()];
    if (!token) {
      if (!unknown.has(hex.toUpperCase())) unknown.set(hex.toUpperCase(), new Set());
      unknown.get(hex.toUpperCase()).add(rel);
      return whole;
    }
    sites += 1;
    // Same rule as the first pass: a JSX attribute value needs braces, an expression does not.
    const before = src.slice(Math.max(0, offset - 40), offset);
    return /[A-Za-z_$][\w$]*=$/.test(before) ? '{' + token + '}' : token;
  });

  if (sites === 0) continue;
  changedFiles += 1;
  changedSites += sites;

  let out = next;
  if (!/from '[^']*theme\/tokens'/.test(out)) {
    const depth = rel.split('/').length - 1;
    const spec = '../'.repeat(depth - 1) + 'theme/tokens';
    const importLine = "import { CHROME } from '" + spec + "';";
    const lastImport = [...out.matchAll(/^import[^\n]*;\n/gm)].pop();
    if (lastImport) {
      const at = lastImport.index + lastImport[0].length;
      out = out.slice(0, at) + importLine + '\n' + out.slice(at);
    } else out = importLine + '\n' + out;
  } else {
    out = out.replace(/import \{ ([^}]*) \} from ('[^']*theme\/tokens');/, (w, names, spec) =>
      names.split(',').map((n) => n.trim()).includes('CHROME')
        ? w
        : 'import { ' + [...names.split(',').map((n) => n.trim()), 'CHROME'].sort().join(', ') + ' } from ' + spec + ';');
  }

  console.log(String(sites).padStart(4) + '  ' + rel);
  if (WRITE) writeFileSync(abs, crlf ? out.replace(/\n/g, '\r\n') : out);
}

console.log('');
console.log((WRITE ? 'APPLIED' : 'WOULD APPLY') + ' — ' + changedSites + ' hex value(s) across ' + changedFiles + ' file(s)');
if (unknown.size) {
  console.log('');
  console.log('NOT IN THE TOKEN MODULE — ' + unknown.size + ' hex value(s) left exactly as they are:');
  for (const [h, fs] of unknown) console.log('  ' + h + '  ' + [...fs].join(', '));
}
