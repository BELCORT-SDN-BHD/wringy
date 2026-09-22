'use client';

/**
 * `/demo` — the guided entry to the prototype (ticket #9).
 *
 * The demo tools panel can reach every state, but it is a control surface: it
 * assumes you already know which state you want. This page is the other half —
 * it names the seven steps of the main flow in order, with the role and the page
 * each one happens on, and names each exception scenario with what to look at
 * once it is loaded. "Go" does the identity switch for you, because forgetting to
 * switch is the single most common way to end up on a permission refusal and
 * think the prototype is broken.
 *
 * The step and scenario copy is the spec's own vocabulary (issue #1, "一条主流程"
 * and "必须提供的异常场景"); this page does not invent a rule or a number.
 *
 * It is a public route so the link can be handed over without an identity, and
 * the page itself is honest about that: until the demo state has hydrated there
 * is no clock and no identity to show.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  CircleAlert,
  Clock,
  HandCoins,
  RotateCcw,
  ShieldCheck,
  UserRound,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { LucideIcon } from 'lucide-react';

import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { DateTimeText, TimeZoneHint } from '@/components/app/date-time-text';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SCENARIO_IDS, scenarioLabelKey } from '@/config/scenarios';
import { errorCopyKey } from '@/lib/error-copy';
import { useActor } from '@/store/actor';
import { useDemoActions, useDemoSnapshot, useHydrated } from '@/store/demo-store';
import { useBecomeRole, type DemoRole } from '@/store/use-become-role';
import type { ScenarioId } from '@/domain/types';

// ---------------------------------------------------------------------------
// The seven steps and the ten scenarios, as data
// ---------------------------------------------------------------------------

const ROLE_COPY: Record<DemoRole, { key: string; icon: LucideIcon }> = {
  creator: { key: 'roleCreator', icon: UserRound },
  merchant: { key: 'roleMerchant', icon: Building2 },
  ops_reviewer: { key: 'roleOpsReviewer', icon: ShieldCheck },
  ops_finance: { key: 'roleOpsFinance', icon: HandCoins },
};

interface FlowStep {
  /** `flow.step<n>` in `demo.json`. */
  n: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  role: DemoRole;
  href: string;
}

/**
 * The main flow of issue #1, one entry per numbered step, in its order.
 *
 * The hrefs are list pages, not record pages, wherever a record's id depends on
 * what the visitor did: a link to `/creator/submissions/sub-…` would break the
 * moment someone submits their own post, and a broken "Go" is worse than one
 * extra click.
 */
const FLOW: readonly FlowStep[] = [
  { n: 1, role: 'merchant', href: '/merchant/campaigns' },
  { n: 2, role: 'merchant', href: '/merchant/campaigns' },
  { n: 3, role: 'creator', href: '/campaigns' },
  { n: 4, role: 'creator', href: '/creator/submissions' },
  { n: 5, role: 'creator', href: '/creator/submissions' },
  { n: 6, role: 'ops_reviewer', href: '/ops' },
  { n: 7, role: 'merchant', href: '/merchant/reports' },
];

