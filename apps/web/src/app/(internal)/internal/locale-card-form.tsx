'use client';

import type { ReactNode } from 'react';

import { isLocale } from '@/i18n/config';

import { LOCALE_ENDPOINT } from './locale-switch-logic';
import { useLocaleSwitch } from './locale-switch-provider';

/**
 * The Language card's form (M2-04; m2-04-code-review.md R5 rev 2): a plain
 * `choose` post to `POST /internal/locale` before hydration and without
 * JavaScript, which lands back on `/internal` with an outcome; once hydrated,
 * Save is the same in-place switch as the header, the prompt, Retry and Undo.
 *
 * In place because the card sits on `/internal` beside the create-org form: a
 * full-page post would leave the page and throw away the name typed there and
 * the request key minted for it (M2-AC04/3 "切换保留输入和请求键";
 * localization-v1 "随时修改 … 不清空已填写内容"). The server renders the fields
 * as `children`; this component only owns the submit.
 */
export function LocaleCardForm({ children }: { children: ReactNode }) {
  const { choose } = useLocaleSwitch();
  return (
    <form
      method="post"
      action={LOCALE_ENDPOINT}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      data-testid="locale-card-form"
      onSubmit={(event) => {
        event.preventDefault();
        const chosen = new FormData(event.currentTarget).get('locale');
        if (typeof chosen === 'string' && isLocale(chosen)) choose(chosen);
      }}
    >
      {children}
    </form>
  );
}
