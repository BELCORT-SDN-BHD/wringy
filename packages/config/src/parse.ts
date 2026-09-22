import type { z } from 'zod';

/** A raw environment, such as `process.env`. */
export type EnvSource = Readonly<Record<string, string | undefined>>;

export type EnvProblemKind = 'missing' | 'invalid';

export interface EnvProblem {
  /** The variable NAME. The value is never recorded anywhere in this error. */
  readonly name: string;
  readonly problem: EnvProblemKind;
}

/**
 * Thrown when a process starts with an unusable environment.
 *
 * The message, the `problems` list and anything serialised from this error name
 * variables only. Values can be secrets (connection strings carry passwords), so
 * neither the raw input nor zod's issue objects are attached.
 */
export class EnvError extends Error {
  override readonly name = 'EnvError';
  readonly processName: string;
  readonly problems: readonly EnvProblem[];

  constructor(processName: string, problems: readonly EnvProblem[]) {
    const list = problems.map(({ name, problem }) => `${name} is ${problem}`).join('; ');
    super(`Invalid environment for ${processName}: ${list}. Values are not shown.`);
    this.processName = processName;
    this.problems = problems;
  }

  toJSON(): { name: string; processName: string; problems: readonly EnvProblem[] } {
    return { name: this.name, processName: this.processName, problems: this.problems };
  }
}

/** Treats an absent, empty or whitespace-only variable as unset, so defaults apply. */
function readVariable(source: EnvSource, name: string): string | undefined {
  const raw = source[name];
  return raw === undefined || raw.trim() === '' ? undefined : raw;
}

export function sortProblems(problems: ReadonlyMap<string, EnvProblemKind>): EnvProblem[] {
  return [...problems]
    .map(([name, problem]) => ({ name, problem }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Parses only the variables `schema` declares. Anything else in `source` is
 * ignored, so one process never picks up another process's secrets.
 */
export function parseEnv<Schema extends z.ZodObject>(
  processName: string,
  schema: Schema,
  source: EnvSource,
): z.output<Schema> {
  const input: Record<string, string | undefined> = {};
  for (const name of Object.keys(schema.shape)) {
    input[name] = readVariable(source, name);
  }

  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const problems = new Map<string, EnvProblemKind>();
  for (const issue of result.error.issues) {
    const [name] = issue.path;
    if (typeof name !== 'string') continue;
    problems.set(name, input[name] === undefined ? 'missing' : 'invalid');
  }
  throw new EnvError(processName, sortProblems(problems));
}

export type EnvResult<T> = { ok: true; env: T } | { ok: false; error: EnvError };

/**
 * For callers that render a "not configured" state instead of crashing, such as
 * the web server's internal page. Only `EnvError` is caught.
 */
export function tryLoadEnv<T>(load: () => T): EnvResult<T> {
  try {
    return { ok: true, env: load() };
  } catch (error) {
    if (error instanceof EnvError) return { ok: false, error };
    throw error;
  }
}
