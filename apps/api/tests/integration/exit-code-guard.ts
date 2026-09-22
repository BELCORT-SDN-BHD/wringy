/**
 * Vitest global setup that keeps a failing integration run failing.
 *
 * The @wringy/db harness's global setup imports embedded-postgres, which
 * registers async-exit-hook at import time. That library listens for
 * 'beforeExit' with exit code 0: when Vitest finishes and sets
 * process.exitCode = 1 for a failed test, the hook stops the clusters and then
 * calls process.exit(0), so `pnpm test:int` reported success for failed tests
 * (observed 2026-09-23 on this branch before this guard; see
 * node_modules/.pnpm/async-exit-hook@2.0.1/node_modules/async-exit-hook/index.js,
 * `add.hookEvent('beforeExit', 0)`).
 *
 * The guard records the exit code Vitest set when the process first drains and
 * restores it in 'exit', which runs after process.exit(0) set the code and
 * before the process really exits (Node applies an exitCode changed there).
 */
export default function setup(): void {
  let intended: number | undefined;

  process.on('beforeExit', () => {
    intended ??= Number(process.exitCode ?? 0);
  });

  process.on('exit', () => {
    if (intended !== undefined && intended !== 0 && Number(process.exitCode ?? 0) === 0) {
      process.exitCode = intended;
    }
  });
}
