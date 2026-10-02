/**
 * SmartCard architecture-boundary lint — TASK E1, DIAGNOSTIC ONLY.
 *
 * This file is a STANDALONE ESLint configuration. It is deliberately NOT
 * referenced by `.eslintrc.json`, `package.json` scripts, or CI. The app's main
 * gate (`eslint src --ext .ts,.tsx,.js --max-warnings=0`) is untouched by it and
 * keeps passing exactly as before. Running this config produces the P2/P3
 * boundary-cleanup backlog; it is not a build gate yet.
 *
 * Invocation (ESLint 8.57.1 is installed; flat config is opt-in in v8):
 *
 *   ESLINT_USE_FLAT_CONFIG=true npx eslint --config .eslintrc.boundaries.js src
 *
 * WHY FLAT CONFIG AND NOT ESLINTRC FORMAT
 * `.eslintrc`-format files can only name plugins as strings resolved from
 * node_modules, so the five rules below would have to ship as an installed
 * `eslint-plugin-*` package — and E1 forbids adding dependencies. Flat config
 * accepts a plugin object defined inline, which lets the five rules live in this
 * one file with zero new dependencies. Parser, ecmaVersion, sourceType and the
 * JSX flag are copied verbatim from `.eslintrc.json` so both configs read the
 * same code the same way.
 *
 * The five rules are the SmartCard boundaries as specified for E1:
 *   R1  engines/** may not import UI or a network module.
 *   R2  the consumer layer may not calculate — no math/calculation utility,
 *       no engine internals, only engine result types.
 *   R3  only the data adapter may import a pack / raw JSON dataset / local DB
 *       driver.
 *   R4  no rate/fee/percentage/threshold literal outside config/** and the packs.
 *   R5  no vault/financial value may reach a `track(...)` analytics call.
 */

'use strict';

const path = require('path');

const tsParser = require('@typescript-eslint/parser');
// Registered for its rule DEFINITIONS only — no @typescript-eslint rule is
// enabled below. Without it, the handful of `/* eslint-disable
// @typescript-eslint/... */` comments already present in src/ would each be
// reported as "Definition for rule ... was not found" and pollute the report.
const tsPlugin = require('@typescript-eslint/eslint-plugin');

const REPO_ROOT = __dirname;

// ---------------------------------------------------------------------------
// LAYER MAP
//
// The E1 boundary spec is written against a target architecture (`ui/**`,
// `data/adapter/**`, `config/**`, `engines/**/internal/**`). Three of those
// directories do not exist in this inherited codebase. This block is the single
// place where the spec vocabulary is mapped onto the directories that DO exist;
// a later relocation task should only need to edit this block.
//
// Where a spec path has no counterpart yet, the rule is still armed against the
// FUTURE path so it binds the moment that path is created, and the report says
// plainly that it currently matches nothing (an UNKNOWN must never read as a
// PASS).
// ---------------------------------------------------------------------------

/** Pure financial logic. */
const ENGINES = 'src/engines/';

/**
 * The consumer layer. The spec says `ui/**`, `screens/**`, `components/**`;
 * `src/ui/` does not exist here, and `src/navigation/` is presentation too.
 */
const UI_PREFIXES = ['src/screens/', 'src/components/', 'src/navigation/'];

/**
 * Hooks are the sanctioned screen→engine mediator, so they are NOT "UI" for the
 * engine-import clause of R2. They ARE in scope for R2's calculation clauses:
 * a hook may call an engine, but it may not be where the calculation lives.
 */
const HOOKS = 'src/hooks/';

/**
 * R3 ADAPTER PATH — JUDGMENT CALL, stated plainly (see report).
 * The spec's `data/adapter/**` does not exist. `src/authority/` is the nearest
 * existing equivalent: it holds `DataAuthorityAdapter.ts`, and
 * `nonAuthorityDataAccess.ts` already encodes "bundled data may only be read
 * through the authority". `src/data/` was rejected as the permitted importer
 * because it IS the pack directory — letting the packs import themselves would
 * make the rule vacuous.
 */
const DATA_ADAPTER = 'src/authority/';

/** The pack directory itself (raw datasets — read-only at runtime). */
const PACKS = 'src/data/';

/**
 * R4's permitted home for tunable financial numbers. DOES NOT EXIST YET —
 * nothing can currently satisfy R4 by relocation, which is why every R4 finding
 * is a backlog item rather than a quick fix.
 */
