'use client';

/**
 * The first-visit language prompt of the internal build (M2-04;
 * m2-04-code-review.md R3, R5 rev 2; localization-v1 "首次显示 … 轻量内联选择",
 * "可预览选项；点击继续后才记为明确选择").
 *
 * The layout renders it only while the language is a suggestion (the browser's,
 * or English) and nobody has answered it in this browsing session — and never
 * for a signed-in person whose account could not be read. It sits inline in the
 * flow above the page, never over it, with its own test id so the M1 "no demo
 * prompt" assertions keep their meaning.
 *
 * Choosing in its select only **previews**: the region's own copy and its `lang`
 * change, nothing is posted and no cookie changes. The copy of all three
 * languages comes from the server as a prop — this prompt's six strings, not the
 * catalogues. Continue records the choice (`choose`, through the same switch as
 * the header); Skip records nothing anywhere, restores the suggestion and hides
 * the prompt for this browsing session; while it is in flight a second press
 * does nothing, and if it fails the header's live region says the answer could
 * not be recorded. Without JavaScript it is a plain form whose two submit
 * buttons carry the intent. A refresh that answers the prompt removes it, so
 * focus in it moves to the header switcher first (`TRANSIENT_PROPS`).
 */

import { useId, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { isLocale, type Locale } from '@/i18n/config';

import { LocaleChoiceFields } from './locale-choice-fields';
import { LocaleOptions } from './locale-options';
import { LOCALE_ENDPOINT } from './locale-switch-logic';
import { TRANSIENT_PROPS, useLocaleSwitch } from './locale-switch-provider';

/** The prompt's copy in one language: `common.localePrompt.*` but its description, and `internal.locale.prompt.*`. */
export interface PromptCopy {
  readonly title: string;
  readonly description: string;
  readonly draftNote: string;
  readonly continue: string;
  readonly skip: string;
  readonly selectLabel: string;
}

export interface InternalLocalePromptProps {
  /** The language the page is in: the suggestion Skip keeps. */
  suggested: Locale;
  copy: Readonly<Record<Locale, PromptCopy>>;
}

export function InternalLocalePrompt({ suggested, copy }: InternalLocalePromptProps) {
  const names = useTranslations('common.locale');
  const pathname = usePathname();
  const { state, choose, skip } = useLocaleSwitch();
  const [preview, setPreview] = useState<Locale>(suggested);
  const titleId = useId();
  const selectId = useId();
  const text = copy[preview];

  return (
    <div
      role="region"
      aria-labelledby={titleId}
      lang={preview}
      data-testid="internal-locale-prompt"
      className="border-b bg-card"
      {...TRANSIENT_PROPS}
    >
      <form
        method="post"
        action={LOCALE_ENDPOINT}
        className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-end sm:justify-between sm:px-6"
      >
        <LocaleChoiceFields next={pathname} />
        <div className="flex min-w-0 flex-col gap-1">
          <p id={titleId} className="text-sm font-medium">
            {text.title}
          </p>
          <p className="text-xs text-muted-foreground">{text.description}</p>
          <p className="text-xs text-muted-foreground">{text.draftNote}</p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={selectId}>{text.selectLabel}</Label>
            <NativeSelect
              id={selectId}
              name="locale"
              value={preview}
              onChange={(event) => {
                if (isLocale(event.target.value)) setPreview(event.target.value);
              }}
              className="w-full sm:w-auto"
              data-testid="internal-locale-prompt-select"
            >
              <LocaleOptions label={(code) => names(code)} />
            </NativeSelect>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              name="intent"
              value="choose"
              data-testid="internal-locale-prompt-continue"
              onClick={(event) => {
                event.preventDefault();
                choose(preview);
              }}
            >
              {text.continue}
            </Button>
            {/* aria-disabled, not disabled, while a Skip is in flight: a disabled button
                drops the focus it holds, and a second press must simply do nothing. */}
            <Button
              type="submit"
              name="intent"
              value="skip"
              variant="ghost"
              aria-disabled={state.skipping || undefined}
              data-testid="internal-locale-prompt-skip"
              onClick={(event) => {
                event.preventDefault();
                if (state.skipping) return;
                setPreview(suggested);
                skip(suggested);
              }}
            >
              {text.skip}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
