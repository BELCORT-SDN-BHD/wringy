# apps/web — Wringy M1 prototype

Next.js App Router prototype for milestone M1 (三端交互原型). Everything it shows is
simulated: identity, clock, view data, notifications, email previews and payouts. See
[`docs/m1-prototype/kickoff.md`](../../docs/m1-prototype/kickoff.md) for scope and the
decisions this scaffold was built against.

The scaffold, the demo engine, the store, the app shell, the public pages, the
notification centre, settings and the demo tools are in place. The three role
feature areas (`src/app/(workspace)/{creator,merchant,ops}/**` beyond their
placeholder overview, and `src/features/**`) arrive in wave 2.

## Run

All commands are run from the **repository root** (this is a pnpm workspace).

```bash
pnpm install                       # one root pnpm-lock.yaml covers every workspace
pnpm dev                           # next dev on http://127.0.0.1:3100
pnpm lint                          # eslint
pnpm typecheck                     # next typegen && tsc --noEmit
pnpm test                          # vitest run
pnpm --filter web e2e:install      # one-off: download Chromium (~310 MB)
pnpm e2e                           # playwright test, 3 viewports
```

`pnpm --filter web <script>` reaches the same scripts directly. Playwright starts and stops
the dev server itself (`webServer` in `playwright.config.ts`, `reuseExistingServer: true`),
so `pnpm e2e` needs no server running.

Port **3100** is fixed in `dev`, `start`, and the Playwright base URL.

## What is installed

Node 20.19.5, pnpm 10.33.0. Resolved versions, read from the root `pnpm-lock.yaml`:

| Package | Range | Resolved |
|---|---|---|
| next | 16.3.5 | 16.3.5 |
| react / react-dom | 19.3.0 | 19.3.0 |
| typescript | ^5 | 5.9.3 |
| tailwindcss, @tailwindcss/postcss | ^4 | 4.3.3 |
| next-intl | 4.14.6 | 4.14.6 |
| zustand | 5.0.15 | 5.0.15 |
| vitest | ^4.1.11 | 4.1.11 |
| @playwright/test | 1.63.0 | 1.63.0 |
| eslint / eslint-config-next | ^9 / 16.3.5 | 9.39.5 / 16.3.5 |
| @types/node | ^20 | 20.19.43 |
| @types/react / @types/react-dom | ^19 | 19.3.0 |

`@types/node` stays on the `^20` line that create-next-app chose, matching the Node 20
runtime used locally and in CI.

Pulled in by the shadcn CLI, not chosen here: `@base-ui/react` 1.8.0, `@shadcn/react` 0.3.1,
`shadcn` 4.21.0, `radix-ui` 1.6.7, `lucide-react` 1.47.0, `cn` 0.3.2,
`class-variance-authority` 0.7.1, `cmdk` 1.1.1, `sonner` 2.0.8, `vaul` 1.1.2,
`react-day-picker` 10.0.1, `embla-carousel-react` 8.6.0, `input-otp` 1.5.0,
`react-resizable-panels` 4.13.2, `recharts` 3.8.0, `next-themes` 0.4.6,
`tw-animate-css` 1.4.0, `date-fns` 4.4.0.

Turbopack is the default bundler in Next 16; there is no webpack config here.

## What the shadcn CLI generated

Initialised with `shadcn@4.21.0 init -t next -b radix -p nova --css-variables --no-monorepo -y`.
The CLI's default base flipped to `base-ui` in 4.x, so `-b radix -p nova` is required to match
the accepted design system; `components.json` records `"style": "radix-nova"`, base colour
`neutral`, `rsc: true`.

`shadcn@4.21.0 add … --overwrite --yes` produced **61 files** in `src/components/ui/`, plus
`src/hooks/use-mobile.ts` and `src/lib/utils.ts`. That set is identical, name for name, to
`phase-0/foundation/design-system-v2/app/src/components/ui/` — the Vite showcase the design
system was accepted against. 41 of the 61 carry `"use client"`, added by the CLI for the
Next.js target; that is the reason the CLI output is used rather than a copy of the Vite
sources.

These files are upstream registry sources. Do not hand-edit them: re-run the CLI. ESLint
therefore turns off `react-hooks/set-state-in-effect` for `src/components/ui/**` and
`src/hooks/use-mobile.ts` only (`eslint.config.mjs`); `carousel.tsx` and `use-mobile.ts`
trip it upstream. The rule stays on for `src/components/app/**` and `src/features/**`.

## Colours and font

`src/app/globals.css` keeps the CLI's `@theme inline`, `@custom-variant dark`, generated
`.dark` block and `@layer base`, and the `tailwindcss` / `tw-animate-css` /
`shadcn/tailwind.css` imports. Two changes:

1. The `:root` block is copied byte for byte from
   `phase-0/foundation/design-system-v2/app/src/index.css` — 31 shadcn roles, `--radius`, and
   the 12 named additions (`attention-*`, `error-*`, `info-*`, `success-*`, `inactive-*`,
   `brand`, `brand-foreground`). That file is the accepted palette; do not hand-tune here.
2. The 12 named additions are exposed in `@theme inline` as `--color-<name>: var(--<name>)`,
   so `bg-brand`, `text-success-foreground`, `bg-attention-subtle` and the rest compile.
   All 24 such utilities were verified to emit against the copied values.

Because `@theme inline` is tree-shaken, a named colour appears in the served CSS only once a
utility using it exists in the source. An absent `--color-…` in build output is not a bug.