const CONFIG = 'src/config/';

/** R2's "engine non-public surface". No engine has an internal/ dir yet. */
const ENGINE_INTERNAL = /^src\/engines\/.*\/internal\//;

/**
 * The encrypted user vault. R3's local-DB-driver clause permits the driver here
 * as well as in the adapter: AGENTS.md §3 makes `src/security/keyVault.ts` the
 * sole owner of the DEK and of at-rest storage, and that ownership is a security
 * constraint that outranks the data-access boundary.
 */
const VAULT = 'src/security/';

/** Local persistence drivers — the "local DB driver" of R3. */
const LOCAL_DB_DRIVERS = [
  'react-native-mmkv',
  'expo-sqlite',
  'react-native-sqlite-storage',
  'op-sqlite',
];

/** Network modules — an engine that imports one of these is not offline-pure. */
const NETWORK_MODULES = [
  /^axios$/,
  /^node-fetch$/,
  /^cross-fetch$/,
  /^@supabase\//,
  /^superagent$/,
  /^got$/,
  /^ky$/,
];

/** UI runtime / native / state packages an engine may never import. */
const NON_ENGINE_PACKAGES = [
  /^react$/,
  /^react-dom$/,
  /^react-native$/,
  /^react-native\//,
  /^react-native-/,
  /^expo$/,
  /^expo-/,
  /^@expo\//,
  /^@react-navigation\//,
  /^nativewind/,
  /^zustand/,
  /^tailwindcss/,
];

/**
 * Calculation utilities: modules that perform or gate financial arithmetic and
 * therefore belong behind an engine, not in a screen or a hook.
 */
const CALC_UTILS = [
  {
    module: 'src/utils/monetary',
    what: 'monetary bounds + validity predicate — a calculation gate',
  },
  {
    module: 'src/utils/parseAmount',
    what: 'monetary input normalisation',
  },
  {
    // resolveFxAbroad / matchCardToFxSlug are engine-grade pure functions that
    // happen to live in a hook file. Every importer of them is importing a
    // calculation utility from outside src/engines/.
    module: 'src/hooks/useFxAbroad',
    what: 'FX-rate resolution (engine-grade calculation living in src/hooks/)',
  },
];

// --- naming heuristics -----------------------------------------------------

/**
 * Identifier words that mark a value as a rate / fee / percentage / threshold.
 *
 * Matched against TOKENS, not raw substrings: `saturation` contains "ratio" and
 * `payload` contains "load", and both are false positives a substring match
 * cannot avoid. `tokenize` below splits camelCase and SNAKE_CASE into words.
 */
const FINANCIAL_WORDS = new Set([
  'rate',
  'rates',
  'fee',
  'fees',
  'pct',
  'percent',
  'percentage',
  'commission',
  'commissions',
  'threshold',
  'thresholds',
  'ratio',
  'ratios',
  'buffer',
  'utilization',
  'utilisation',
  'interest',
  'apr',
  'score',
  'scores',
  'ladder',
  'penalty',
  'premium',
  'discount',
  'cashback',
  'load',
  'apy',
  'yield',
]);

/** Words that make a number visual, temporal or structural — not financial. */
const NON_FINANCIAL_WORDS = new Set([
  'opacity',
  'width',
  'height',
  'size',
  'radius',
  'elevation',
  'zindex',
  'flex',
  'margin',
  'padding',
  'top',
  'left',
  'right',
  'bottom',
  'duration',
  'delay',
  'timeout',
  'interval',
  'lineheight',
  'letterspacing',
  'shadow',
  'offset',
  'scale',
  'rotate',
  'translate',
  'column',
  'columns',
  'row',
  'rows',
  'maxlength',
  'numberoflines',
  'index',
  'count',
  'length',
  'version',
  'port',
  'day',
  'month',
  'year',
  'hour',
  'minute',
  'second',
  'tabbar',
  'icon',
  'blur',
  'spring',
  'friction',
  'tension',
  'velocity',
  'digit',
  'digits',
  'decimal',
  'decimals',
  'precision',
  'attempt',
  'attempts',
  'retry',
  'step',
  'page',
  'slot',
  'hue',
  'saturation',
  'lightness',
  'color',
  'colour',
  'bytes',
  'px',
  'ms',
]);

