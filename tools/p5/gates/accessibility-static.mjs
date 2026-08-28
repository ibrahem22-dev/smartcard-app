/**
 * GATE: accessibility-static — criterion R3.  →  `ACCESSIBILITY-STATIC OK`
 *
 *   > **R3.** *"Every state carrier on a P5 surface has a non-colour cue, touch targets are at least
 *   > 44pt, body text is at least 16pt, and contrast meets AA."*
 *
 * MEASURES: 'source'. R1, R2, R5 and V5 carry the `DEVICE` flag and need a capture; R3 does not,
 * because every one of its four clauses is a property of the code rather than of a rendering.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE CONTRAST FORMULA HAS ONE HOME AND IT IS P2's
 *
 * `tools/p2/lib/contrast.mjs` already computes relative luminance and AA ratios, and P2's `A9` gate
 * already uses it over P2's population. Writing a second formula here would be two implementations
 * of a fixed piece of arithmetic that agree until one is edited — the failure this campaign has
 * recorded more than any other. So this imports P2's, and what is P5's is only the **population**:
 * the surfaces P5 built.
 *
 * That is also why R3 exists at all when A9 does. A9 measured P2's surfaces. The colours here are
 * the same tokens, but the pairings are new — a chip on a tile, a level on a strip — and a pairing
 * is what contrast is about.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "STATE CARRIER" IS THE PHRASE THAT DOES THE WORK
 *
 * Not "every coloured thing". A state carrier is an element whose COLOUR MEANS SOMETHING — a risk
 * level, a provenance chip, a load band, a waiver countdown. Decorative colour needs no cue; a
 * carrier does, because a person who cannot distinguish the hues loses the information entirely and
 * a screen reader never had it.
 *
 * P5 has already held this line three times without being asked twice: `K2`'s day markers, `H4`'s
 * risk strip, and `W3`'s waiver badge each carry a cue and a label. This gate is what stops the
 * fourth one from being the exception.
 *
 * NEGATIVE CONTROL (contract §R3): remove a non-colour cue from a state carrier and watch this fail.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio, hexForClass, AA_BODY, AA_LARGE } from '../../p2/lib/contrast.mjs';
import { splitModes, pick, readTokenMap, customPalette } from '../../p2/lib/tokens.mjs';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['R3'];
export const SENTINEL = 'ACCESSIBILITY-STATIC OK';
export const MEASURES = 'source';

/** The surfaces P5 built. Their own directories, so the population moves with the work. */
const P5_SURFACE_DIRS = [
  'src/screens/cardDna',
  'src/screens/wallet',
  'src/screens/plan',
  'src/screens/calendar',
  'src/screens/home',
];

/**
 * Elements whose colour MEANS something, by the testID P5 gave them. A carrier without a cue is the
 * defect; a decorative colour without one is not.
 */
/*
 * A STATE CARRIER AND THE FILE ITS CUE LIVES IN — WHICH IS NOT ALWAYS THE FILE THAT RENDERS IT.
 *
 * The first version demanded an `accessibilityLabel` in whatever file mentioned the carrier, and
 * flagged four things that are all correct:
 *
 *   · every call site of <ProvenanceChip>, because the LABEL IS INSIDE THE COMPONENT — it sets
 *     accessibilityLabel from CHIP_LABEL, so a call site adding another would be a second one;
 *   · the waiver badge, whose cue is its COUNTDOWN TEXT. A9's phrasing is 'icon + word, never
 *     colour alone", and a visible word IS the word. Demanding one specific spelling of a cue is
 *     not the criterion.
 *
 * So each carrier now names the file its cue belongs in and what counts as one there. A cue may be
 * an accessibility annotation OR rendered text — both reach a person who cannot use the colour,
 * and only one of them reaches a screen reader, which is why a carrier with neither fails.
 */
/*
 * COUNTING INSTANCES, NOT ASKING WHETHER THE FILE MENTIONS A CUE ANYWHERE.
 *
 * The first version asked one question per FILE: does this file contain an accessibility annotation
 * or an <AppText> somewhere? DayMarkers renders three markers and every one of them has a cue, so
 * the answer was yes — and it would still have been yes after deleting two of them.
 *
 * R3's negative control in the contract is "make one risk dot colour-only and watch the gate fail".
 * Against a file-level question that control CANNOT fire: the salary coin and the billing marker
 * still carry their cues, the file still says yes, the gate still prints OK. A check that cannot
 * fail the way its own contract says it should is not yet a check (§2 rule 7), so the rule counts.
 *
 * Each carrier declares how one INSTANCE of it is rendered and how one CUE is rendered. Deleting a
 * single cue leaves three renders against two cues, and the counts disagree.
 */
