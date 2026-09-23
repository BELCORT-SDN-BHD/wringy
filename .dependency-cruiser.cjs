/**
 * Dependency direction for the Wringy workspace (ruling D31; kickoff-package.md
 * §8.7). `pnpm depcruise` runs scripts/check-dependency-direction.mjs, which
 * cruises apps/<name>/src and packages/<name>/src with this file, expects no
 * violation, then plants a deliberately violating file and expects it rejected.
 *
 * Paths are relative to the repository root with forward slashes. An npm package
 * resolves to node_modules/.pnpm/<pkg>@<version>/node_modules/<pkg>/…, or stays
 * the bare specifier when the importing workspace does not declare it (pnpm's
 * isolated node_modules), so each package pattern matches both forms. A
 * workspace package resolves to its real path under packages/, or stays
 * `@wringy/<name>` when undeclared.
 *
 * Rules reference: https://github.com/sverweij/dependency-cruiser/blob/v18.4.0/doc/rules-reference.md
 */

const path = require('node:path');

/**
 * Matches an npm package by name, resolved or not. pnpm's real path ends in
 * `/node_modules/<name>/…` too, so one literal covers hoisted and .pnpm layouts
 * (and keeps dependency-cruiser's safe-regex check happy: no nested quantifier).
 */
const npm = (...names) => names.map((name) => `(^|/)node_modules/${name}/|^${name}($|/)`);

/** Matches a workspace package by folder, resolved or not (`@wringy/<name>`). */
const workspace = (...names) => names.flatMap((name) => [`^packages/${name}/`, `^@wringy/${name}($|/)`]);

const APPS = '^apps/';
/** The demo engine and everything that re-exports it (the `@/domain` barrel). */
const DEMO_ENGINE = '^apps/web/src/domain/(index|engine|seed|scenarios|scenario-steps|selectors)[.]';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // --- packages/domain: pure rules only (created in M2-05) -------------------
    {
      name: 'domain-not-to-node-builtins',
      comment: 'packages/domain is pure: no node:* or other built-in modules.',
      severity: 'error',
      from: { path: '^packages/domain/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'domain-not-to-runtimes',
      comment: 'packages/domain is pure: no pg, fastify, react, next, zod, pg-boss, db, and nothing from apps/*.',
      severity: 'error',
      from: { path: '^packages/domain/' },
      to: {
        path: [...npm('pg', 'pg-boss', 'fastify', 'react', 'react-dom', 'next', 'zod'), ...workspace('db'), APPS],
      },
    },

    // --- packages/contracts and packages/config --------------------------------
    {
      name: 'contracts-config-not-to-runtimes',
      comment: 'Contracts and config are shared schemas: no database, server or UI runtime, nothing from apps/*.',
      severity: 'error',
      from: { path: '^packages/(contracts|config)/' },
      to: {
        path: [...workspace('db'), ...npm('pg', 'pg-boss', 'fastify', 'next', 'react', 'react-dom'), APPS],
      },
    },

    // --- packages/db ----------------------------------------------------------
    {
      name: 'db-not-to-app-layers',
      comment: 'The data layer knows no HTTP server, UI or wire contract, and nothing from apps/*.',
      severity: 'error',
      from: { path: '^packages/db/' },
      to: {
        path: [...npm('fastify', 'next', 'react', 'react-dom'), ...workspace('contracts'), APPS],
      },
    },

    // --- apps -----------------------------------------------------------------
    {
      name: 'api-not-to-other-apps',
      comment: 'apps/api shares code only through packages/*.',
      severity: 'error',
      from: { path: '^apps/api/' },
      to: { path: '^apps/(web|worker)/' },
    },
    {
      name: 'worker-not-to-other-apps-or-fastify',
      comment: 'apps/worker shares code only through packages/*, and serves no HTTP.',
      severity: 'error',
      from: { path: '^apps/worker/' },
      to: { path: ['^apps/(web|api)/', ...npm('fastify')] },
    },
    {
      name: 'worker-not-to-contracts',
      comment:
        'apps/worker has no wire contract: it serves no HTTP and reads no API. kickoff-package.md §8.1 lists domain, db and config as its dependencies, not @wringy/contracts.',
      severity: 'error',
      from: { path: '^apps/worker/' },
      to: { path: workspace('contracts') },
    },
    {
      name: 'web-not-to-server-runtime',
      comment:
        'apps/web reaches data only through the API: no @wringy/db, pg, pg-boss or fastify, and no code from apps/api or apps/worker.',
      severity: 'error',
      from: { path: '^apps/web/' },
      to: { path: [...workspace('db'), ...npm('pg', 'pg-boss', 'fastify'), '^apps/(api|worker)/'] },
    },
    {
      name: 'web-ui-not-to-server-config',
      comment:
        'Components and features can render on the client: no database package and no server-only config module (@wringy/config reads server env).',
      severity: 'error',
      from: { path: '^apps/web/src/(components|features)/' },
      to: { path: [...workspace('db', 'config')] },
    },
    {
      name: 'internal-not-to-demo',
      comment:
        'The (internal) build never mounts the demo: no store, no demo engine/seed/scenarios (nor the @/domain barrel that re-exports them), no demo toolbar or demo providers.',
      severity: 'error',
      from: { path: '^apps/web/src/app/\\(internal\\)/' },
      to: {
        path: [
          '^apps/web/src/store/',
          DEMO_ENGINE,
          '^apps/web/src/components/app/(demo-toolbar|providers)\\.tsx$',
        ],
      },
    },
    {
      name: 'server-not-to-demo-engine',
      comment:
        'api, worker and packages never import the demo simulator (ruling D30): demo accounting must not reach real tables.',
      severity: 'error',
      from: { path: '^(apps/(api|worker)|packages)/' },
      to: { path: DEMO_ENGINE },
    },

    // --- everywhere -----------------------------------------------------------
    {
      name: 'no-circular',
      comment: 'No dependency cycles anywhere.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      comment: 'Every import resolves; an undeclared package fails here as well as in its own rule.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules'] },
    // node_modules is not excluded: excluding it would drop every dependency on an
    // npm package from the graph, and the rules above could never see `pg`.
    exclude: { path: ['(^|/)[.]next/', '(^|/)dist/'] },
    // Type-only imports count too: a type import of @wringy/db from web is still wrong.
    tsPreCompilationDeps: true,
    // The web app's `@/*` alias, from a root tsconfig made for this purpose:
    // only one tsconfig can be named, other workspaces use relative imports or
    // package.json "imports" (#…). The path is absolute because TypeScript 5.9's
    // parseJsonConfigFileContent finds no input files on Windows for a relative
    // config name, which fails the cruise.
    tsConfig: { fileName: path.join(__dirname, 'tsconfig.depcruise.json') },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    skipAnalysisNotInRules: true,
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
