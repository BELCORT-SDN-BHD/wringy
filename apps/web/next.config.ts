import path from 'node:path';

import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // The web image (apps/web/Dockerfile, kickoff-package.md §8.9) runs the
  // minimal server `next build` writes to .next/standalone, which carries only
  // the traced files and node_modules it needs. Tracing starts at the
  // repository root, because the app imports workspace packages
  // (@wringy/config, @wringy/contracts) from ../../packages
  // (node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md,
  // "Caveats"). The server then sits at .next/standalone/apps/web/server.js.
  // `next start` still works, with a warning (the internal e2e suite uses it).
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '..', '..'),

  // Playwright drives the dev server over 127.0.0.1 (playwright.config.ts), and
  // Next 16 blocks cross-origin dev-resource requests such as /_next/hmr by
  // default. Development only; it has no effect on `next build`/`next start`.
  allowedDevOrigins: ['127.0.0.1'],

  // Next's dev badge is anchored bottom-left, which is where the sidebar footer
  // names the identity being acted as. The prototype is demoed and screenshotted
  // from `pnpm dev` (README "Run", demo-script.md), so the badge sat on top of that
  // line in the delivered evidence and clipped it. Turning it off keeps the
  // 1440px/390px/320px checks — and the screenshots the acceptance record points at
  // — about the product. Development only; `next build`/`next start` never had it.
  devIndicators: false,

  // `next dev` logs every incoming request URL WITH its query
  // (next/dist/server/dev/log-requests.js), and an invitation accept link carries
  // its token as `?token=` (M2-03, m2-03-code-review.md R7, R9 rev 2). Those
  // requests are not logged at all. `next start` — the internal suite, staging —
  // logs no incoming requests, so this matters in development only
  // (node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/logging.md).
  logging: {
    incomingRequests: {
      ignore: [/[?&]token=/],
    },
  },
};

export default withNextIntl(nextConfig);