The font is `next/font/google` Geist bound to `--font-sans` (plus Geist Mono on
`--font-geist-mono`), the same family the showcase loads through
`@fontsource-variable/geist`. `next build` fetches it from Google Fonts, so builds need
network access.

The prototype ships light only. The `.dark` block is the CLI's neutral default and is **not**
part of the carried-over palette.

## i18n

next-intl without locale routing (kickoff decision 8). `src/i18n/request.ts` reads the
`wringy-locale` cookie, falls back to `en-MY`, sets the time zone to `Asia/Kuala_Lumpur`, and
loads the merged catalogue from `src/i18n/messages.ts`. `src/i18n/config.ts` holds the cookie
name, the default, and the `isLocale` guard. `next.config.ts` wires the plugin.

That request config only drives server-rendered output: page metadata and the initial
`<html lang>`. Client components take their messages from `AppProviders`
(`src/components/app/providers.tsx`), which swaps the catalogue in place from the persisted
session, so a language change re-renders without navigating and keeps form input.

A message key may not contain a `.`: next-intl reads a dot as nesting and refuses the
catalogue outright. Notification kinds are therefore stored nested
(`notifications.kinds.claim.reserved.title`), which `t('claim.reserved.title')` still
resolves; `src/lib/notification-copy.ts` flattens them back for the placeholder check.

Reading a cookie there makes every route server-rendered on demand; `next build` reports
`ƒ (Dynamic)` for `/` and `/_not-found`. That is expected for a prototype whose locale and
demo state are per visitor.

Eight namespaces per locale: `common`, `public`, `notifications`, `demo`, `settings`,
`merchant`, `creator`, `ops`. `src/i18n/messages.ts` imports all 24 files statically, so a
wave-2 worker fills its own `<role>.json` and never edits that module. `merchant.json`,
`creator.json` and `ops.json` are `{}` until then.

`src/i18n/messages.test.ts` asserts the three locales carry identical key sets, the same
interpolation parameters and no empty strings, and that every notification kind has a title,
a body and a simulated email subject and body.

## Tests

- `vitest.config.mts` — node environment, `src/**/*.test.ts` and `tests/unit/**/*.test.ts`,
  `@` alias. The extension is `.mts`, not `.ts`: Vite's native config loader otherwise warns
  on every run about ESM in a file loaded as CommonJS.
- `playwright.config.ts` — `tests/e2e`, projects `mobile` 390×844, `desktop` 1440×900,
  `small` 320×568, screenshots on failure, output in `tests/e2e/test-results`.
- `tests/e2e/smoke.spec.ts` asserts the title contains "Wringy" and that
  `document.documentElement.scrollWidth` does not exceed the viewport, in all three projects.
- `tests/e2e/helpers.ts` is the shared harness every later spec should use:
  `loadScenario` / `loadScenarioAsGuest` (state injected straight into localStorage),
  `loadScenarioViaUi`, `signInAs`, `setLocale`, `advanceClock`, `addViews`, `setDataOutage`,
  `resetDemo`, `readStoredState` and `expectNoHorizontalOverflow`.
- `tests/e2e/shell.spec.ts` covers the wave-1 frame; `tests/e2e/i18n.spec.ts` walks every
  shell page in all three languages with the console under watch, so a missing message fails
  the run instead of rendering a raw key path; `tests/e2e/screenshots.spec.ts` writes the
  acceptance frames to `tests/e2e/__screenshots__/` (git-ignored).

`next.config.ts` sets `allowedDevOrigins: ['127.0.0.1']` because Next 16 otherwise blocks the
dev-server `/_next/hmr` requests Playwright makes over that host. Development only.

## Gaps

- **No component gaps.** All 61 names exist under the `radix` base; nothing was hand-written
  and nothing was dropped.
- `@tanstack/react-table` is in the Vite showcase but is **not** installed here: the
  `radix-nova` `table.tsx` is presentational and no generated file imports it. Add it when a
  data table actually needs it.
- `pnpm typecheck` runs `next typegen` first. Next 16 puts `LayoutProps` / `PageProps` in
  `.next/types`, so a bare `tsc --noEmit` on a clean checkout fails on `src/app/layout.tsx`.
- `prefers-reduced-motion` is **not** honoured by the enter/exit animations. The only
  reduced-motion rule in the served CSS comes from `shadcn/tailwind.css` and covers the
  `.shimmer` utility; `tw-animate-css` 1.4.0 ships no such rule, so `animate-in` /
  `animate-out` and the Radix overlay transitions still play. Suppressing them means adding
  a rule to `globals.css`, which the design-system contract reserves, so it is recorded here
  rather than done locally.
- `ErrorState` and `TimelineList` (`src/components/app/`) compile and lint but are not yet
  rendered by any page: nothing in the shell performs a read that can fail, and no shell page
  owns an audit trail. Wave-2 role pages are their first real callers.
- The `/campaigns/[id]` metadata is generated from the baseline seed, because the server
  cannot read the visitor's localStorage. A campaign a scenario created locally falls back to
  the catalogue title and description.
- `apps/web/AGENTS.md` and `apps/web/CLAUDE.md` are written by `next dev` itself
  (`node_modules/next/dist/server/lib/generate-agent-files.js`) and are kept so the tree
  stays clean; deleting them only recreates them.
- `public/` holds a `.gitkeep`. The template's five demo SVGs were removed with the template
  page content.
- `pnpm-workspace.yaml` lists `sharp`, `unrs-resolver`, `@parcel/watcher` and `@swc/core`
  under `ignoredBuiltDependencies`; none of their native builds is needed.
