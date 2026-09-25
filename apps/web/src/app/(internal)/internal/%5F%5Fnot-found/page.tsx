import { notFound } from 'next/navigation';

/**
 * The page `proxy.ts` rewrites to when a request in internal mode asks for a path
 * outside `/internal`, `/internal/…` and `/auth/…` (M2-02 R12).
 *
 * It exists only to call `notFound()`, which renders `(internal)/not-found.tsx`
 * inside the internal root layout — with its trilingual banner, without the demo.
 * A rewrite is used rather than a redirect so the address the visitor typed stays
 * in the bar, and the demo's own catch-all (`(demo)/[...notFound]`) is never
 * reached in this build.
 *
 * The double-underscore name keeps it out of the way of any real product path:
 * nothing links here, and it is not a route anyone is meant to type.
 *
 * The folder on disk is `%5F%5Fnot-found`, not `__not-found`. Next treats a folder
 * beginning with `_` as a **private** folder and leaves it out of the route tree
 * entirely, so `__not-found` would not have been a route at all — the rewrite
 * would have landed on `[...rest]` by luck rather than on this page. `%5F` is the
 * documented escape for a URL segment that starts with an underscore
 * (node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md,
 * "Private folders"). The URL is `/internal/__not-found`.
 */
export default function InternalRewrittenNotFound(): never {
  notFound();
}
