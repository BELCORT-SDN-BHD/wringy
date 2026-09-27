'use client';

import { useState } from 'react';

import { newRequestKey } from '@/lib/request-key';

import { useHydrated } from './hydrated';

/**
 * The request key of a create form (M2-04; m2-04-code-review.md R8 rev 2):
 * `<input type="hidden" name="requestKey">`, one key per mount, minted on the
 * client and shown only once hydrated — a server-minted value would not match
 * the client's on hydration. It is state, and nothing above it is keyed by the
 * language, so an in-place switch (`router.refresh()`) keeps the same key
 * (executed, record §1) and a later submit carries it.
 *
 * No Route Handler reads it and no header forwards it in this ticket: M2-05
 * adds the `X-Request-Key` header with its consumer. A submit before hydration,
 * or without JavaScript, carries an empty key (known-issues hand-off).
 */
export function RequestKeyField() {
  const hydrated = useHydrated();
  const [key] = useState(newRequestKey);

  return <input type="hidden" name="requestKey" value={hydrated ? key : ''} data-testid="request-key" />;
}
