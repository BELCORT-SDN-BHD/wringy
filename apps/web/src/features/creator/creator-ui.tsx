'use client';

/**
 * The small, repeated pieces of the creator workspace: a page header, a
 * label/value row and the copy helpers for a platform name and for the reason a
 * connection cannot be used.
 *
 * These are layout and copy only. Every value they render is handed in by a
 * page that read it from an engine selector.
 */

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import type { AccountConnection, Platform } from '@/domain/types';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Badges or status shown above the title. */
  eyebrow?: ReactNode;
  /** Primary actions, right aligned from `sm` up. */
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, eyebrow, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      {eyebrow ? <div className="flex flex-wrap items-center gap-2">{eyebrow}</div> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold break-words">{title}</h1>
          {subtitle ? (
            <p className="text-muted-foreground text-sm break-words">{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}

export interface DetailRowProps {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  testId?: string;
}

/**
 * One fact with its label. The label column stays narrow and the value wraps,
 * because a long translation must not be clipped (localization-v1).
 */
export function DetailRow({ label, hint, children, className, testId }: DetailRowProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-0.5 border-b py-2 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4',
        className,
      )}
      data-testid={testId}
    >
      <dt className="text-muted-foreground w-full shrink-0 text-xs sm:w-56">{label}</dt>
      <dd className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm break-words">{children}</span>
        {hint ? <span className="text-muted-foreground text-xs break-words">{hint}</span> : null}
      </dd>
    </div>
  );
}

/** A `<dl>` wrapper so the rows above line up the same way on every page. */
export function DetailList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('flex flex-col', className)}>{children}</dl>;
}

const PLATFORM_KEY: Record<Platform, string> = {
  tiktok: 'platformTikTok',
  instagram: 'platformInstagram',
  youtube: 'platformYouTube',
};

/**
 * Platform names and the specific reason a connection is unusable.
 *
 * The reason is never "invalid": the engine records `token_expired` or
 * `permission_revoked`, and the creator has to be told which one it is and what
 * to do next (ticket #4: 未绑定、失效、链接错误有具体原因和下一步).
 */
export function useConnectionCopy() {
  const t = useTranslations('creator.accounts');

  const platformName = (platform: Platform) => t(PLATFORM_KEY[platform]);

  const invalidReason = (connection: AccountConnection): string | null => {
    if (connection.status === 'valid') return null;
    if (connection.invalidReason === 'token_expired') return t('reasonTokenExpired');
    if (connection.invalidReason === 'permission_revoked') return t('reasonPermissionRevoked');
    return t('reasonUnknown');
  };

  return { platformName, invalidReason };
}
