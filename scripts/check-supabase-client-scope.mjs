#!/usr/bin/env node
/**
 * `pnpm check:supabase-scope`: the "no module-level Supabase client" check
 * (M2-02 R17; kickoff-package.md §4.9 CI row).
 *
 * `pnpm depcruise`'s rule `supabase-client-only-in-auth-lib` says WHERE a Supabase
 * client library may be imported. It cannot say anything about HOW the one allowed
 * file uses it, and the dangerous mistake is a shape, not a location:
 *
 *   const supabase = createServerClient(url, key, { cookies })   // at module level
 *
 * A client created once per process would carry one request's cookies into
 * another request, and `@supabase/ssr` delivers its cache headers only with the
 * first cookie write of a client's life, so every later response would lose them.
 * The vendor's own rule is "always initialize the Supabase client inside the
 * request handler" (kickoff-package.md §4.3).
 *
 * So this script checks two things:
 *
 *  1. In apps/web/src/lib/auth/supabase-server.ts, every `createServerClient(`
 *     call sits inside a function body. There must be at least one, so the check
 *     cannot pass by the call having quietly moved somewhere else.
 *  2. No other file under apps/web/src imports `@supabase/…` at all. This repeats
 *     the dependency-cruiser rule on purpose: this one reads the source text, so
 *     it still bites if the module graph ever stops showing that edge (it did
 *     once — an unanchored `dist/` exclusion was dropping the package from the
 *     graph entirely).
 *
 *  3. Self-test, as depcruise does: both rules are then run against deliberately
 *     violating copies and must reject them. A check that cannot fail is not a
 *     check.
 *
 * Exit 0 only when (1) and (2) hold on the real tree and (3) rejects both plants.
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** The one file allowed to import a Supabase client library. */
const ALLOWED = 'apps/web/src/lib/auth/supabase-server.ts';
/** The tree the second rule scans. */
const WEB_SRC = 'apps/web/src';
/** The factory whose call site is constrained. */
const FACTORY = 'createServerClient';

const read = (relative) => readFileSync(path.join(ROOT, relative), 'utf8');
const posix = (value) => value.split(path.sep).join('/');

function fail(message, detail) {
  console.error(`check:supabase-scope: FAIL: ${message}`);
  if (detail) console.error(detail);
  process.exit(1);
}

// --- Source scanning --------------------------------------------------------

/**
 * Replaces the contents of comments, strings and template literals with spaces,
 * keeping every offset and line break. Positions therefore still line up with the
 * original file, while `createServerClient(` inside a comment or a doc example
 * cannot be mistaken for a call — which matters here, because this file's own
 * header discusses the call it forbids.
 */
export function blankCommentsAndStrings(source) {
  const out = source.split('');
  const blank = (from, to) => {
    for (let i = from; i < to && i < out.length; i += 1) if (out[i] !== '\n') out[i] = ' ';
  };

  let i = 0;
  while (i < source.length) {
    const two = source.slice(i, i + 2);

    if (two === '//') {
      const end = source.indexOf('\n', i);
      blank(i, end === -1 ? source.length : end);
      i = end === -1 ? source.length : end;
      continue;
    }
    if (two === '/*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      blank(i, stop);
      i = stop;
      continue;
    }

    const quote = source[i];
    if (quote === '"' || quote === "'" || quote === '`') {
      let j = i + 1;
      while (j < source.length) {
        if (source[j] === '\\') {
          j += 2;
          continue;
        }
        if (source[j] === quote) break;
        j += 1;
      }
      blank(i + 1, j);
      i = Math.min(j + 1, source.length);
      continue;
    }

    i += 1;
  }

  return out.join('');
}

/**
 * The `[start, end)` offsets of every function body in `code`: a `function`
 * declaration or expression, a method shorthand, or an arrow function with a
 * block body. Found by locating each body's `{` and matching braces.
 *
 * `code` must already have had its comments and strings blanked, so no brace
 * inside a string can throw the matching off.
 */