/** Split an identifier into lowercase words: `warningBufferRatio` → 3 words. */
const tokenize = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+|\s+/)
    .filter((word) => word !== '')
    .map((word) => word.toLowerCase());

const isFinancialName = (name) => {
  const words = tokenize(name);
  return (
    words.some((word) => FINANCIAL_WORDS.has(word)) &&
    !words.some((word) => NON_FINANCIAL_WORDS.has(word))
  );
};

const isNonFinancialName = (name) =>
  tokenize(name).some((word) => NON_FINANCIAL_WORDS.has(word));

/** CSS colour / dimension values — never a financial threshold. */
const CSS_VALUE = /\b(hsla?|rgba?|var|linear-gradient|radial-gradient)\s*\(/i;

/** A bare `100%` / `0.0%` string is a VALUE, not copy that quotes a rule. */
const BARE_PERCENT = /^\s*\d{1,3}(?:[.,]\d+)?\s*%\s*$/;

/** FX-specific names — used by R2's inline-calculation clause. */
const FX_NAME =
  /(commission|foreignexchange|foreigntransactionfee|fxpurchase|fxcash|fxpercent|fxrate|exchangefee)/i;

/** Vault-grade values §9 forbids from crossing any outbound boundary. */
const VAULT_VALUE_NAME =
  /(balance|income|cardnumber|card_number|^pan$|userid|user_id|^dek$|^pin$|salt|pepper|verifier|secret|token|vault|obligation|installmentplan|creditlimit|monthlypayment)/i;

/** Analytics sinks. R5 is about `track(...)` and its close relatives. */
const ANALYTICS_CALLEE =
  /^(track|trackEvent|logEvent|capture|captureEvent|identify|recordEvent)$/;

/**
 * Method calls whose numeric arguments are formatting or slicing parameters,
 * never financial values. R4's explicit exception list, part 1 — see also the
 * `allowlist` option passed to R4 at the bottom of this file.
 */
const FORMATTING_CALLEES = new Set([
  'toFixed',
  'toPrecision',
  'toLocaleString',
  'slice',
  'substring',
  'substr',
  'padStart',
  'padEnd',
  'repeat',
  'split',
  'charAt',
  'setTimeout',
  'setInterval',
  'parseInt',
  'parseFloat',
]);

// ---------------------------------------------------------------------------
// Path helpers — every rule keys off a repo-relative POSIX path.
// ---------------------------------------------------------------------------

const toPosix = (value) => value.split(path.sep).join('/').split('\\').join('/');

const relPath = (context) =>
  toPosix(path.relative(REPO_ROOT, context.filename ?? context.getFilename()));

const isTestFile = (file) =>
  file.includes('/__tests__/') || /\.test\.tsx?$/.test(file);

const startsWithAny = (file, prefixes) =>
  prefixes.some((prefix) => file.startsWith(prefix));

/** Repo-relative target of a relative import specifier, or null if external. */
function resolveLocal(file, spec) {
  if (!spec.startsWith('.')) {
    return null;
  }
  const absolute = path.resolve(path.dirname(path.join(REPO_ROOT, file)), spec);
  return toPosix(path.relative(REPO_ROOT, absolute));
}

/** Drops a trailing extension so `x/y.ts` and `x/y` compare equal. */
const stripExt = (value) => value.replace(/\.(tsx?|jsx?)$/, '');

const matchesAny = (spec, patterns) => patterns.some((re) => re.test(spec));

/**
 * Every module specifier in a file, with the information the rules need:
 * `typeOnly` matters because R2 permits a type-only import from an engine
 * ("only the engines' public result types") while forbidding a value import.
 */
function importVisitors(handle) {
  const fromDeclaration = (node) => {
    if (node.source === null || node.source === undefined) {
      return;
    }
    const specifiers = node.specifiers ?? [];
    const allSpecifiersAreTypes =
      specifiers.length > 0 &&
      specifiers.every((spec) => spec.importKind === 'type');
    handle({
      node,
      spec: node.source.value,
      typeOnly: node.importKind === 'type' || allSpecifiersAreTypes,
      form: node.type === 'ImportDeclaration' ? 'import' : 're-export',
    });
  };

  return {
    ImportDeclaration: fromDeclaration,
    ExportNamedDeclaration: fromDeclaration,
    ExportAllDeclaration: fromDeclaration,
    TSImportEqualsDeclaration(node) {
      const ref = node.moduleReference;
      if (
        ref !== undefined &&
        ref.type === 'TSExternalModuleReference' &&
        ref.expression.type === 'Literal'
      ) {
        handle({
          node,
          spec: String(ref.expression.value),
          typeOnly: false,
          form: 'import=',
        });
      }
    },
    'CallExpression, ImportExpression'(node) {
      const arg = node.arguments?.[0] ?? node.source;
      if (arg === undefined || arg === null || arg.type !== 'Literal') {
        return;
      }
      if (typeof arg.value !== 'string') {
        return;
      }
      const callee = node.callee;
      const isRequire =
        callee !== undefined &&
        callee !== null &&
        callee.type === 'Identifier' &&
        callee.name === 'require';
      const isDynamic = node.type === 'ImportExpression';
      if (!isRequire && !isDynamic) {
        return;
      }
      handle({
        node,
        spec: arg.value,
        typeOnly: false,
        form: isDynamic ? 'dynamic import' : 'require',
      });
    },
  };
}

// ---------------------------------------------------------------------------
// R1 — engine purity
// ---------------------------------------------------------------------------

const R1_ENGINE_PURITY = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'R1 — engines/** may not import UI, presentation, app-runtime or network modules.',
    },
    schema: [],
    messages: {
      uiLayer:
        "R1: engine imports the '{{layer}}' layer ('{{spec}}'). An engine may reach types and pure utils only — calculation must not depend on presentation or app state.",
      runtimePackage:
        "R1: engine imports the app-runtime package '{{spec}}'. Engines must be pure, synchronous and framework-free.",
      networkModule:
        "R1: engine imports the network module '{{spec}}'. Engines are offline-only (§9 auto-BLOCK).",
      networkCall:
        "R1: engine calls '{{name}}(...)'. Engines perform no I/O — move the fetch behind a service and pass the result in.",
    },
  },
  create(context) {
    const file = relPath(context);
    if (!file.startsWith(ENGINES) || isTestFile(file)) {
      return {};
    }

    const forbiddenLayers = [
      { prefix: 'src/screens/', layer: 'screens' },
      { prefix: 'src/components/', layer: 'components' },
      { prefix: 'src/navigation/', layer: 'navigation' },
      { prefix: HOOKS, layer: 'hooks' },
      { prefix: 'src/store/', layer: 'store' },
      { prefix: VAULT, layer: 'security' },
      { prefix: 'src/services/', layer: 'services' },
      { prefix: DATA_ADAPTER, layer: 'authority' },
      { prefix: PACKS, layer: 'data' },
      { prefix: 'src/i18n/', layer: 'i18n' },
      { prefix: 'src/auth/', layer: 'auth' },
    ];

    return {
      ...importVisitors(({ node, spec, typeOnly }) => {
        if (matchesAny(spec, NETWORK_MODULES)) {
          context.report({ node, messageId: 'networkModule', data: { spec } });
          return;
        }
        if (matchesAny(spec, NON_ENGINE_PACKAGES)) {
          context.report({ node, messageId: 'runtimePackage', data: { spec } });
          return;
        }
        const target = resolveLocal(file, spec);
        if (target === null || typeOnly) {
          return;
        }
        const hit = forbiddenLayers.find((entry) =>
          target.startsWith(entry.prefix),
        );
        if (hit !== undefined) {
          context.report({
            node,
            messageId: 'uiLayer',
            data: { layer: hit.layer, spec },
          });
        }
      }),
      CallExpression(node) {
        const callee = node.callee;
        const name =
          callee.type === 'Identifier'
            ? callee.name
            : callee.type === 'MemberExpression' &&
                callee.property.type === 'Identifier'
              ? callee.property.name
              : null;
        if (name === 'fetch' || name === 'XMLHttpRequest') {
          context.report({ node, messageId: 'networkCall', data: { name } });
        }
      },
    };
  },
};

