'use client';

/**
 * Placeholder overview for a role workspace.
 *
 * WAVE-2 WORKERS: replace the page that renders this
 * (`src/app/(demo)/(workspace)/{creator,merchant,ops}/page.tsx`) with the real overview.
 * It exists now so the shell, the guards, the navigation and the four budget
 * buckets can be demonstrated and tested end to end before the role features
 * land. Everything it shows already comes from engine selectors, so nothing has
 * to be rewired.
 */

import Link from 'next/link';
import { Bell, LayoutDashboard } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { BudgetBuckets } from '@/components/app/budget-buckets';
import { DataUnavailable } from '@/components/app/data-unavailable';
import { DateTimeText } from '@/components/app/date-time-text';
import { EmptyState } from '@/components/app/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatViewsOrUnknown } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';
import { useActor } from '@/store/actor';
import { useDemoSnapshot } from '@/store/demo-store';
import {
  selectBudget,
  selectOrgCampaigns,
  selectPublicCampaigns,
  selectSubmissionReward,
  selectSubmissionsForUser,
  selectUnreadCount,
} from '@/store/selectors';

export function WorkspaceOverview() {
  const t = useTranslations('common');
  const tNotifications = useTranslations('notifications');
  const state = useDemoSnapshot();
  const actor = useActor();
  const locale = useAppLocale();
  const role = actor.role;

  const campaigns = useMemo(() => {
    const own = selectOrgCampaigns(state, actor);
    const visible =
      own.length > 0
        ? own
        : role === 'ops_reviewer' || role === 'ops_finance'
          ? // Operations see every campaign, including drafts they must check.
            Object.values(state.campaigns)
          : selectPublicCampaigns(state);

    // `selectBudget` returns a fresh object per call, so it is computed here,
    // once per state reference, rather than during every render.
    return visible.map((campaign) => ({ campaign, budget: selectBudget(state, campaign.id) }));
  }, [state, actor, role]);

  const unread = useMemo(
    () => selectUnreadCount(state, actor.userId || null, actor.role),
    [state, actor.userId, actor.role],
  );

  /**
   * Submissions whose source cannot be read right now. Ticket #2 requires the
   * page to keep the last trusted number with its time and never show 0 views
   * for missing data, so this stays on the overview rather than waiting for the
   * wave-2 submission pages.
   */
  const unreadable = useMemo(() => {
    return selectSubmissionsForUser(state, actor.userId || null)
      .map((submission) => ({ submission, reward: selectSubmissionReward(state, submission.id) }))
      .filter(({ reward }) => reward !== null && reward.dataStatus !== 'trusted');
  }, [state, actor.userId]);

  const groupKey =
    role === 'merchant' ? 'groupMerchant' : role === 'creator' ? 'groupCreator' : 'groupOps';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">
          {t(`nav.${groupKey}`)} · {t('nav.overview')}
        </h1>
        <p className="text-muted-foreground text-sm">
          <DateTimeText iso={state.clock.nowIso} />
        </p>
      </header>

      <Alert>
        <Bell aria-hidden="true" />
        <AlertTitle>
          {unread > 0 ? t('shell.unreadCount', { count: unread }) : t('shell.noUnread')}
        </AlertTitle>
        <AlertDescription>
          <span>{tNotifications('subtitle')}</span>
          <span className="mt-2 flex">
            <Button asChild variant="outline" size="sm">
              <Link href="/notifications">{t('nav.notifications')}</Link>
            </Button>
          </span>
        </AlertDescription>
      </Alert>

      {unreadable.length > 0 ? (
        <section className="flex flex-col gap-3" data-testid="overview-data-unavailable">
          {unreadable.map(({ submission, reward }) => (
            <DataUnavailable
              key={submission.id}
              lastTrustedAt={reward?.lastTrustedAt ?? null}
              lastValue={`${formatViewsOrUnknown(reward?.qualifiedViews ?? null, locale)} · ${t('views.qualifiedLabel')}`}
              reason={submission.status}
            />
          ))}
        </section>
      ) : null}

      {campaigns.length === 0 ? (
        <EmptyState icon={LayoutDashboard} />
      ) : (
        <section className="flex flex-col gap-4">
          {campaigns.map(({ campaign, budget }) => (
            <Card key={campaign.id}>
              <CardHeader>
                <CardTitle className="break-words">{campaign.title}</CardTitle>
                <CardDescription>{t('budget.title')}</CardDescription>
              </CardHeader>
              <CardContent>
                <BudgetBuckets budget={budget} bare />
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
