import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
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
};

export default withNextIntl(nextConfig);
