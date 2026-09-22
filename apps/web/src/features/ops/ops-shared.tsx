'use client';

/**
 * Pieces every operations page needs.
 *
 * The ops workspace is where the demo has to be most careful about three things,
 * so they live here once rather than in each page:
 *
 *   1. A refused command is shown, not swallowed. `useOpsCommand` keeps the
 *      engine's `ErrorCode` on the page as `CommandErrorAlert` (state-policy.md:
 *      money-critical refusals stay on the page, not only in a toast).
 *   2. A capability the actor does not hold renders `ForbiddenState` AND still
 *      offers the control, because kickoff decision 7 requires the engine — not a
 *      hidden button — to be the check. `FinanceOnly` does exactly that.
 *   3. Every decision is readable afterwards. `AuditTrail` renders the engine's
 *      own audit rows with actor, reason and the status before and after.
 */

import Link from 'next/link';
import { ArrowLeft, ExternalLink, Lock } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ReactNode } from 'react';

import { CommandErrorAlert } from '@/components/app/error-state';
import { DateTimeText } from '@/components/app/date-time-text';
import { ForbiddenState } from '@/components/app/forbidden-state';
import { TimelineList, type TimelineEntry } from '@/components/app/timeline-list';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { checkPermission, resolveActor } from '@/domain';
import type { AuditEntry, Command, DemoState, ErrorCode } from '@/domain/types';
import { formatAuditAction } from '@/lib/audit-copy';
import { reasonLabel } from '@/lib/reason-copy';
import { auditStatusLabel } from '@/lib/status-copy';
import { useAppLocale } from '@/lib/use-app-locale';
import { useDemoSnapshot, useDispatch } from '@/store/demo-store';
import { selectAuditFor } from '@/store/selectors';

// ---------------------------------------------------------------------------
// Dispatching a command and keeping the refusal visible
// ---------------------------------------------------------------------------

export interface OpsCommandState {
  /** The engine's refusal, kept until the next attempt. */
  error: { code: ErrorCode; detail?: string } | null;
  /** Sends the command; shows a toast on success, an alert on refusal. */
  run: (command: Command, successMessage: string) => boolean;
  clear: () => void;
}

/**
 * One command runner per page. A fresh `commandId` is minted per press by the
 * store, so a double click replays instead of applying twice.
 */
export function useOpsCommand(): OpsCommandState {
  const dispatch = useDispatch();
  const [error, setError] = useState<OpsCommandState['error']>(null);

  const run = useCallback(
    (command: Command, successMessage: string) => {
      const result = dispatch(command);
      if (result.ok) {
        setError(null);
        toast.success(successMessage);
        return true;
      }
      setError({ code: result.code, detail: result.detail });
      return false;
    },
    [dispatch],
  );

  return { error, run, clear: useCallback(() => setError(null), []) };
}

