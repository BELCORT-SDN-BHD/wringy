/**
 * Keeps a failing integration run failing, for every workspace that uses this
 * harness's global setup (packages/db, apps/api, apps/worker).
 *
 * global-setup.ts imports embedded-postgres, which registers async-exit-hook.
 * That library listens for 'beforeExit' with exit code 0: when Vitest finishes
 * and sets process.exitCode = 1 for a failed test, the hook stops the clusters
 * and then calls process.exit(0) on the next tick, so `pnpm test:int` reported
 * success for failed tests. This happens with TEST_DATABASE_URL set as well,
 * because the import is static (node_modules/.pnpm/async-exit-hook@2.0.1/
 * node_modules/async-exit-hook/index.js, `add.hookEvent('beforeExit', 0)`).
 * Observed on 2026-09-23 with a deliberately failing probe test: packages/db
 * and apps/worker both exited 0 with "1 failed".
 *
 * The guard records the exit code Vitest set when the process first drains and
 * restores it in 'exit', which runs after process.exit(0) set the code and
 * before the process really exits (Node applies an exitCode changed there).
 * 'beforeExit' listeners run synchronously in one emit, and async-exit-hook
 * defers its process.exit to process.nextTick, so the order of registration
 * does not matter.
 */
let installed = false;

export function installExitCodeGuard(): void {
  if (installed) return;
  installed = true;

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
