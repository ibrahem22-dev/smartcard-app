/**
 * COMMENTS AND STRING LITERALS ARE NOT CODE.
 *
 * This scanner was written for `debt-retirement` and lifted here unchanged when `learn` needed it,
 * so that the two gates share one reader rather than growing two opinions about what code is. The
 * paragraph below is the reason it exists, and it is kept with the code rather than with the gate
 * that happened to need it first:
 *
 *   The first version of that scanner read raw source and reported six call sites that do not
 *   exist: a sentence in the gate's own doc comment, a translation string in en.ts reading
 *   "percent(0-100)", and the prose "18.5 means 18.5%" in a comment beside a real call. P2 recorded
 *   the same shape when its line-based import scanner was replaced with a whole-source one. A
 *   scanner that cannot tell code from prose does not measure the code.
 *
 * The same class runs the other way and `learn` is why the helper moved: a gate that matches raw
 * text can be SATISFIED by prose as well as tripped by it — a doc comment containing
 * `openContentSlices(` would have answered a positive check with no such code present.
 *
 * Replaces every comment and every string/template body with spaces of the same length, so byte
 * offsets and line numbers still line up with the original.
 */
export const stripCommentsAndStrings = (src) => {
  const out = src.split('');
  let i = 0;
  const nlChar = String.fromCharCode(10);
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k++) {
      if (out[k] !== nlChar) out[k] = ' ';
    }
  };

  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '//') {
      let j = src.indexOf(nlChar, i);
      if (j < 0) j = src.length;
      blank(i, j);
      i = j;
      continue;
    }
    if (two === '/*') {
      let j = src.indexOf('*/', i + 2);
      j = j < 0 ? src.length : j + 2;
      blank(i, j);
      i = j;
      continue;
    }
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === String.fromCharCode(92)) {
          j += 2;
          continue;
        }
        if (src[j] === c) {
          j++;
          break;
        }
        j++;
      }
      blank(i + 1, j - 1);
      i = j;
      continue;
    }
    i++;
  }

  return out.join('');
};

/**
 * COMMENTS ONLY — the sibling for readers whose SUBJECT lives inside string literals.
 *
 * `stripCommentsAndStrings` blanks string bodies, and for most scanners that is exactly right.
 * For some it would DELETE THE RULE. A module specifier IS a string body; so is a navigation
 * route name, an argv flag, a Tailwind class. Blank those and the reader stops seeing the only
 * thing it was built to see, while still printing a sentinel — the worst outcome available.
 *
 * So this strips comments and leaves strings intact. It still TRAVERSES strings rather than
 * skipping over them blindly, because a `//` inside `'https://…'` is not a comment and a naive
 * comment-stripper eats the rest of that line. Same length-preserving contract as its sibling:
 * newlines survive and every other removed character becomes a space, so byte offsets and line
 * numbers still line up with the original.
 *
 * Added under OQ-MDC-010, whose ruling is a sweep of P2-era readers that mistake prose for code.
 * Two tools, because the readers being swept are not all the same shape.
 */
export const stripComments = (src) => {
  const out = src.split('');
  let i = 0;
  const nlChar = String.fromCharCode(10);
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k++) {
      if (out[k] !== nlChar) out[k] = ' ';
    }
  };

  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '//') {
      let j = src.indexOf(nlChar, i);
      if (j < 0) j = src.length;
      blank(i, j);
      i = j;
      continue;
    }
    if (two === '/*') {
      let j = src.indexOf('*/', i + 2);
      j = j < 0 ? src.length : j + 2;
      blank(i, j);
      i = j;
      continue;
    }
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      /* Traversed, NOT blanked: the string's contents are what these readers are looking for. */
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === String.fromCharCode(92)) {
          j += 2;
          continue;
        }
        if (src[j] === c) {
          j++;
          break;
        }
        j++;
      }
      i = j;
      continue;
    }
    i++;
  }

  return out.join('');
};

