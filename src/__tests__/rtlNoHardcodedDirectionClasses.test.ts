import * as fs from 'node:fs';
import * as path from 'node:path';

const SCAN_DIRS = ['src/components', 'src/screens', 'src/navigation'] as const;

const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\bflex-row-reverse\b/,
  /\bflex-row\b/,
  /\btext-left\b/,
  /\btext-right\b/,
  /\bitems-start\b/,
  /\bitems-end\b/,
  /\bjustify-start\b/,
  /\bjustify-end\b/,
  /\bself-start\b/,
  /\bself-end\b/,
  /\bml-/,
  /\bmr-/,
  /\bpl-/,
  /\bpr-/,
  /\bleft-/,
  /\bright-/,
  /\bmarginLeft\b/,
  /\bmarginRight\b/,
  /\bpaddingLeft\b/,
  /\bpaddingRight\b/,
];

const ALLOWLIST_FILE_SUFFIXES = ['.test.ts', '.test.tsx'];

function isAllowlistedLine(line: string): boolean {
  return line.includes('rtl-ok');
}

function isScannableFile(filePath: string): boolean {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) {
    return false;
  }
  return !ALLOWLIST_FILE_SUFFIXES.some(suffix => filePath.endsWith(suffix));
}

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'rtl' || entry.name === '__tests__') {
        continue;
      }
      files.push(...walk(fullPath));
      continue;
    }
    if (isScannableFile(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('rtlNoHardcodedDirectionClasses', () => {
  test('screens/components/navigation avoid hardcoded directional classes', () => {
    const violations: string[] = [];

    for (const scanDir of SCAN_DIRS) {
      const absoluteDir = path.join(process.cwd(), scanDir);
      if (!fs.existsSync(absoluteDir)) {
        continue;
      }

      for (const filePath of walk(absoluteDir)) {
        const relativePath = path.relative(process.cwd(), filePath);
        const lines = fs.readFileSync(filePath, 'utf8').split('\n');

        lines.forEach((line, index) => {
          const previousLine = index > 0 ? lines[index - 1] ?? '' : '';
          if (isAllowlistedLine(line) || isAllowlistedLine(previousLine)) {
            return;
          }

          for (const pattern of FORBIDDEN_PATTERNS) {
            if (pattern.test(line)) {
              violations.push(`${relativePath}:${index + 1}: ${line.trim()}`);
              break;
            }
          }
        });
      }
    }

    expect(violations).toEqual([]);
  });
});
