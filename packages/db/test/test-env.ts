import type { WringyEnv } from '@wringy/config';

/**
 * The environment the integration-test template database is marked as. `ci`
 * allows fixtures; an API or worker under test must be started with this
 * WRINGY_ENV to match the marker. Kept apart from harness.ts, which imports the
 * Vitest runner API, so the global setup can import it too.
 */
export const TEST_WRINGY_ENV: WringyEnv = 'ci';
