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

/**
 * A COMMENT IS NOT A CLASS NAME.
 *
 * This scan used to read whole lines, so a comment explaining why a component avoids `flex-row`
 * was itself reported as using it. `ProvenanceChip.tsx` tripped it twice in one commit — once for
 * the sentence naming the class it deliberately does not use, and once for the phrase
 * "right-to-left", because `right-` is on the forbidden list.
 *
 * This is the same defect criterion D3's symbol check had in Phase 2, and it has the same cost: a
 * check that punishes documentation pushes a codebase toward deleting its own explanations. Code is
 * searched; comments are not.
 *
 * Block comments are left alone deliberately — stripping them here would need a parser, and a
 * half-parser that loses track of a string containing "\/*" would start hiding real code.
 */
function codeOnly(line: string): string {
  const at = line.indexOf('//');
  if (at === -1) return line;
  // A '//' inside a string literal is code. Counting quotes before it is crude and sufficient:
  // an odd count means the '//' is inside an unterminated literal on this line.
  const before = line.slice(0, at);
  const quotes = (before.match(/['"`]/g) ?? []).length;
  return quotes % 2 === 1 ? line : before;
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

          const code = codeOnly(line);
          for (const pattern of FORBIDDEN_PATTERNS) {
            if (pattern.test(code)) {
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
