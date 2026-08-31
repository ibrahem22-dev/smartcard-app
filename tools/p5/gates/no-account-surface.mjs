/**
 * GATE: no-account-surface — criterion U5.  →  `NO-ACCOUNT-SURFACE OK`
 *
 *   > **U5.** *"No login, account, OTP or email appears on any P5 surface, derived by sweeping the
 *   > rendered surfaces."*
 *
 * MEASURES: 'source'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "DERIVED BY SWEEPING THE RENDERED SURFACES" IS PART OF THE CRITERION, NOT ADVICE
 *
 * U5 says how to measure it. The population is what the five P5 routes actually reach — walked, the
 * way `B1` walks it — and not a directory somebody remembered to include. An account screen added
 * next month lands in a folder this file was never told about, and a hand-listed sweep would report
 * clean.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY A LOCAL-FIRST APP HAS A CRITERION ABOUT THIS AT ALL
 *
 * Because the pull is constant and each step is individually reasonable. A profile needs a name; a
 * name wants an email; an email wants verification; verification wants an OTP; and an OTP wants an
 * account. Nobody decides to add authentication — it arrives one sensible field at a time, and by
 * then the product stores an identity it never needed and inherits every obligation that comes with
 * one.
 *
 * Spec §18-A and the deferral table put accounts and OTP at V2+. U5 is the tripwire on the first
 * step, which is why it names four things rather than one: the last of them, `email`, is the one
 * that looks harmless.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IT DELIBERATELY DOES NOT FLAG
 *
 * `phoneNumber` exists on `UserProfile` and is collected at onboarding — P4's, not P5's, and
 * `no-account-surface` is about P5 SURFACES rather than about the profile type. Onboarding is
 * outside the walk by construction, and this gate says so rather than quietly excluding it.
 *
 * NEGATIVE CONTROL: put an email field on a P5 surface and watch this fail.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['U5'];
export const SENTINEL = 'NO-ACCOUNT-SURFACE OK';
export const MEASURES = 'source';

const IA = 'src/navigation/ia.ts';
const STACKS = 'src/navigation/stacks';
const POPULATION = 'src/surfaces/__tests__/derivedPopulation.ts';

/** P4's, and outside P5's walk by construction. Named so the scope is visible. */
/*
 * OUTSIDE THE SWEEP, AND WHY — INCLUDING ONE THAT LOOKS LIKE A HIT AND IS NOT.
 *
 * The first four are earlier phases' screens, measured by their own gates.
 *
 * `src/navigation/` is different and worth naming. Every P5 screen imports route types from it, so
 * the walk reaches it — and `src/navigation/types.ts` declares `OTPVerify: { email: string }`.
 * That looks exactly like the thing U5 forbids. It is not:
 *
 *   · it is a TYPE declaration and renders nothing;
 *   · **no screen is mounted at that route and nothing navigates to it** — checked, not assumed;
 *   · it arrived in a P3-era commit called "fence deferred scope out of the MVP surface", which is
 *     the opposite of adding an OTP flow — it is the record of one being fenced off.
 *
 * U5 asks what APPEARS ON a P5 surface. A dead route type appears on nothing. So navigation is
 * outside the sweep, and this paragraph exists so the exclusion reads as a judgement somebody made
 * rather than a folder somebody skipped. If a screen is ever mounted at that route, it lands under
 * src/screens and the sweep sees it.
 */
const NOT_OURS = ['src/check/', 'src/screens/check/', 'src/screens/fx/', 'src/screens/addCard/', 'src/screens/onboarding/', 'src/navigation/'];

/** The four U5 names, each with why it is on the list. */
const ACCOUNT_SURFACE = [
  [/\b(signIn|signUp|logIn|login|logout|signOut)\b/i, 'a login affordance'],
  [/\b(createAccount|myAccount|accountScreen|accountSettings)\b/i, 'an account surface'],
  [/\b(otp|oneTimeCode|verificationCode)\b/i, 'an OTP'],
  [/\b(email|emailAddress)\b/i, 'an email field — the one on this list that looks harmless, and the first step'],
];

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * THE ONE EXEMPTION, AND WHY IT IS NOT A HOLE — OQ-MDC-006, ruled by the Owner 2026-08-31.
 *
 * U5 forbids four things and the fourth is `email`, "the one on this list that looks harmless".
 * The reason it is on the list is ACCOUNT CREEP: a profile needs a name, a name wants an email, an
 * email wants verification, verification wants an OTP, and an OTP wants an account, and Spec §18-A
 * puts all of that at V2+. Every word of that still stands.
 *
 * What C6 renders is the opposite of it. `contacts` in the shipped content pack carries each
 * issuer's OWN PUBLISHED complaints address as a SourcedValue, beside its customer-service phone
 * and its lost-or-stolen line. It is read at runtime through the adapter and displayed. There is
 * no input, no store, no verification, no identity, and nothing the user can type. Withholding it
 * would mean the app knowingly hiding a published complaints channel from someone trying to
 * complain — and §2.7's rule is that an absence must never read as "we did not look".
 *
 * So the exemption is for an ISSUER-PUBLISHED CONTACT VALUE, and it is deliberately narrow:
 *
 *   · it applies ONLY to the translation files, and ONLY to the line carrying the label named
 *     below. Any other `email` anywhere in them still fails, and so does any `email` in any other
 *     swept module — a signup field one folder away is untouched by this;
 *   · it is VERIFIED LIVE, not asserted. The adapter must still publish the field, and the Learn
 *     screen must still render it. If either stops being true the exemption is STALE and this gate
 *     FAILS rather than quietly permitting a string nothing justifies any more. That is the rule
 *     the E1 register already applies to its own dispositions: an entry that covers nothing is a
 *     hard failure, because it would silently cover the next thing of the same shape.
 */
