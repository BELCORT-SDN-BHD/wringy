import { notFound } from 'next/navigation';

/**
 * Any URL no other route matches renders Next's not-found UI inside the demo's
 * root layout, as it did in M1 when the demo layout was the app's only root
 * layout. With two root layouts ((demo) and (internal)) and no top-level
 * app/layout.tsx, Next has no layout to wrap an unmatched URL in and serves a
 * bare 404 document without `<html lang>` or the app's CSS
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md,
 * "global-not-found.js", which is experimental in this version). Static and
 * more specific routes, /internal/* included, still win over this catch-all
 * (dynamic-routes.md, "Catch-all Segments").
 */
export default function UnmatchedDemoRoute(): never {
  notFound();
}
