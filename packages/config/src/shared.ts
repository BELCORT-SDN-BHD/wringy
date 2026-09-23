import { z } from 'zod';

/** Where a process runs. The api and worker also compare it with `ops.environment` (W2). */
export const WRINGY_ENVS = ['local', 'ci', 'staging', 'production'] as const;
export const wringyEnvSchema = z.enum(WRINGY_ENVS);
export type WringyEnv = z.output<typeof wringyEnvSchema>;

/** A PostgreSQL connection string. No default anywhere: it carries a password. */
export const postgresUrlSchema = z.url({ protocol: /^postgres(ql)?$/ });

/**
 * True when `url`'s host is this machine: `localhost`, an IPv4 address in
 * 127.0.0.0/8, or `::1`. A loopback URL can still be a tunnel to another
 * machine, so callers that hand out fixed development values check more than
 * this (packages/db `resolveBootstrapPlan` also requires the embedded
 * cluster's port).
 */
export function isLoopbackUrl(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, '');
  } catch {
    return false;
  }
  return hostname === 'localhost' || hostname === '::1' || /^127(\.\d{1,3}){3}$/.test(hostname);
}

/** An http(s) base URL for server-to-server calls. */
export const httpUrlSchema = z.url({ protocol: /^https?$/ });