const STATE_CARRIERS = [
  {
    needle: '-marker-',
    what: 'the calendar risk marker',
    where: 'src/screens/calendar/DayMarkers.tsx',
    renders: /testID=\{testID\}/g,
    cues: /testID=\{`\$\{testID\}-cue`\}/g,
  },
  {
    needle: 'risk-strip-day',
    what: "Home's risk level",
    where: 'src/screens/home/HomeRiskStrip.tsx',
    renders: /testID=\{testID\}/g,
    cues: /\{presentation\.cue\}/g,
  },
  {
    needle: 'waiver-badge',
    what: 'the waiver countdown',
    where: 'src/screens/wallet/WaiverBadge.tsx',
    renders: /testID="wallet-waiver-badge"/g,
    cues: /testID="wallet-waiver-badge-countdown"/g,
  },
  {
    needle: '-chip',
    what: 'a provenance chip',
    where: 'src/components/ProvenanceChip.tsx',
    renders: /testID=\{testID \?\?/g,
    cues: /accessibilityLabel=/g,
  },
  {
    needle: 'load-bar',
    what: 'the load band',
    where: 'src/screens/home/HomeLoadBar.tsx',
    renders: /testID="home-load-bar"/g,
    cues: /accessibilityLabel=/g,
  },
];

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const walk = (abs, acc = []) => {
  if (!existsSync(abs)) return acc;
  for (const entry of readdirSync(abs)) {
    const p = join(abs, entry);
    if (statSync(p).isDirectory()) { if (entry !== '__tests__') walk(p, acc); }
    else if (/\.tsx$/.test(entry)) acc.push(p);
  }
  return acc;
};

const TOKEN_MODULE = 'src/theme/tokens.ts';
const TOKEN_MAPS = ['TEXT', 'SURFACE', 'ROLE_TEXT', 'ROLE_SURFACE_BG'];

/**
 * WHAT A "COMPOSED PAIRING" IS, AND WHY A9 CANNOT SEE IT.
 *
 * A9 measures the pairings the design system DECLARES: LEGIBLE_ON says which TEXT tokens belong on
 * which SURFACE, and each ROLE_TEXT is measured on its OWN ROLE_SURFACE_BG. That is 44 pairings and
 * they are all real. But A9 never opens a screen file, so it cannot see what a screen actually
 * builds — and P5's screens build combinations the token module never declared.
 *
 * HomeRiskStrip is the worked example. The pressable gets `presentation.className`, which is one of
 * five branches — ROLE_SURFACE_BG.positive / .advisory / .danger / .neutral. The AppText INSIDE it
 * gets ROLE_TEXT.neutral. So the app renders neutral text on a danger background, and no token pairs
 * those two, so A9 measures it in neither mode. That is the gap R3 exists for, and it is why R3's
 * own header says "the tokens are the same, the PAIRINGS are new".
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * HOW THE BACKGROUND OF A PIECE OF TEXT IS DETERMINED — AND THE LIMIT OF IT
 *
 * A text element rarely carries its own background; it inherits the nearest ancestor that has one.
 * Establishing that properly needs a JSX parse. This uses INDENTATION as the nesting signal, which
 * is sound here for a specific reason rather than a hopeful one: this repo is prettier-formatted and
 * lint-gated, so a child's className line is indented further than its ancestor's, always.
 *
 * The limit is worth stating plainly: if a file were ever hand-formatted against prettier, this
 * would attribute a background to the wrong element. It would then measure a pairing that is not
 * rendered — a FALSE RED, which someone reads and fixes. It cannot produce a false green, because
 * a mis-attributed ancestor still yields SOME pairing to measure; the failure mode points the wrong
 * way rather than pointing nowhere, and that is the direction a check is allowed to be wrong in.
 *
 * A variable reference (`${presentation.className}`) expands to the UNION of every className
 * template in the file, deliberately. A presentation helper returns one branch of several and any
 * of them can be the background at runtime, so the union is what the file can actually compose.
 */
const TOKEN_REF = /\$\{([A-Z][A-Z_]*)\.([A-Za-z_$][\w$]*)\}/g;
const VAR_REF = /\$\{[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\}/g;

/** Every className template literal in a file, with its offset and indentation. */
const classNameSites = (src) => {
  const sites = [];
  for (const m of src.matchAll(/className=(?:\{`([^`]*)`\}|"([^"]*)")/g)) {
    const body = m[1] ?? m[2] ?? '';
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    const indent = src.slice(lineStart).match(/^[ \t]*/)[0].length;
    sites.push({ body, index: m.index, indent, line: src.slice(0, m.index).split('\n').length });
  }
  return sites;
};

/** Token refs a template body names directly, as {map, key} pairs. */
const refsIn = (body) => [...body.matchAll(TOKEN_REF)].map((m) => ({ map: m[1], key: m[2] }));

/** Is this text large enough for AA's relaxed ratio? 18px, or 14px carrying real weight. */
const isLargeText = (body) => {
  const bold = /font-(bold|extrabold|black|semibold)/.test(body);
  if (/text-(lg|xl|2xl|3xl|4xl)\b/.test(body)) return true;
  const px = [...body.matchAll(/text-\[(\d+)px\]/g)].map((m) => Number(m[1]));
  if (px.some((n) => n >= 18)) return true;
  if (bold && (px.some((n) => n >= 14) || /text-base\b/.test(body))) return true;
  return false;
};

export const run = async ({ root }) => {
  const files = P5_SURFACE_DIRS.flatMap((d) => walk(join(root, d)));
  if (files.length === 0) {
    return fail('no P5 surface files found — an accessibility sweep over zero files is the vacuous pass §2 rule 5 refuses');
  }

  const problems = [];
  let carriersChecked = 0;
  const seenCarriers = new Set();
  let carrierInstances = 0;

  for (const abs of files) {
    const rel = abs.slice(root.length + 1).replace(/\\/g, '/');
    const src = stripComments(readFileSync(abs, 'utf8'));

    /* 1. EVERY STATE CARRIER HAS A NON-COLOUR CUE. */
    for (const carrier of STATE_CARRIERS) {
      if (!src.includes(carrier.needle)) continue;
      if (seenCarriers.has(carrier.needle)) continue;
      seenCarriers.add(carrier.needle);
      carriersChecked += 1;
      const cueFile = join(root, carrier.where);
      if (!existsSync(cueFile)) {
        problems.push(rel + ' renders ' + carrier.what + ' but ' + carrier.where + ', where its cue belongs, does not exist');
        continue;
      }
      const cueSrc = readFileSync(cueFile, 'utf8');
      const renders = (cueSrc.match(carrier.renders) ?? []).length;
      const cues = (cueSrc.match(carrier.cues) ?? []).length;
      if (renders === 0) {
        problems.push(
          carrier.where + ' renders ' + carrier.what + ' zero times by the pattern this gate looks for, '
            + 'so the cue count would be compared against nothing — the declaration has gone stale',
        );
      } else if (cues < renders) {
        problems.push(
          carrier.where + ' renders ' + carrier.what + ' ' + renders + ' time(s) but gives only ' + cues
            + ' cue(s) that survive the colour being removed. Its colour MEANS something, and a person '
            + 'who cannot distinguish the hues loses the information entirely while a screen reader '
            + 'never had it',
        );
      }
      carrierInstances += renders;
    }

    /* 2. TOUCH TARGETS ≥ 44pt, wherever a min-h is declared on something pressable. */
    if (/<Pressable/.test(src)) {
      const mins = [...src.matchAll(/min-h-\[(\d+)px\]/g)].map((m) => Number(m[1]));
      const tooSmall = mins.filter((n) => n < 44);
      if (tooSmall.length) {
        problems.push(rel + ' declares a touch target of ' + Math.min(...tooSmall) + 'pt on a pressable — R3 says at least 44');
      }
    }

    /*
     * 3. BODY TEXT ≥ 16pt — P2's RULE, BECAUSE P2 ALREADY GOT THIS RIGHT.
     *
     * From tools/p2/gates/a11y.mjs: "text-xs is 12px and text-sm is 14px. Both are legitimate for
     * labels, captions and chips and neither is body text, so this checks the explicit arbitrary
     * sizes — text-[13px] is somebody choosing a number, and a number below 16 that is not a
     * caption is a reading problem."
     *
     * My first version flagged every text-sm sitting near a TEXT.body class — which is a COLOUR
     * token, not a type role. It reported twenty-five failures across every P5 surface, all of them
     * correct code, because it read a colour name as a claim about size.
     */
    /* A9's floor is 12, not 16: it treats 12-15 as legitimate caption sizes and refuses anything
       below that even for a caption. R3 uses the SAME number rather than inventing a second
       interpretation of the same rule — two thresholds for one property is how they drift. */
    for (const m of src.matchAll(/text-\[(\d+)px\]/g)) {
      if (Number(m[1]) < 12) {
        problems.push(rel + ' chooses a text size of ' + m[1] + 'px — below 16, and a chosen number is not a caption');
      }
    }
  }

  /*
   * 4. AA CONTRAST OVER THE PAIRINGS P5 COMPOSES.
   *
   * The first version of this clause matched a foreground and a background class inside one
   * className string with a regex. It resolved ZERO pairings and printed OK — because these files
   * write colour as \${TEXT.body} and \${ROLE_TEXT.advisory} interpolations, and because text almost
   * never carries its own background anyway. A clause measuring nothing while reporting a pass is
   * the vacuous green §2 rule 5 refuses, and it survived one run of this gate before being caught.
   */
  const tokensPath = join(root, TOKEN_MODULE);
  if (!existsSync(tokensPath)) {
    return fail(TOKEN_MODULE + ' does not exist, so the \${TOKEN} interpolations these surfaces write cannot be resolved to colours — and an unresolvable contrast check measures nothing while still being able to print OK');
  }
  const tokenSrc = readFileSync(tokensPath, 'utf8');
  const MAPS = {};
  for (const name of TOKEN_MAPS) {
    MAPS[name] = readTokenMap(tokenSrc, name);
    if (!MAPS[name]) return fail('could not read ' + name + ' out of ' + TOKEN_MODULE);
  }
  const custom = customPalette(root, TOKEN_MODULE);

  let pairingsChecked = 0;
  const composed = new Set();

  for (const abs of files) {
    const rel = abs.slice(root.length + 1).replace(/\\/g, '/');
    const src = stripComments(readFileSync(abs, 'utf8'));
    const sites = classNameSites(src);
    if (sites.length === 0) continue;

    /* Every className template in this file, for expanding a variable reference to its union. */
    const fileBg = [], fileFg = [];
    for (const site of sites) {
      for (const r of refsIn(site.body)) {
        if (r.map === 'SURFACE' || r.map === 'ROLE_SURFACE_BG') fileBg.push(r);
        if (r.map === 'TEXT' || r.map === 'ROLE_TEXT') fileFg.push(r);
      }
    }

    const stack = [];
    for (const site of sites) {
      while (stack.length && stack[stack.length - 1].indent >= site.indent) stack.pop();

      const own = refsIn(site.body);
      let bgHere = own.filter((r) => r.map === 'SURFACE' || r.map === 'ROLE_SURFACE_BG');
      /* A variable reference can be any className the file builds — so it can be any background. */
      if (bgHere.length === 0 && VAR_REF.test(site.body.replace(TOKEN_REF, ''))) bgHere = fileBg;
      if (bgHere.length) stack.push({ indent: site.indent, bgs: bgHere });

      let fgHere = own.filter((r) => r.map === 'TEXT' || r.map === 'ROLE_TEXT');
      if (fgHere.length === 0 && /text-/.test(site.body)
          && VAR_REF.test(site.body.replace(TOKEN_REF, ''))) fgHere = fileFg;
      if (fgHere.length === 0) continue;

      const bgs = stack.length ? stack[stack.length - 1].bgs : [];
      if (bgs.length === 0) continue;
      const large = isLargeText(site.body);
      const floor = large ? AA_LARGE : AA_BODY;

      for (const fg of fgHere) {
        for (const bg of bgs) {
          const fgClasses = MAPS[fg.map]?.[fg.key];
          const bgClasses = MAPS[bg.map]?.[bg.key];
          if (!fgClasses || !bgClasses) continue;
          const f = splitModes(fgClasses), b = splitModes(bgClasses);
          for (const mode of ['light', 'dark']) {
            const fgClass = pick(f[mode], 'text') ?? pick(f.light, 'text');
            const bgClass = pick(b[mode], 'bg') ?? pick(b.light, 'bg');
            if (!fgClass || !bgClass) continue;
            const fgHex = hexForClass(fgClass, custom);
            const bgHex = hexForClass(bgClass, custom);
            if (!fgHex || !bgHex) continue;
            pairingsChecked += 1;
            composed.add(fg.map + '.' + fg.key + ' on ' + bg.map + '.' + bg.key);
            const ratio = contrastRatio(fgHex, bgHex);
            if (ratio < floor) {
              problems.push(
                rel + ':' + site.line + ' composes ' + fg.map + '.' + fg.key + ' on ' + bg.map + '.'
                  + bg.key + ' (' + mode + ') at ' + ratio.toFixed(2) + ':1, below AA '
                  + (large ? 'large ' : 'body ') + floor + ':1. No token declares this pairing, so A9 '
                  + 'does not measure it — the screen composes it',
              );
            }
          }
        }
      }
    }
  }

  if (pairingsChecked === 0) {
    return fail('resolved 0 composed pairings across ' + files.length + ' P5 surface file(s) — these screens demonstrably set colour through \${TOKEN} interpolations, so zero means the resolver is broken, and a contrast check that measures nothing would pass forever');
  }

  /*
   * A DECLARED CARRIER THAT MATCHES NOTHING IS A BROKEN DECLARATION, NOT A PASS.
   *
   * The first version declared five carriers and quietly checked four. Its needle for the calendar
   * risk marker was 'marker-risk', and the testID is built as `...-marker-${marker.kind}`, so the
   * literal never appears in the source and the most important carrier on the calendar — the one K2
   * exists for — was silently outside the sweep while this gate printed OK.
   *
   * Counting the carriers found is not enough, because four of five still looks like work. Each
   * declared carrier must be LOCATED, or the declaration is stale and the gate is measuring less
   * than it claims.
   */
  const missing = STATE_CARRIERS.filter((c) => !seenCarriers.has(c.needle));
  if (missing.length) {
    return fail(
      'declared state carrier(s) that match nothing on any P5 surface: '
        + missing.map((c) => c.what + ' (looked for "' + c.needle + '")').join(', ')
        + '. A carrier this gate cannot find is a carrier it cannot check, and a sweep that silently '
        + 'covers less than it declares is the quiet form of the vacuous pass',
    );
  }

  if (carriersChecked === 0) {
    return fail('no state carrier was found on any P5 surface — R3 would then be asserting nothing about the clause it exists for (§2 rule 5)');
  }
  if (problems.length) return fail(problems.join(' · '));

  return ok(SENTINEL, [
    'CRITERION R3 — static accessibility, over ' + files.length + ' P5 surface file(s).',
    carriersChecked + ' state carrier(s) checked across ' + carrierInstances + ' rendered instance(s), each',
    '  with a cue that is not its colour. The cues are COUNTED per instance, not looked for once per file:',
    '  DayMarkers renders three markers, and a file-level question still answers yes after two of their',
    '  cues are deleted — so the contract\'s own control, "make one risk dot colour-only", could not',
    '  have fired it. "State carrier" is the phrase doing the work: not every coloured thing, but every',
    '  element whose colour MEANS something.',
    'Touch targets at 44pt or more, and no body copy below 16pt.',
    pairingsChecked + ' COMPOSED colour pairing(s) measured against AA, across ' + composed.size + ' distinct',
    '  token combination(s) these screens actually build. This is the population A9 cannot reach: A9',
    '  measures what the design system DECLARES — LEGIBLE_ON, and each role text on its own role',
    '  background, 44 pairings — but it never opens a screen file. HomeRiskStrip puts ROLE_TEXT.neutral',
    '  inside a pressable whose background is one of four ROLE_SURFACE_BG branches, and no token',
    '  declares neutral-on-danger, so nothing measured it until this did.',
    'The arithmetic and the token parsing are P2\'s, imported from tools/p2/lib/ — what is P5\'s here is',
    '  the POPULATION, not the maths. An earlier version of this clause matched fg and bg classes',
    '  inside one className string, resolved ZERO pairings, and printed OK.',
  ].join('\n'));
};