const ISSUER_CONTACT_EXEMPTION = {
  files: /^src\/i18n\/(en|ar|he)\.ts$/,
  /** The label, as it is keyed in the translation maps. */
  labelKey: 'דוא״ל לתלונות',
  /** The adapter field that is the whole justification. No field, no exemption. */
  adapterField: 'complaintsEmail',
  /** Where it is rendered, and the list it is rendered from. */
  renderedBy: 'src/screens/LearnScreen.tsx',
  adapterTypes: 'node_modules/@smartcard/data-authority-adapter/adapter/read-secondary.d.ts',
};

/** Is this occurrence the exempted issuer-contact label, on its own line? */
const isExemptOccurrence = (rel, src, index) => {
  if (!ISSUER_CONTACT_EXEMPTION.files.test(rel)) return false;
  const from = src.lastIndexOf('\n', index) + 1;
  const to = src.indexOf('\n', index);
  const line = src.slice(from, to === -1 ? src.length : to);
  return line.includes(ISSUER_CONTACT_EXEMPTION.labelKey);
};

const resolveSpecifier = (fromFile, spec) => {
  const base = resolve(dirname(fromFile), spec);
  for (const c of [base, base + '.ts', base + '.tsx', join(base, 'index.ts'), join(base, 'index.tsx')]) {
    try { if (statSync(c).isFile()) return c; } catch { /* next */ }
  }
  return null;
};