// ---------------------------------------------------------------------------
// R2 — the consumer layer may not calculate
// ---------------------------------------------------------------------------

const R2_NO_CALCULATION_IN_CONSUMERS = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'R2 — screens/components/navigation may import only engine result types; no consumer may import a calculation utility or compute financial values inline.',
    },
    schema: [],
    messages: {
      engineValue:
        "R2: UI imports engine VALUES from '{{spec}}' ({{names}}). The UI may import the engine's public result TYPES only — the call belongs in a hook.",
      engineInternal:
        "R2: UI reaches into an engine's non-public surface ('{{spec}}').",
      calcUtil:
        "R2: '{{layer}}' imports the calculation utility '{{spec}}' ({{what}}). Financial calculation belongs in src/engines/ and must arrive as a result.",
      inlineFinancialMath:
        "R2: financial arithmetic on '{{name}}' performed here, outside src/engines/. This is a duplicate calculation site — the FX/rate comparison must have exactly one implementation.",
    },
  },
  create(context) {
    const file = relPath(context);
    if (isTestFile(file)) {
      return {};
    }
    const isUi = startsWithAny(file, UI_PREFIXES);
    const isHook = file.startsWith(HOOKS);
    const isEngine = file.startsWith(ENGINES);

    const visitors = {};

    if (isUi || isHook) {
      Object.assign(
        visitors,
        importVisitors(({ node, spec, typeOnly }) => {
          const target = resolveLocal(file, spec);
          if (target === null) {
            return;
          }
          const bare = stripExt(target);

          if (isUi && ENGINE_INTERNAL.test(target)) {
            context.report({ node, messageId: 'engineInternal', data: { spec } });
            return;
          }
          if (isUi && target.startsWith(ENGINES) && !typeOnly) {
            const names = (node.specifiers ?? [])
              .filter((entry) => entry.importKind !== 'type')
              .map((entry) => entry.imported?.name ?? entry.local?.name ?? '*')
              .join(', ');
            context.report({
              node,
              messageId: 'engineValue',
              data: { spec, names: names === '' ? '*' : names },
            });
            return;
          }
          const util = CALC_UTILS.find((entry) => entry.module === bare);
          if (util !== undefined) {
            context.report({
              node,
              messageId: 'calcUtil',
              data: {
                layer: isUi ? 'UI' : 'hook',
                spec,
                what: util.what,
              },
            });
          }
        }),
      );
    }

    if (!isEngine) {
      // Inline financial arithmetic outside the engine layer. Scoped to FX /
      // commission-named operands and to true arithmetic (+ - * /): a bounds
      // CHECK (`x >= 0 && x <= 10`) is validation, which R4 covers, whereas
      // arithmetic on a commission is a calculation that should live in an
      // engine.
      visitors.BinaryExpression = (node) => {
        if (!['+', '-', '*', '/'].includes(node.operator)) {
          return;
        }
        const name = [node.left, node.right]
          .map((side) =>
            side.type === 'Identifier'
              ? side.name
              : side.type === 'MemberExpression' &&
                  side.property.type === 'Identifier'
                ? side.property.name
                : null,
          )
          .find((candidate) => candidate !== null && FX_NAME.test(candidate));
        if (name !== undefined) {
          context.report({
            node,
            messageId: 'inlineFinancialMath',
            data: { name },
          });
        }
      };
    }

    return visitors;
  },
};