/** Where each scenario is worth looking, and as whom. */
const SCENARIO_LANDING: Record<ScenarioId, { role: DemoRole; href: string }> = {
  baseline: { role: 'creator', href: '/creator' },
  main_flow_ready: { role: 'creator', href: '/creator/submissions' },
  partial_budget: { role: 'creator', href: '/creator/submissions' },
  waitlist: { role: 'creator', href: '/creator/claims' },
  rejection_appeal: { role: 'creator', href: '/creator/claims' },
  payout_unknown: { role: 'ops_finance', href: '/ops/payouts' },
  payout_failed: { role: 'ops_finance', href: '/ops/payouts' },
  deadline_extension: { role: 'creator', href: '/creator/submissions' },
  campaign_closure: { role: 'merchant', href: '/merchant/campaigns' },
  data_outage: { role: 'ops_reviewer', href: '/ops/exceptions' },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function DemoGuideView() {
  const t = useTranslations('demo.guide');
  const hydrated = useHydrated();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Badge variant="outline" className="w-fit">
          {t('eyebrow')}
        </Badge>
        <h1 className="font-heading text-2xl font-semibold text-balance sm:text-3xl">
          {t('title')}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm">{t('subtitle')}</p>
      </header>

      {hydrated ? <StateBar /> : <Skeleton className="h-28 w-full" data-testid="demo-guide-loading" />}

      <FlowSection />
      <BucketsNote />
      <ScenariosSection />
      <ToolsNote />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Where the demo stands right now
// ---------------------------------------------------------------------------

function StateBar() {
  const t = useTranslations('demo.guide');
  const tScenario = useTranslations('demo');
  const tReset = useTranslations('common.reset');
  const tErrors = useTranslations('common.errors');
  const state = useDemoSnapshot();
  const actor = useActor();
  const { reset } = useDemoActions();

  const roleLabel = actor.role === 'guest' ? t('roleGuest') : t(ROLE_COPY[actor.role].key);

  return (
    <Card data-testid="demo-guide-state">
      <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-start sm:justify-between">
        <dl className="grid min-w-0 gap-3 sm:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-muted-foreground flex items-center gap-1 text-xs">
              <Clock aria-hidden="true" className="size-3.5" />
              {t('clockLabel')}
            </dt>
            <dd className="text-sm break-words" data-testid="demo-guide-clock">
              <DateTimeText iso={state.clock.nowIso} />
            </dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">{t('scenarioLabel')}</dt>
            <dd className="text-sm break-words" data-testid="demo-guide-scenario">
              {tScenario(scenarioLabelKey(state.scenario))}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">{t('identityLabel')}</dt>
            <dd className="text-sm break-words" data-testid="demo-guide-identity">
              {roleLabel}
            </dd>
          </div>
        </dl>

        <div className="flex shrink-0 flex-col items-start gap-1">
          <ConfirmDialog
            trigger={
              <Button variant="destructive" size="sm" data-testid="demo-guide-reset">
                <RotateCcw aria-hidden="true" />
                {tReset('action')}
              </Button>
            }
            title={tReset('title')}
            description={tReset('description')}
            confirmLabel={tReset('action')}
            destructive
            onConfirm={() => {
              const result = reset();
              if (result.ok) toast.success(tReset('done'));
              else toast.error(t('failed', { reason: tErrors(errorCopyKey(result.code)) }));
            }}
          />
          <TimeZoneHint />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// "Go": switch identity, then navigate
// ---------------------------------------------------------------------------

/**
 * One button that reaches a page as a role.
 *
 * The identity switch happens before the navigation so the target page renders
 * with the right actor on its first paint, rather than showing the simulated
 * refusal for a frame.
 */
function GoButton({
  role,
  href,
  label,
  testId,
}: {
  role: DemoRole;
  href: string;
  label: string;
  testId: string;
}) {
  const t = useTranslations('demo.guide');
  const tErrors = useTranslations('common.errors');
  const becomeRole = useBecomeRole();
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant="outline"
      data-testid={testId}
      data-role={role}
      data-href={href}
      onClick={() => {
        const result = becomeRole(role);
        if (!result.ok) {
          toast.error(
            t('failed', {
              reason: result.failure
                ? tErrors(errorCopyKey(result.failure.code))
                : tErrors('unknown'),
            }),
          );
          return;
        }
        router.push(href);
      }}
    >
      <span className="truncate">{label}</span>
      <ArrowRight aria-hidden="true" />
    </Button>
  );
}

function RoleBadge({ role }: { role: DemoRole }) {
  const t = useTranslations('demo.guide');
  const Icon = ROLE_COPY[role].icon;

  return (
    <Badge variant="outline" className="gap-1" data-role={role}>
      <Icon aria-hidden="true" />
      <span className="truncate">{t(ROLE_COPY[role].key)}</span>
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

function FlowSection() {
  const t = useTranslations('demo.guide');

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-medium">{t('flowTitle')}</h2>
        <p className="text-muted-foreground text-sm">{t('flowSubtitle')}</p>
      </div>

      <ol className="flex flex-col gap-3" data-testid="demo-guide-flow">
        {FLOW.map((step) => (
          <li key={step.n}>
            <Card data-step={step.n}>
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="bg-brand text-brand-foreground border-transparent tabular-nums"
                  >
                    {t('stepLabel', { n: step.n })}
                  </Badge>
                  <RoleBadge role={step.role} />
                </div>
                <CardTitle className="text-base break-words">
                  {t(`flow.step${step.n}.title`)}
                </CardTitle>
                <CardDescription className="break-words">
                  {t(`flow.step${step.n}.body`)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GoButton
                  role={step.role}
                  href={step.href}
                  label={t('go')}
                  testId={`demo-guide-go-step-${step.n}`}
                />
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The bucket sequence the main flow is supposed to produce, spelled out. */
function BucketsNote() {
  const t = useTranslations('demo.guide');

  return (
    <Alert data-testid="demo-guide-buckets">
      <HandCoins aria-hidden="true" />
      <AlertTitle>{t('bucketsTitle')}</AlertTitle>
      <AlertDescription className="flex flex-col gap-1">
        <span className="font-mono text-xs break-words tabular-nums">{t('bucketsSequence')}</span>
        <span className="break-words">{t('bucketsNote')}</span>
      </AlertDescription>
    </Alert>
  );
}

// ---------------------------------------------------------------------------
// Exception scenarios
// ---------------------------------------------------------------------------

function ScenariosSection() {
  const t = useTranslations('demo.guide');

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-medium">{t('scenariosTitle')}</h2>
        <p className="text-muted-foreground text-sm">{t('scenariosSubtitle')}</p>
      </div>

      <ul className="flex flex-col gap-3" data-testid="demo-guide-scenarios">
        {SCENARIO_IDS.map((id) => (
          <li key={id}>
            <ScenarioCard id={id} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ScenarioCard({ id }: { id: ScenarioId }) {
  const t = useTranslations('demo.guide');
  const tScenario = useTranslations('demo');
  const tErrors = useTranslations('common.errors');
  const { loadScenario } = useDemoActions();
  const becomeRole = useBecomeRole();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const landing = SCENARIO_LANDING[id];

  /**
   * Loading discards whatever the visitor changed, so it is confirmed first.
   * Afterwards the identity is switched and the page opened, because a scenario
   * read as the wrong role looks like an empty state rather than a scenario.
   */
  const loadAndOpen = () => {
    const result = loadScenario(id);
    setConfirming(false);
    if (!result.ok) {
      toast.error(t('failed', { reason: tErrors(errorCopyKey(result.code)) }));
      return;
    }
    toast.success(tScenario('scenario.loaded', { scenario: tScenario(scenarioLabelKey(id)) }));
    const became = becomeRole(landing.role);
    if (!became.ok) {
      toast.error(
        t('failed', {
          reason: became.failure ? tErrors(errorCopyKey(became.failure.code)) : tErrors('unknown'),
        }),
      );
      return;
    }
    router.push(landing.href);
  };

  return (
    <Card data-scenario-id={id}>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-attention-subtle border-transparent">
            {tScenario(scenarioLabelKey(id))}
          </Badge>
          <RoleBadge role={landing.role} />
        </div>
        <CardDescription className="break-words">{t(`look.${id}`)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={t('loadConfirmTitle', { scenario: tScenario(scenarioLabelKey(id)) })}
          description={tScenario('scenario.description')}
          confirmLabel={t('loadAndOpen')}
          destructive
          onConfirm={loadAndOpen}
          trigger={
            <Button size="sm" data-testid={`demo-guide-load-${id}`}>
              {t('loadAndOpen')}
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Footer notes
// ---------------------------------------------------------------------------

function ToolsNote() {
  const t = useTranslations('demo.guide');

  return (
    <Alert data-testid="demo-guide-tools-note">
      <Wrench aria-hidden="true" />
      <AlertTitle>{t('toolsTitle')}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span className="break-words">{t('toolsNote')}</span>
        <span className="flex flex-wrap items-center gap-2">
          <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="break-words">{t('simulatedNote')}</span>
        </span>
        <span className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/campaigns">{t('browseCampaigns')}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/">{t('backHome')}</Link>
          </Button>
        </span>
      </AlertDescription>
    </Alert>
  );
}
