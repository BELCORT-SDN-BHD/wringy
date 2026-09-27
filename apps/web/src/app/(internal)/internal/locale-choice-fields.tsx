/**
 * The hidden fields a `choose` form posts to `POST /internal/locale` (M2-04;
 * m2-04-code-review.md R4, R5 rev 2; Standards T9), pulled out of the header
 * switcher, the Language card's Retry/Undo notices and the first-visit prompt,
 * which each wrote the same `<input type="hidden">` lines by hand.
 *
 * `next` is always sent. `intent` is sent as `"choose"` from every form here
 * except the prompt's, whose two submit buttons carry their own `name="intent"
 * value="choose"|"skip"` (`omit` it there, or a stray `intent=choose` would sit
 * beside the button's own field with the same name). `locale` is sent only
 * where no visible `<select name="locale">` already carries that value — the
 * header switcher, the Language card and the prompt read it from their own
 * select and must not send it twice under the same name.
 *
 * A plain component: no hook, no `"use client"`, so a Server Component (the
 * Language card's form) and a Client Component (the header switcher, the
 * notices, the prompt) can each render it without crossing a boundary.
 */

import type { Locale } from '@/i18n/config';

export interface LocaleChoiceFieldsProps {
  readonly intent?: 'choose' | 'skip';
  readonly locale?: Locale;
  readonly next: string;
}

export function LocaleChoiceFields({ intent, locale, next }: LocaleChoiceFieldsProps) {
  return (
    <>
      {intent !== undefined ? <input type="hidden" name="intent" value={intent} /> : null}
      {locale !== undefined ? <input type="hidden" name="locale" value={locale} /> : null}
      <input type="hidden" name="next" value={next} />
    </>
  );
}