// ---------------------------------------------------------------------------
// R3 — dataset / pack / local-DB access
// ---------------------------------------------------------------------------

const R3_DATA_ACCESS = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'R3 — only the data adapter may import a pack file, a raw JSON dataset, or a local DB driver.',
    },
    schema: [],
    messages: {
      dataset:
        "R3: raw dataset '{{spec}}' imported outside {{adapter}}**. Every reference read must go through the data authority/adapter so provenance, tier and lastUpdated travel with the value.",
      pack:
        "R3: pack module '{{spec}}' imported outside {{adapter}}**.",
      driver:
        "R3: local storage driver '{{spec}}' imported outside {{adapter}}** and {{vault}}** (the sanctioned vault owner).",
    },
  },
  create(context) {
    const file = relPath(context);
    const inAdapter = file.startsWith(DATA_ADAPTER);

    return importVisitors(({ node, spec }) => {
      if (LOCAL_DB_DRIVERS.includes(spec)) {
        if (!inAdapter && !file.startsWith(VAULT)) {
          context.report({
            node,
            messageId: 'driver',
            data: { spec, adapter: DATA_ADAPTER, vault: VAULT },
          });
        }
        return;
      }
      if (inAdapter) {
        return;
      }
      if (spec.endsWith('.json')) {
        context.report({
          node,
          messageId: 'dataset',
          data: { spec, adapter: DATA_ADAPTER },
        });
        return;
      }
      const target = resolveLocal(file, spec);
      if (target !== null && target.startsWith(PACKS) && !file.startsWith(PACKS)) {
        context.report({
          node,
          messageId: 'pack',
          data: { spec, adapter: DATA_ADAPTER },
        });
      }
    });
  },
};

