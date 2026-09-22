import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Playwright drives the dev server over 127.0.0.1 (playwright.config.ts), and
  // Next 16 blocks cross-origin dev-resource requests such as /_next/hmr by
  // default. Development only; it has no effect on `next build`/`next start`.
  allowedDevOrigins: ['127.0.0.1'],
};

export default withNextIntl(nextConfig);
