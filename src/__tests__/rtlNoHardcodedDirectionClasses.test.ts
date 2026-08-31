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
 * BLOCK COMMENTS TOO, which the first version of this fix left alone. It reasoned that stripping
 * them needed a parser — and then `WeekHeader.tsx` arrived with a doc comment explaining why its
 * header row is the one row in the app that must NOT mirror, and the sentence "so Sunday lands in
 * the rightmost cell" was reported as a hardcoded direction.
 *
 * The worry was a string literal containing the characters that open a block comment. That is worth
 * naming and it is not worth the cost of the alternative: a scan that punishes the paragraph
 * explaining an exception is a scan that gets the paragraph deleted.
 */
function stripBlockComments(source: string): string {
  // Length-preserving: newlines survive so line numbers stay true, everything else becomes a space.
  return source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function codeOnly(line: string): string {
  const at = line.indexOf('//');
  if (at === -1) return line;
  // A '//' inside a string literal is code. Counting quotes before it is crude and sufficient:
  // an odd count means the '//' is inside an unterminated literal on this line.
  const before = line.slice(0, at);
  const quotes = (before.match(/['"`]/g) ?? []).length;
  return quotes % 2 === 1 ? line : before;
}

/**
 * AN IDENTIFIER IS NOT A CLASS NAME EITHER — OQ-MDC-008, ruled 2026-08-31.
 *
 * The paragraph above blanked comments and stopped there, so prose could no longer trip the scan.
 * String literals still could, and one did: C6's Learn screen builds a testID as
 * `learn-right-row-${topicId}`, and `/\bright-/` matched inside it — a rule about CSS direction
 * classes, firing on a template literal that names a test hook. Same defect class as the comment
 * one, one layer in. `tools/mdc/gates/debt-retirement.mjs` records it a third time: its first
 * scanner read raw source and reported six call sites that do not exist.
 *
 * WHY THIS DOES NOT SIMPLY BLANK EVERY LITERAL, WHICH WOULD HAVE BEEN THE OBVIOUS READING.
 * The forbidden tokens ARE string contents — `className="flex-row items-start"` is the whole
 * subject of this test. Blanking literals wholesale would delete the rule while leaving it looking
 * like it still ran, which is the exact shape of false green this file exists to prevent. It would
 * also miss `const rowClass = 'flex-row'` on a line with no `className` on it.
 *
 * So a literal is blanked ONLY when it cannot be a class string: when every forbidden match inside
 * it is a SUBSTRING of a longer hyphenated identifier rather than a standalone token. Tailwind
 * classes are whitespace-separated, so a real class always begins at the start of the literal, at
 * whitespace, or straight after an interpolation. `learn-right-row-` has `right-` preceded by `-`
 * and is blanked; `"... right-0 ..."`, `'flex-row'` and `` `${base} text-left` `` all keep their
 * token and are still reported. The rule is unchanged; only matches that were never class tokens
 * stop being reported.
 *
 * Length-preserving, like stripBlockComments, so the reported line text and numbers stay true.
 */
function isClassShaped(body: string): boolean {
  return FORBIDDEN_PATTERNS.some((pattern) => {
    const scan = new RegExp(pattern.source, 'g');
    let hit = scan.exec(body);
    while (hit !== null) {
      const before = hit.index === 0 ? '' : body.charAt(hit.index - 1);
      // Start of the literal, whitespace, or the close of a `${...}` interpolation.
      if (before === '' || /\s/.test(before) || before === '}') return true;
      hit = scan.exec(body);
    }
    return false;
  });
}

function blankNonClassLiterals(line: string): string {
  // Single-line spans only: ' … ', " … " and ` … `, escapes honoured. A literal that opens and
  // does not close on this line is left alone rather than guessed at.
  return line.replace(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g, (whole, quote: string, body: string) =>
    isClassShaped(body) ? whole : quote + body.replace(/[^\n]/g, ' ') + quote,
  );
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
        // TWO VIEWS OF THE SAME FILE, and both are needed.
        //
        // The patterns are matched against code with comments blanked, so a paragraph explaining
        // an exception is not reported as the exception. But the `rtl-ok` MARKER is itself a
        // comment — and in JSX it is written `{/* rtl-ok */}`, a block comment. Blanking that made
        // the marker vanish and the line it protects fail, which is how the first version of this
        // fix broke a file that had been correct for months.
        //
        // So: allowlisting reads the original, pattern-matching reads the stripped copy.
        const original = fs.readFileSync(filePath, 'utf8');
        const rawLines = original.split('\n');
        const lines = stripBlockComments(original).split('\n');

        lines.forEach((line, index) => {
          const rawLine = rawLines[index] ?? '';
          const previousRaw = index > 0 ? rawLines[index - 1] ?? '' : '';
          if (isAllowlistedLine(rawLine) || isAllowlistedLine(previousRaw)) {
            return;
          }

          const code = blankNonClassLiterals(codeOnly(line));
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