export function functionBodyRanges(code) {
  const ranges = [];
  // Either `function …(…) …{`, or `=> {`. The `[^{};]*` between `)` and `{`
  // allows a return-type annotation without letting the match run past a
  // statement boundary.
  const starts = /(?:\bfunction\b[^(){}]*\([^()]*\)[^{};]*\{)|(?:=>\s*\{)/g;

  let match;
  while ((match = starts.exec(code)) !== null) {
    // Both alternatives END at the body's `{`. Searching forward for the first `{`
    // instead would find a destructured parameter list's brace
    // (`function f({ a, b }) {`) and match braces over the parameters, not the body.
    const open = match.index + match[0].length - 1;

    let depth = 0;
    let end = -1;
    for (let i = open; i < code.length; i += 1) {
      if (code[i] === '{') depth += 1;
      else if (code[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end !== -1) ranges.push([open, end]);
    // Nested functions are found by later iterations; no need to skip ahead.
  }

  return ranges;
}

/** Every offset at which `FACTORY(` is called in `code` (not merely named). */
function callOffsets(code) {
  const calls = [];
  const pattern = new RegExp(`\\b${FACTORY}\\s*\\(`, 'g');
  let match;
  while ((match = pattern.exec(code)) !== null) calls.push(match.index);
  return calls;
}

/**
 * Rule 1 against one file's source. Returns a list of problems, empty when the
 * file is fine.
 */
export function checkFactoryScope(source, label) {
  const code = blankCommentsAndStrings(source);
  const calls = callOffsets(code);
  const bodies = functionBodyRanges(code);
  const problems = [];

  if (calls.length === 0) {
    problems.push(`${label}: no ${FACTORY}( call found at all — has the client factory moved?`);
    return problems;
  }

  for (const offset of calls) {
    const inside = bodies.some(([start, end]) => offset > start && offset < end);
    if (!inside) {
      const line = source.slice(0, offset).split('\n').length;
      problems.push(`${label}:${line}: ${FACTORY}( is called outside any function body (a module-level client)`);
    }
  }

  return problems;
}

/** Every file under `relativeDir`, as repository-relative posix paths. */
function filesUnder(relativeDir) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const next = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (/\.(ts|tsx|mts|js|jsx|mjs)$/.test(entry.name)) out.push(next);
    }
  };
  walk(relativeDir);
  return out;
}

/**
 * Replaces comment contents with spaces but leaves string literals alone.
 *
 * Rule 2 is looking FOR a string literal (the module specifier), so it cannot use
 * `blankCommentsAndStrings` — that would erase the very text it needs, and the
 * check would silently pass on everything.
 */
export function blankComments(source) {
  const out = source.split('');
  const blank = (from, to) => {
    for (let i = from; i < to && i < out.length; i += 1) if (out[i] !== '\n') out[i] = ' ';
  };

  let i = 0;
  while (i < source.length) {
    const two = source.slice(i, i + 2);

    if (two === '//') {
      const end = source.indexOf('\n', i);
      blank(i, end === -1 ? source.length : end);
      i = end === -1 ? source.length : end;
      continue;
    }
    if (two === '/*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      blank(i, stop);
      i = stop;
      continue;
    }

    // Skip over a string without altering it, so a `//` inside one is not read
    // as a comment.
    const quote = source[i];
    if (quote === '"' || quote === "'" || quote === '`') {
      let j = i + 1;
      while (j < source.length) {
        if (source[j] === '\\') {
          j += 2;
          continue;
        }
        if (source[j] === quote) break;
        j += 1;
      }
      i = Math.min(j + 1, source.length);
      continue;
    }

    i += 1;
  }

  return out.join('');
}

/**
 * Rule 2: which files other than ALLOWED actually IMPORT a `@supabase/…` module.
 *
 * Matched on import syntax rather than on the bare specifier, so a mention in a
 * comment or an ordinary string (a log line, a doc example, this script's own
 * header) is not a violation, while `import`, `export … from`, `require()` and a
 * dynamic `import()` all are.
 */
export function findSupabaseImporters(files, readFile) {
  const importers = [];
  const pattern =
    /(?:\bfrom\s*|\bimport\s*|\brequire\s*\(\s*|\bimport\s*\(\s*)['"]@supabase\/[\w.-]+['"]/;

  for (const file of files) {
    if (file === ALLOWED) continue;
    if (pattern.test(blankComments(readFile(file)))) importers.push(file);
  }

  return importers;
}

// --- The real tree ----------------------------------------------------------

/**
 * Where plant 2 goes. Removed before the real tree is scanned as well as after it
 * is used: `process.exit` does not run `finally`, so a run that failed for some
 * other reason could otherwise leave the file behind and fail the NEXT run for the
 * wrong reason (which is exactly what happened while this script was written).
 */
const IMPORTER_PLANT = `${WEB_SRC}/lib/auth/__supabase-scope-violation__.ts`;
const importerPlantPath = path.join(ROOT, IMPORTER_PLANT);
rmSync(importerPlantPath, { force: true });

const allowedSource = read(ALLOWED);
const scopeProblems = checkFactoryScope(allowedSource, ALLOWED);
if (scopeProblems.length > 0) fail(`${ALLOWED} creates a client outside a function`, scopeProblems.join('\n'));
console.log(`check:supabase-scope: ${ALLOWED}: every ${FACTORY}( call is inside a function body`);

const webFiles = filesUnder(WEB_SRC).map(posix);
const importers = findSupabaseImporters(webFiles, read);
if (importers.length > 0) {
  fail(`a Supabase client library is imported outside ${ALLOWED}`, importers.map((file) => `  ${file}`).join('\n'));
}
console.log(
  `check:supabase-scope: ${webFiles.length} files under ${WEB_SRC}: only ${ALLOWED} imports @supabase/*`,
);

// --- Self-test: both rules must reject a planted violation -------------------

// Plant 1: the allowed file, with a module-level client added. Written to a temp
// directory rather than into the repository, so a killed run leaves nothing behind.
const scratch = mkdtempSync(path.join(tmpdir(), 'wringy-supabase-scope-'));
let rejected;
let stillFine;
try {
  const plantedPath = path.join(scratch, 'supabase-server.planted.ts');
  writeFileSync(
    plantedPath,
    `${allowedSource}\n\n// planted violation\nconst leaked = ${FACTORY}('https://x.supabase.co', 'k', {});\nexport { leaked };\n`,
    'utf8',
  );
  rejected = checkFactoryScope(readFileSync(plantedPath, 'utf8'), 'planted');

  // A call inside a function must still pass, so rule 1 is not simply always failing.
  const okPath = path.join(scratch, 'supabase-server.ok.ts');
  writeFileSync(
    okPath,
    `${allowedSource}\n\nexport function second() {\n  return ${FACTORY}('https://x.supabase.co', 'k', {});\n}\n`,
    'utf8',
  );
  stillFine = checkFactoryScope(readFileSync(okPath, 'utf8'), 'planted-ok');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (rejected.length === 0) fail('the planted module-level client was NOT rejected (rule 1 cannot fail)');
console.log(`check:supabase-scope: planted module-level client rejected: ${rejected[0]}`);
if (stillFine.length > 0) fail('rule 1 rejected a client created inside a function', stillFine.join('\n'));

// Plant 2: a second file under apps/web/src importing the library. This one has to
// live in the tree the rule scans, so it is removed before anything can exit.
let importerPlantRejected;
try {
  writeFileSync(
    importerPlantPath,
    "// planted violation (check:supabase-scope)\nimport { createServerClient } from '@supabase/ssr';\n\nexport const leaked = createServerClient;\n",
    'utf8',
  );
  importerPlantRejected = findSupabaseImporters([...webFiles, IMPORTER_PLANT], read).includes(IMPORTER_PLANT);
} finally {
  rmSync(importerPlantPath, { force: true });
}

if (importerPlantRejected !== true) {
  fail(`the planted importer (${IMPORTER_PLANT}) was NOT rejected (rule 2 cannot fail)`);
}
console.log(`check:supabase-scope: planted second importer rejected: ${IMPORTER_PLANT}`);

// And the rule must not fire on a mention that is not an import, or this very
// file's header — which names the package to explain the rule — would violate it.
const benign = findSupabaseImporters(['benign'], () =>
  ["// see '@supabase/ssr'", "/* import { x } from '@supabase/ssr' */", "const name = '@supabase/ssr';", ''].join('\n'),
);
if (benign.length > 0) fail('rule 2 fired on a comment or a plain string mention', benign.join('\n'));

// …while every real import form must be caught.
for (const form of [
  "import { createServerClient } from '@supabase/ssr';",
  "import '@supabase/ssr';",
  "export { createServerClient } from '@supabase/ssr';",
  "const { createServerClient } = require('@supabase/ssr');",
  "const mod = await import('@supabase/supabase-js');",
  "import type { SupabaseClient } from '@supabase/supabase-js';",
]) {
  if (findSupabaseImporters(['form'], () => form).length === 0) {
    fail('rule 2 missed a real import form', form);
  }
}

console.log('check:supabase-scope: PASS');
