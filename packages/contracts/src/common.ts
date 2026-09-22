import { z } from 'zod';

/**
 * An instant on the wire: ISO 8601 with an explicit offset. The API writes
 * `Date#toISOString()` (UTC, `Z`); an offset form is accepted so a client never
 * rejects a valid instant.
 */
export const instantSchema = z.iso.datetime({ offset: true });

/**
 * The fixture/live label every record carries (Implementation Decision 5).
 * `fixture` rows are demonstration data; `live` rows are real. The database
 * column is `data_origin`; on the wire it is `dataOrigin`.
 */
export const DATA_ORIGINS = ['fixture', 'live'] as const;
export const dataOriginSchema = z.enum(DATA_ORIGINS);
export type DataOrigin = z.output<typeof dataOriginSchema>;

/**
 * The body of every non-2xx response. `code` is stable and machine-readable;
 * `message` is operator English, never a secret, a stack or a SQL error.
 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string(),
  }),
});
export type ApiError = z.output<typeof apiErrorSchema>;
