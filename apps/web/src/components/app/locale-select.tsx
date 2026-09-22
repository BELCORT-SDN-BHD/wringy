'use client';

/**
 * Language picker.
 *
 * Rules from phase-0/foundation/localization-v1.md: the three options are always
 * shown by their own names (`English`, `Bahasa Melayu`, `简体中文`), never by a
 * flag, and Malay is never called Indonesian. The control is the unchanged
 * official `Select`; switching re-renders in place and keeps form input, because
 * nothing here navigates.
 */

import { Languages } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LOCALES, type Locale } from '@/domain/types';
import { cn } from '@/lib/utils';

export interface LocaleSelectProps {
  value: Locale;
  onChange: (locale: Locale) => void;
  /**
   * Header form: the icon is always shown and the language name appears from the
   * `sm` breakpoint up, so the control still fits a 320px header.
   */
  compact?: boolean;
  id?: string;
  className?: string;
}

export function LocaleSelect({ value, onChange, compact, id, className }: LocaleSelectProps) {
  const t = useTranslations('common');

  return (
    <Select value={value} onValueChange={(next) => onChange(next as Locale)}>
      <SelectTrigger
        id={id}
        aria-label={t('shell.languageLabel')}
        className={cn(compact ? 'w-auto sm:min-w-36' : 'w-full', className)}
        data-testid="locale-select"
      >
        {compact ? <Languages aria-hidden="true" className="size-4" /> : null}
        <span className={compact ? 'hidden sm:contents' : 'contents'}>
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {LOCALES.map((locale) => (
          // The name is the same string in every catalogue, so the list reads
          // identically whichever language is active.
          <SelectItem key={locale} value={locale} lang={locale}>
            {t(`locale.${locale}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