/**
 * CODE SURVIVES, TEXT DOES NOT — for readers whose SUBJECT is a call inside `${…}`.
 *
 * `stripCommentsAndStrings` blanks a template literal whole, backtick to backtick. For a reader
 * hunting import specifiers that is right. For a reader hunting CALLS it is a blind spot, because
 * a React screen paints almost everything through `{`…${fn(x)}…`}` and the call lives inside the
 * very region being blanked.
 *
 * MEASURED, not assumed. When T2 routed four figures through the app's percent formatter, three of
 * the resulting call sites landed inside template literals and C11's unit classifier could not see
 * one of them. It had been seeing every call site until then — the blind spot hid nothing before
 * T2 — so this is a hole T2 was the first to walk into rather than a false green of long standing.
 * A classifier that silently stops seeing new call sites is worse than one that never saw any: it
 * keeps printing its sentinel over a shrinking population.
 *
 * So: comments blanked, ordinary string bodies blanked, template TEXT blanked — and the code inside
 * every `${…}` kept, with strings nested inside it treated by the same rules, to any depth. Same
 * length-preserving contract as both siblings, so line numbers and offsets still line up.
 *
 * NARROW BY CHOICE. This is a third function rather than a change to `stripCommentsAndStrings`,
 * which forty-odd readers across the P2 and MDC ladders depend on, several of them evidence for
 * closed criteria. Widening what they all see is not a change T2 has any business making.
 */
export const stripCodeInTemplates = (src) => {
  const out = src.split('');
  const nl = String.fromCharCode(10);
  const bs = String.fromCharCode(92);
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k++) if (out[k] !== nl) out[k] = ' ';
  };

  /** Processes [from, to) as CODE. Returns nothing; it edits `out` in place. */
  const code = (from, to) => {
    let i = from;
    while (i < to) {
      const two = src.slice(i, i + 2);
      if (two === '//') {
        let j = src.indexOf(nl, i);
        if (j < 0 || j > to) j = to;
        blank(i, j); i = j; continue;
      }
      if (two === '/*') {
        let j = src.indexOf('*/', i + 2);
        j = j < 0 || j + 2 > to ? to : j + 2;
        blank(i, j); i = j; continue;
      }
      const c = src[i];
      if (c === "'" || c === '"') {
        let j = i + 1;
        while (j < to) {
          if (src[j] === bs) { j += 2; continue; }
          if (src[j] === c) { j++; break; }
          j++;
        }
        blank(i, j); i = j; continue;
      }
      if (c === '`') {
        i = template(i, to); continue;
      }
      i += 1;
    }
  };

  /** `src[start]` is a backtick. Blanks the literal text, keeps `${…}` code. Returns the index after. */
  const template = (start, to) => {
    out[start] = ' ';
    let i = start + 1;
    let textFrom = i;
    while (i < to) {
      if (src[i] === bs) { i += 2; continue; }
      if (src[i] === '`') { blank(textFrom, i); out[i] = ' '; return i + 1; }
      if (src[i] === '$' && src[i + 1] === '{') {
        blank(textFrom, i);
        /* Find the matching `}`, counting braces and skipping over nested strings so a `}`
           inside one does not close the interpolation early. */
        let depth = 0, j = i + 1;
        for (; j < to; j++) {
          const ch = src[j];
          if (ch === bs) { j += 1; continue; }
          if (ch === "'" || ch === '"') {
            let k = j + 1;
            while (k < to) {
              if (src[k] === bs) { k += 2; continue; }
              if (src[k] === ch) break;
              k++;
            }
            j = k; continue;
          }
          if (ch === '`') { j = template(j, to) - 1; continue; }
          if (ch === '{') depth += 1;
          else if (ch === '}') { depth -= 1; if (depth === 0) break; }
        }
        const close = Math.min(j, to);
        out[i] = ' '; out[i + 1] = ' ';          // the `${` itself is not code
        code(i + 2, close);                       // the expression IS
        if (close < to) out[close] = ' ';         // nor is the closing `}`
        i = close + 1; textFrom = i; continue;
      }
      i += 1;
    }
    blank(textFrom, to);
    return to;
  };

  code(0, src.length);
  return out.join('');
};