// ---------------------------------------------------------------------------
// R4 — financial constants outside config/** and the packs
// ---------------------------------------------------------------------------

const R4_FINANCIAL_CONSTANTS = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'R4 — no rate / fee / percentage / threshold literal outside config/** and the packs.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowlist: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                file: { type: 'string' },
                reason: { type: 'string' },
              },
              required: ['file', 'reason'],
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      namedConstant:
        "R4: financial constant {{raw}} bound to '{{name}}' lives outside {{config}}**. A rate/threshold must have exactly one definition site.",
      hardcodedScore:
        "R4: hardcoded score '{{text}}' rendered as content. A score is an engine output — rendering a literal makes the UI lie when the engine disagrees.",
      thresholdInCopy:
        "R4: threshold '{{text}}' duplicated inside display copy. It will drift from the rule that computes it.",
    },
  },
  create(context) {
    const file = relPath(context);
    const options = context.options[0] ?? {};
    const allowlist = options.allowlist ?? [];

    // Packs, generated types, translation catalogues and config are all outside
    // R4's remit; test files are switched off in a separate config block below.
    if (
      file.startsWith(CONFIG) ||
      file.startsWith(PACKS) ||
      file.startsWith('src/types/') ||
      isTestFile(file)
    ) {
      return {};
    }
    const allowed = allowlist.find((entry) => file === entry.file);
    if (allowed !== undefined) {
      return {};
    }
    const isCatalogue = file.startsWith('src/i18n/');

    /**
     * R4 EXCEPTIONS, value-shaped:
     * - 0 / 1 / -1 carry no financial meaning in any context.
     * - calendar divisors (months per year, days per week, minutes per hour…)
     *   are unit conversions, not tunable rates: `annualRate / 100 / 12` has one
     *   financial number in it and it is not the 12.
     * 100 is deliberately NOT excluded — a bare `× 100` / `÷ 100` on a fee is a
     * percent/fraction conversion, and mixing those units is a real defect class
     * in this codebase (both a fraction-based and a percent-based FX field exist).
     */
    const CALENDAR_VALUES = new Set([7, 12, 24, 52, 60, 365, 366]);
    const isNeutral = (value) =>
      value === 0 ||
      value === 1 ||
      value === -1 ||
      (Number.isInteger(value) && CALENDAR_VALUES.has(value));

    /** Name of the nearest binding that gives a numeric literal its meaning. */
    const nameOf = (node) => {
      let current = node.parent;
      let previous = node;
      for (let depth = 0; current != null && depth < 4; depth += 1) {
        switch (current.type) {
          case 'Property':
            return current.key.type === 'Identifier'
              ? current.key.name
              : current.key.type === 'Literal'
                ? String(current.key.value)
                : null;
          case 'VariableDeclarator':
          case 'PropertyDefinition':
          case 'TSPropertySignature':
            return current.id?.type === 'Identifier'
              ? current.id.name
              : current.key?.type === 'Identifier'
                ? current.key.name
                : null;
          case 'AssignmentExpression':
            return current.left.type === 'Identifier'
              ? current.left.name
              : current.left.type === 'MemberExpression' &&
                  current.left.property.type === 'Identifier'
                ? current.left.property.name
                : null;
          case 'BinaryExpression': {
            const other = current.left === previous ? current.right : current.left;
            const found =
              other.type === 'Identifier'
                ? other.name
                : other.type === 'MemberExpression' &&
                    other.property.type === 'Identifier'
                  ? other.property.name
                  : null;
            if (found !== null) {
              return found;
            }
            break;
          }
          case 'JSXAttribute':
            return current.name.type === 'JSXIdentifier'
              ? current.name.name
              : null;
          case 'MemberExpression':
            // An array/record index is not a financial value. R4 exception:
            // array indices, per the spec's own example list.
            if (current.computed && current.property === previous) {
              return null;
            }
            break;
          case 'CallExpression': {
            const callee = current.callee;
            const calleeName =
              callee.type === 'Identifier'
                ? callee.name
                : callee.type === 'MemberExpression' &&
                    callee.property.type === 'Identifier'
                  ? callee.property.name
                  : null;
            // R4 exception: formatting / slicing arguments (toFixed(2),
            // slice(0, 10), padStart(4, '0')) are presentation parameters.
            if (calleeName !== null && FORMATTING_CALLEES.has(calleeName)) {
              return null;
            }
            break;
          }
          default:
            break;
        }
        previous = current;
        current = current.parent;
      }
      return null;
    };

    const sourceCode = context.sourceCode ?? context.getSourceCode();

    /**
     * Report at the character the match starts on, not at the start of the node.
     * A JSX text node opens on the previous line, and a backlog entry that names
     * the wrong line costs the reader a search.
     */
    const reportAtMatch = (node, match, offsetBase, messageId, text) => {
      const index = offsetBase + (match.index ?? 0);
      context.report({
        node,
        loc: {
          start: sourceCode.getLocFromIndex(index),
          end: sourceCode.getLocFromIndex(index + match[0].length),
        },
        messageId,
        data: { text },
      });
    };

    const checkCopy = (node, text, offsetBase) => {
      const score = text.match(/\b\d{1,3}\s*\/\s*100\b/);
      if (score !== null) {
        reportAtMatch(node, score, offsetBase, 'hardcodedScore', score[0].trim());
        return;
      }
      if (isCatalogue || CSS_VALUE.test(text) || BARE_PERCENT.test(text)) {
        return;
      }
      const name = nameOf(node);
      if (name !== null && isNonFinancialName(name)) {
        return;
      }
      const percent = text.match(/(?<![\w.[-])\d{1,3}(?:[.,]\d+)?\s*%/);
      if (percent !== null) {
        reportAtMatch(
          node,
          percent,
          offsetBase,
          'thresholdInCopy',
          percent[0].trim(),
        );
      }
    };

    return {
      Literal(node) {
        if (typeof node.value === 'number') {
          const name = nameOf(node);
          if (name === null || isNeutral(node.value)) {
            return;
          }
          if (!isFinancialName(name)) {
            return;
          }
          context.report({
            node,
            messageId: 'namedConstant',
            data: { raw: node.raw, name, config: CONFIG },
          });
          return;
        }
        if (typeof node.value === 'string') {
          const parent = node.parent;
          // Module specifiers and style/test attributes are not copy.
          if (
            parent != null &&
            (parent.type === 'ImportDeclaration' ||
              parent.type === 'ExportNamedDeclaration' ||
              parent.type === 'ExportAllDeclaration' ||
              parent.type === 'ImportExpression' ||
              (parent.type === 'JSXAttribute' &&
                parent.name.type === 'JSXIdentifier' &&
                ['className', 'style', 'testID', 'accessibilityLabel'].includes(
                  parent.name.name,
                )))
          ) {
            return;
          }
          // +1 skips the opening quote so the reported column lands on the match.
          checkCopy(node, node.value, node.range[0] + 1);
        }
      },
      JSXText(node) {
        checkCopy(node, node.value, node.range[0]);
      },
      TemplateLiteral(node) {
        // Checked whole, not quasi by quasi: `hsl(${h}, 60%, 45%)` only looks
        // like a colour when the interpolations are still in place.
        checkCopy(node, sourceCode.getText(node), node.range[0]);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// R5 — no vault / financial value may reach a track(...) analytics call
//
// ARMED BUT CURRENTLY INAPPLICABLE: no analytics sink of any kind exists in
// src/ today, so R5 reports nothing. That is "nothing to find yet", not "clean".
// The rule binds the moment the first track() call is written.
// ---------------------------------------------------------------------------

const R5_NO_VAULT_IN_TELEMETRY = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'R5 — no vault or financial value may be passed to a track(...) analytics call.',
    },
    schema: [],
    messages: {
      vaultValue:
        "R5: analytics call '{{sink}}(...)' carries vault/financial value(s): {{names}}. §9 forbids balance, income, card number, user id, DEK, PIN, salt and derived financial values from crossing a telemetry boundary.",
      wholeObject:
        "R5: analytics call '{{sink}}(...)' spreads '{{name}}' wholesale. Pass an explicit, non-financial payload — a spread cannot be audited.",
    },
  },
  create(context) {
    const file = relPath(context);
    if (isTestFile(file)) {
      return {};
    }

    const sinkName = (callee) => {
      if (callee.type === 'Identifier' && ANALYTICS_CALLEE.test(callee.name)) {
        return callee.name;
      }
      if (
        callee.type === 'MemberExpression' &&
        callee.property.type === 'Identifier'
      ) {
        const object =
          callee.object.type === 'Identifier' ? callee.object.name : null;
        if (
          ANALYTICS_CALLEE.test(callee.property.name) ||
          (object !== null && /^(analytics|telemetry|metrics)$/i.test(object))
        ) {
          return `${object ?? '?'}.${callee.property.name}`;
        }
      }
      return null;
    };

    const collect = (node, names, spreads) => {
      if (node == null || typeof node.type !== 'string') {
        return;
      }
      if (node.type === 'Identifier' && VAULT_VALUE_NAME.test(node.name)) {
        names.add(node.name);
      }
      if (
        node.type === 'MemberExpression' &&
        node.property.type === 'Identifier' &&
        VAULT_VALUE_NAME.test(node.property.name)
      ) {
        names.add(node.property.name);
      }
      if (node.type === 'SpreadElement' || node.type === 'ExperimentalSpreadProperty') {
        const argument = node.argument;
        spreads.add(
          argument.type === 'Identifier'
            ? argument.name
            : argument.type === 'MemberExpression' &&
                argument.property.type === 'Identifier'
              ? argument.property.name
              : 'object',
        );
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent') {
          continue;
        }
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach((entry) => collect(entry, names, spreads));
        } else if (child != null && typeof child === 'object') {
          collect(child, names, spreads);
        }
      }
    };

    return {
      CallExpression(node) {
        const sink = sinkName(node.callee);
        if (sink === null) {
          return;
        }
        const names = new Set();
        const spreads = new Set();
        node.arguments.forEach((argument) => collect(argument, names, spreads));
        if (names.size > 0) {
          context.report({
            node,
            messageId: 'vaultValue',
            data: { sink, names: [...names].join(', ') },
          });
          return;
        }
        if (spreads.size > 0) {
          context.report({
            node,
            messageId: 'wholeObject',
            data: { sink, name: [...spreads].join(', ') },
          });
        }
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const boundariesPlugin = {
  rules: {
    'R1-engine-purity': R1_ENGINE_PURITY,
    'R2-no-calculation-in-consumers': R2_NO_CALCULATION_IN_CONSUMERS,
    'R3-data-access': R3_DATA_ACCESS,
    'R4-financial-constants': R4_FINANCIAL_CONSTANTS,
    'R5-no-vault-in-telemetry': R5_NO_VAULT_IN_TELEMETRY,
  },
};

module.exports = [
  {
    ignores: ['node_modules/**', 'shims/**', 'android/**', 'ios/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2021,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    linterOptions: {
      // This config reports architecture findings only. Unused-directive noise
      // from the main config's rules would make the backlog harder to read.
      reportUnusedDisableDirectives: false,
    },
    plugins: {
      boundaries: boundariesPlugin,
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'boundaries/R1-engine-purity': 'error',
      'boundaries/R2-no-calculation-in-consumers': 'error',
      'boundaries/R3-data-access': 'error',
      'boundaries/R4-financial-constants': [
        'error',
        {
          // R4 ALLOWLIST — genuine exceptions, each with its reason. Array
          // indices and formatting arguments are handled structurally above;
          // these are whole-file exceptions.
          allowlist: [
            {
              file: 'src/utils/monetary.ts',
              reason:
                'MONETARY_MIN_ILS / MONETARY_MAX_ILS are the §9 monetary input contract (₪0.01–₪999,999): named, exported, documented, and the single definition site. That is exactly what R4 asks for — the file is the destination, not a violation.',
            },
          ],
        },
      ],
      'boundaries/R5-no-vault-in-telemetry': 'error',
    },
  },
  {
    // R4 EXCEPTION — test fixtures. A test asserting that 0.35 load yields a
    // warning MUST contain 0.35; that is the assertion, not a magic number.
    // R1/R2/R3/R5 stay on for tests: an import boundary is a boundary in a test
    // too, and those rules already exempt test files where the exemption is
    // warranted.
    files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'boundaries/R4-financial-constants': 'off',
    },
  },
];
