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