export const run = async ({ root }) => {
  for (const rel of [IA, POPULATION]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — U5\'s population cannot be derived');
  }

  /* The five entry modules, the same way B1 finds them. */
  const stackDir = join(root, STACKS);
  if (!existsSync(stackDir)) return fail(STACKS + ' does not exist');
  const imports = new Map();
  const routes = new Map();
  for (const f of readdirSync(stackDir).filter((n) => n.endsWith('.tsx'))) {
    const abs = join(stackDir, f);
    const src = readFileSync(abs, 'utf8');
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
      for (const name of m[1].split(',').map((x) => x.trim()).filter(Boolean)) {
        const t = resolveSpecifier(abs, m[2]);
        if (t) imports.set(name, t);
      }
    }
    for (const m of src.matchAll(/<Stack\.Screen\b([^>]*)\/>/g)) {
      const name = (m[1].match(/name="([^"]+)"/) ?? [])[1];
      const comp = (m[1].match(/component=\{([A-Za-z0-9_]+)\}/) ?? [])[1];
      if (name && comp) routes.set(name, comp);
    }
  }
  const cardDnaRoute = (readFileSync(join(root, POPULATION), 'utf8').match(/CARD_DNA_ROUTE\s*=\s*'([^']+)'/) ?? [])[1];
  const wanted = ['HomeScreen', 'CardsScreen', routes.get(cardDnaRoute ?? ''), 'CalendarScreen', 'CommitmentsScreen'].filter(Boolean);

  const seen = new Set();
  const queue = wanted.map((n) => imports.get(n)).filter(Boolean);
  if (queue.length === 0) return fail('no P5 entry module resolved — the sweep would run over nothing (§2 rule 5)');

  const unresolved = [];
  while (queue.length) {
    const file = queue.pop();
    const key = file.slice(root.length + 1).replace(/\\/g, '/');
    if (seen.has(key)) continue;
    seen.add(key);
    let src;
    try { src = readFileSync(file, 'utf8'); } catch { continue; }
    for (const m of stripComments(src).matchAll(/from\s+'(\.[^']*)'/g)) {
      const t = resolveSpecifier(file, m[1]);
      if (!t) { unresolved.push(key + ' → ' + m[1]); continue; }
      queue.push(t);
    }
  }
  if (unresolved.length) {
    return fail('the walk could not resolve ' + unresolved.length + ' import(s), so the graph swept is not the graph that ships: ' + unresolved.slice(0, 3).join(' · '));
  }

  const ours = [...seen].filter((p) => !NOT_OURS.some((n) => p.startsWith(n)));
  const problems = [];

  /**
   * THE EXEMPTION MUST STILL BE JUSTIFIED, CHECKED BEFORE IT IS APPLIED.
   *
   * Both halves are required: the pipeline must still publish the field, and the app must still
   * render it. Either one going away makes the exemption a hole nobody is watching, so it is a
   * hard failure rather than a silent permission.
   */
  const ex = ISSUER_CONTACT_EXEMPTION;
  const typesPath = join(root, ex.adapterTypes);
  const rendererPath = join(root, ex.renderedBy);
  const adapterPublishes = existsSync(typesPath)
    && new RegExp('\\b' + ex.adapterField + '\\b').test(readFileSync(typesPath, 'utf8'));
  const appRenders = existsSync(rendererPath)
    && new RegExp('\\b' + ex.adapterField + '\\b').test(readFileSync(rendererPath, 'utf8'));
  if (!adapterPublishes || !appRenders) {
    problems.push(
      'the U5 issuer-contact exemption (OQ-MDC-006) is STALE: '
        + (!adapterPublishes
          ? 'the published adapter no longer declares ' + ex.adapterField + ' in ' + ex.adapterTypes
          : ex.renderedBy + ' no longer renders ' + ex.adapterField)
        + '. An exemption that outlives its reason would silently cover the next email field of the '
        + 'same shape — remove it, or restore what justified it',
    );
  }

  let exempted = 0;
  for (const rel of ours) {
    const src = stripComments(readFileSync(join(root, rel), 'utf8'));
    for (const [re, why] of ACCOUNT_SURFACE) {
      const all = [...src.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))];
      if (all.length === 0) continue;
      /* Only the exempted label is dropped, and only when the exemption is still justified. Every
         other occurrence in the same file is still a hit, which is what keeps this narrow. */
      const live = adapterPublishes && appRenders
        ? all.filter((h) => !isExemptOccurrence(rel, src, h.index))
        : all;
      exempted += all.length - live.length;
      if (live.length > 0) {
        problems.push(
          rel + ' carries ' + why + ' ("' + live[0][0] + '"). Nobody decides to add authentication — a profile needs a '
            + 'name, a name wants an email, an email wants verification, verification wants an OTP, and an OTP wants '
            + 'an account. Spec §18-A puts all of it at V2+',
        );
        break;
      }
    }
  }

  if (problems.length) return fail(problems.join(' · '));

  return ok(SENTINEL, [
    'CRITERION U5 — no account surface, over ' + ours.length + ' P5 module(s) WALKED from the five routes.',
    'The population is derived by sweeping what the routes actually reach, which is what U5 itself',
    '  says to do — an account screen added next month lands in a folder a hand-listed sweep was never',
    '  told about, and would report clean.',
    'None of the four things U5 names appears: a login affordance, an account surface, an OTP, or an',
    '  email field. They are four rather than one because the pull is constant and every step is',
    '  individually reasonable — a profile needs a name, a name wants an email, an email wants',
    '  verification, verification wants an OTP, and an OTP wants an account. The product would end up',
    '  storing an identity it never needed, one sensible field at a time.',
    'Two things this does NOT flag, both deliberately. src/navigation/types.ts declares an OTPVerify',
    '  route carrying an email — a TYPE with no screen mounted at it and nothing navigating to it,',
    '  added by a P3-era commit that FENCED deferred scope. A dead route type appears on no surface.',
    'And phoneNumber on UserProfile, collected at onboarding, which',
    '  is P4\'s and outside the walk by construction. U5 is about P5 SURFACES, not about the type.',
    'ONE NARROW EXEMPTION IS IN FORCE, ruled in OQ-MDC-006 and re-justified on this run: '
      + exempted + ' occurrence(s) of the label "' + ISSUER_CONTACT_EXEMPTION.labelKey + '" in the',
    '  translation maps, which render the issuer\'s OWN PUBLISHED complaints address from the content',
    '  pack — read through the adapter, never collected, never stored. It is verified live rather than',
    '  asserted: the adapter still declares ' + ISSUER_CONTACT_EXEMPTION.adapterField + ' and '
      + ISSUER_CONTACT_EXEMPTION.renderedBy + ' still renders it,',
    '  and this gate FAILS if either stops being true. Every other email anywhere in the swept graph,',
    '  including anywhere else in those same files, is still a hit.',
    (seen.size - ours.length) + ' module(s) belonging to earlier phases were reached and skipped.',
  ].join('\n'));
};
