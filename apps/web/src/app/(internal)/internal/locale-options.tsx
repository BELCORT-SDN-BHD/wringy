/**
 * The three languages as `<option>`s, each carrying its own `lang` (M2-04;
 * m2-04-code-review.md R10; Standards T9): the header switcher and the
 * first-visit prompt built the same `LOCALES.map` by hand, in the same order,
 * with the same `value`/`lang` pair and only the label's source differing.
 *
 * The label is a function, not a hook, because one caller reads it with
 * `useTranslations` (a Client Component) and another with `getTranslations`
 * (a Server Component); taking either as a plain function keeps this
 * component itself hook-free and server-safe, like `LocaleChoiceFields`.
 */

import { NativeSelectOption } from '@/components/ui/native-select';
import { LOCALES, type Locale } from '@/i18n/config';

export interface LocaleOptionsProps {
  readonly label: (locale: Locale) => string;
}

export function LocaleOptions({ label }: LocaleOptionsProps) {
  return (
    <>
      {LOCALES.map((code) => (
        <NativeSelectOption key={code} value={code} lang={code}>
          {label(code)}
        </NativeSelectOption>
      ))}
    </>
  );
}