/** The refusal alert, rendered where the action is so it cannot be missed. */
export function OpsCommandError({ state }: { state: OpsCommandState }) {
  const t = useTranslations('ops.shared');
  if (!state.error) return null;
  return (
    <div className="flex flex-col gap-2" data-testid="ops-command-error">
      <CommandErrorAlert code={state.error.code} detail={state.error.detail} />
      <p className="text-muted-foreground text-xs">{t('noAuditRecorded')}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page furniture
// ---------------------------------------------------------------------------

export interface OpsPageHeaderProps {
  title: string;
  description: string;
  /** Status badges and the like, shown under the title. */
  meta?: ReactNode;
  /** Shown on a detail page; the queue is the ops landing page. */
  backToQueue?: boolean;
  actions?: ReactNode;
}

export function OpsPageHeader({
  title,
  description,
  meta,
  backToQueue,
  actions,
}: OpsPageHeaderProps) {
  const t = useTranslations('ops.shared');
  const state = useDemoSnapshot();

  return (
    <header className="flex min-w-0 flex-col gap-3">
      {backToQueue ? (
        <Button asChild variant="ghost" size="sm" className="self-start">
          <Link href="/ops">
            <ArrowLeft aria-hidden="true" />
            <span className="truncate">{t('backToQueue')}</span>
          </Link>
        </Button>
      ) : null}
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold break-words">{title}</h1>
          <p className="text-muted-foreground text-sm break-words">{description}</p>
          <p className="text-muted-foreground text-xs">
            {t('clockLabel')} · <DateTimeText iso={state.clock.nowIso} />
          </p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
    </header>
  );
}

/** A record id in the address bar that matches nothing. Not an empty list. */
export function OpsNotFound() {
  const t = useTranslations('ops.shared');
  return (
    <div className="flex flex-col gap-4">
      <Empty className="border" data-app-state="empty" data-testid="ops-not-found">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Lock aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t('notFoundTitle')}</EmptyTitle>
          <EmptyDescription>{t('notFoundDescription')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
      <Button asChild variant="outline" className="self-start">
        <Link href="/ops">{t('backToQueue')}</Link>
      </Button>
    </div>
  );
}

/** Label/value rows. `dl` rather than a table: these are facts, not a grid. */
export function FactList({
  items,
  className,
}: {
  /** `hint` is the one-line reason under a value, for a fact that needs one. */
  items: Array<{ label: string; value: ReactNode; hint?: string }>;
  className?: string;
}) {
  return (
    <dl className={className ?? 'grid gap-3 sm:grid-cols-2'}>
      {items.map(({ label, value, hint }, index) => (
        <div key={`${label}-${index}`} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs break-words">{label}</dt>
          <dd className="min-w-0 text-sm break-words">{value}</dd>
          {hint ? (
            <p className="text-muted-foreground text-xs break-words">{hint}</p>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

/** A link to another record, used from every ops detail page. */
export function OpsLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href}>
        <span className="truncate">{children}</span>
        <ExternalLink aria-hidden="true" />
      </Link>
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Capability separation
// ---------------------------------------------------------------------------

/**
 * Wraps a finance-only panel.
 *
 * An ops reviewer sees `ForbiddenState`, the engine's own denial code for the
 * command it would have sent, and a control that sends it anyway — so the demo
 * shows that the check is the engine's, not the button's, and that a refused
 * command records nothing.
 */
export function FinanceOnly({
  probeCommand,
  children,
}: {
  /** The command whose refusal is demonstrated. */
  probeCommand: Command;
  children: ReactNode;
}) {
  const t = useTranslations('ops.shared');
  const state = useDemoSnapshot();
  const command = useOpsCommand();

  const denial = useMemo(() => {
    const actor = resolveActor(state);
    return checkPermission(actor, probeCommand, state);
  }, [state, probeCommand]);

  if (denial === null) return <>{children}</>;

  return (
    <div className="flex flex-col gap-4" data-testid="ops-finance-forbidden">
      <ForbiddenState homeHref="/ops" />
      <Alert>
        <Lock aria-hidden="true" />
        <AlertTitle>{t('financeOnlyTitle')}</AlertTitle>
        <AlertDescription className="flex flex-col gap-1">
          <span className="break-words">{t('financeOnlyDescription')}</span>
          <span className="break-words">{t('simulatedCheck')}</span>
          <span className="break-words" data-testid="ops-engine-denial">
            {t('engineWouldRefuse', { code: denial.code })}
          </span>
          <span className="mt-2 flex flex-col gap-2">
            <span className="text-xs break-words">{t('probeDescription')}</span>
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              data-testid="ops-finance-probe"
              onClick={() => command.run(probeCommand, t('engineRefusedTitle'))}
            >
              {t('probeFinanceAction')}
            </Button>
          </span>
        </AlertDescription>
      </Alert>
      <OpsCommandError state={command} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

/**
 * Display name for an audit actor.
 *
 * An empty id is what the engine records when the demo tools acted with nobody
 * signed in, and a money-moving row must still name what acted: without a label
 * `TimelineList` drops the "by …" line altogether and a settlement reads as
 * unattributable on the one page whose job is to prove every operation is
 * traceable (#7 "所有模拟操作留原因/原交易/记录"). Callers pass the localized label.
 */
export function actorName(state: DemoState, userId: string, noIdentityLabel?: string): string {
  if (userId === '') return noIdentityLabel ?? userId;
  return state.users[userId]?.displayName ?? userId;
}

export function auditEntries(
  state: DemoState,
  targetType: AuditEntry['targetType'],
  targetId: string,
): AuditEntry[] {
  return selectAuditFor(state, targetType, targetId);
}

export function AuditTrail({
  targetType,
  targetId,
  extra = [],
}: {
  targetType: AuditEntry['targetType'];
  targetId: string;
  /** Other targets whose rows belong in the same story, e.g. the claim's appeal. */
  extra?: Array<{ targetType: AuditEntry['targetType']; targetId: string }>;
}) {
  const t = useTranslations('ops.shared');
  const tActions = useTranslations('common.actions');
  const tCommon = useTranslations('common');
  const locale = useAppLocale();
  const state = useDemoSnapshot();

  const entries = useMemo<TimelineEntry[]>(() => {
    const rows = [
      ...auditEntries(state, targetType, targetId),
      ...extra.flatMap((ref) => auditEntries(state, ref.targetType, ref.targetId)),
    ];
    return rows.map((entry) => ({
      id: entry.id,
      at: entry.at,
      title: formatAuditAction(entry.action, tActions),
      actor: actorName(state, entry.actorUserId, t('actorNoIdentity')),
      reason: reasonLabel(entry.reason, tCommon, locale),
      trailing:
        entry.before !== null || entry.after !== null ? (
          // Words, not the engine's codes. `before`/`after` are short status
          // summaries the engine writes, so this badge used to read
          // "pending_review → rejected_appealable" inside an otherwise
          // translated page; `auditStatusLabel` maps them through the same
          // `common.status.*` copy `StatusBadge` uses. No longer `font-mono`:
          // that typeface was for codes.
          // `whitespace-normal break-words` because the labels are now sentences:
          // `Badge` is `whitespace-nowrap` upstream, which at 320px pushed the row
          // sideways once the codes became words.
          <Badge
            variant="outline"
            className="max-w-full text-[10px] break-words whitespace-normal"
          >
            {t('auditBeforeAfter', {
              before: auditStatusLabel(entry.before, entry.targetType, tCommon, locale) ?? '—',
              after: auditStatusLabel(entry.after, entry.targetType, tCommon, locale) ?? '—',
            })}
          </Badge>
        ) : undefined,
    }));
    // `extra` is a literal at every call site, so its identity is stable enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, targetType, targetId, t, tActions, tCommon, locale]);

  return (
    <Card data-testid="ops-audit">
      <CardHeader>
        <CardTitle>{t('auditTitle')}</CardTitle>
        <CardDescription>{t('auditDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <TimelineList entries={entries} />
      </CardContent>
    </Card>
  );
}
