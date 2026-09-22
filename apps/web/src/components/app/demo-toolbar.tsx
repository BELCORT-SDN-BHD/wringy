'use client';

/**
 * The demo tools panel.
 *
 * This is the only place in the prototype that can move the simulated clock, add
 * qualified views, break a data source, flip campaign readiness, decide a
 * simulated payout outcome, switch to an operations identity, load a scenario or
 * reset. The product UI must never contain any of those controls
 * (prototype-spec-v1: "不在正式creator界面放「增加观看」按钮"), which is why the
 * panel is visually separate, labelled "Demo tools", and anchored outside the
 * page content.
 *
 * Every action goes through `dispatch`, so the engine's permission and rule
 * checks apply here exactly as they do to a product action, and the result or
 * the refused error code is reported.
 */

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  Banknote,
  Clock,
  Database,
  FlaskConical,
  Map,
  Plus,
  RotateCcw,
  ShieldCheck,
  UserRound,
  WifiOff,
  Wrench,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { DateTimeText } from '@/components/app/date-time-text';
import { MoneyText } from '@/components/app/money-text';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useIsMobile } from '@/hooks/use-mobile';
import { SCENARIO_IDS, scenarioLabelKey } from '@/config/scenarios';
import { errorCopyKey } from '@/lib/error-copy';
import { formatDateTime } from '@/lib/format';
import { useAppLocale } from '@/lib/use-app-locale';
import { useActor } from '@/store/actor';
import {
  useDemoActions,
  useDemoSnapshot,
  useDispatch,
  useHydrated,
} from '@/store/demo-store';
import {
  selectAllCampaigns,
  selectAllSubmissions,
  selectSubmissionReward,
  selectSubmissionsForUser,
  selectUnresolvedPayoutAttempts,
} from '@/store/selectors';
import { useBecomeRole, type DemoRole } from '@/store/use-become-role';
import type { Command, CommandResult, ScenarioId } from '@/domain/types';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function DemoToolbar() {
  const t = useTranslations('demo');
  const hydrated = useHydrated();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (!hydrated) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-card fixed right-3 bottom-3 z-50 shadow-md sm:right-4 sm:bottom-4"
          aria-label={t('panel.open')}
          data-testid="demo-toolbar-trigger"
        >
          <Wrench aria-hidden="true" />
          <span className="hidden sm:inline">{t('panel.title')}</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className="max-h-svh overflow-y-auto"
        data-testid="demo-toolbar"
      >
        <SheetHeader className="bg-attention-subtle">
          <SheetTitle className="flex items-center gap-2">
            <FlaskConical aria-hidden="true" className="text-attention-foreground size-4" />
            {t('panel.title')}
          </SheetTitle>
          <SheetDescription>{t('panel.description')}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4 pb-6">
          <GuideLink />
          <Separator />
          <ClockSection />
          <Separator />
          <IdentitySection />
          <Separator />
          <ViewsSection />
          <Separator />
          <OutageSection />
          <Separator />
          <ReadinessSection />
          <Separator />
          <PayoutSection />
          <Separator />
          <ScenarioSection />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// The guided entry
// ---------------------------------------------------------------------------

/**
 * A link out to `/demo`.
 *
 * The panel is a control surface: it can reach any state but says nothing about
 * which state is worth reaching. The guide is the other half, so the two point at
 * each other rather than each being a dead end.
 */
function GuideLink() {
  const t = useTranslations('demo.guide');

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle icon={Map}>{t('title')}</SectionTitle>
      <p className="text-muted-foreground text-xs break-words">{t('subtitle')}</p>
      <Button asChild variant="outline" size="sm">
        <Link href="/demo" data-testid="demo-toolbar-guide">
          {t('go')}
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shared: dispatch with a toast for the outcome
// ---------------------------------------------------------------------------

type OkResult = Extract<CommandResult, { ok: true }>;
type SuccessMessage = string | ((result: OkResult) => string);

interface ToolDispatch {
  /** Dispatches and reports the outcome: the given message, or the refused code. */
  run: (command: Command, success: SuccessMessage) => CommandResult;
  /** Dispatches without a success toast, for a step inside a compound action. */
  runQuiet: (command: Command) => CommandResult;
}

function useToolDispatch(): ToolDispatch {
  const dispatch = useDispatch();
  const tErrors = useTranslations('common.errors');
  const t = useTranslations('demo');

  const reportFailure = (result: CommandResult) => {
    if (!result.ok) {
      toast.error(t('toolbar.failed', { reason: tErrors(errorCopyKey(result.code)) }));
    }
  };

  return {
    run: (command, success) => {
      const result = dispatch(command);
      if (result.ok) {
        toast.success(typeof success === 'function' ? success(result) : success);
      } else {
        reportFailure(result);
      }
      return result;
    },
    runQuiet: (command) => {
      const result = dispatch(command);
      reportFailure(result);
      return result;
    },
  };
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
      <Icon aria-hidden="true" className="text-muted-foreground size-3.5" />
      {children}
    </h3>
  );
}

/** Submission picker shared by the clock, views and outage sections. */
function useSubmissionOptions() {
  const state = useDemoSnapshot();
  const actor = useActor();

  return useMemo(() => {
    const mine = selectSubmissionsForUser(state, actor.userId || null);
    const all = selectAllSubmissions(state);
    const list = mine.length > 0 ? mine : all;
    return list.map((submission) => ({
      id: submission.id,
      label: `${submission.platform} · ${submission.postId}`,
      submission,
    }));
  }, [state, actor.userId]);
}

// ---------------------------------------------------------------------------
// Clock
// ---------------------------------------------------------------------------

function ClockSection() {
  const t = useTranslations('demo');
  const state = useDemoSnapshot();
  const { run } = useToolDispatch();
  const locale = useAppLocale();
  const options = useSubmissionOptions();
  const [submissionId, setSubmissionId] = useState<string>('');

  const selected = options.find((option) => option.id === submissionId) ?? options[0];
  const reward = useMemo(
    () => (selected ? selectSubmissionReward(state, selected.id) : null),
    [state, selected],
  );

  const meteringEndsAt = selected?.submission.meteringEndsAt ?? null;
  const claimDeadlineAt = reward?.claimDeadlineAt ?? null;

  const movedTo = (result: OkResult) =>
    t('clock.advanced', { time: formatDateTime(result.state.clock.nowIso, locale) });

  const advance = (byMs: number) => run({ type: 'demo.advanceClock', byMs }, movedTo);

  const jumpTo = (toIso: string | null) => {
    if (!toIso) {
      toast.error(t('clock.noTarget'));
      return;
    }
    run({ type: 'demo.setClock', toIso }, movedTo);
  };

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle icon={Clock}>{t('clock.title')}</SectionTitle>
      <p className="text-sm font-medium" data-testid="demo-clock">
        <DateTimeText iso={state.clock.nowIso} />
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => advance(HOUR_MS)}
          data-testid="demo-clock-hour"
        >
          {t('clock.plusHour')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => advance(DAY_MS)}
          data-testid="demo-clock-day"
        >
          {t('clock.plusDay')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => advance(7 * DAY_MS)}
          data-testid="demo-clock-week"
        >
          {t('clock.plusWeek')}
        </Button>
      </div>

      {options.length === 0 ? (
        <p className="text-muted-foreground text-xs">{t('clock.needsSubmission')}</p>
      ) : (
        <Field>
          <FieldLabel htmlFor="demo-clock-submission">{t('views.submission')}</FieldLabel>
          <Select value={selected?.id ?? ''} onValueChange={setSubmissionId}>
            <SelectTrigger id="demo-clock-submission" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id} data-submission-id={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!meteringEndsAt}
              title={meteringEndsAt ? undefined : t('clock.noTarget')}
              onClick={() => jumpTo(meteringEndsAt)}
              data-testid="demo-clock-metering-end"
            >
              {t('clock.toMeteringEnd')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!claimDeadlineAt}
              title={claimDeadlineAt ? undefined : t('clock.noTarget')}
              onClick={() => jumpTo(claimDeadlineAt)}
              data-testid="demo-clock-claim-deadline"
            >
              {t('clock.toClaimDeadline')}
            </Button>
          </div>
          {!meteringEndsAt || !claimDeadlineAt ? (
            <FieldDescription>{t('clock.noTarget')}</FieldDescription>
          ) : null}
        </Field>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/**
 * The four identities, as four buttons.
 *
 * Every switch goes through `useBecomeRole`, which is also what the `/demo`
 * guide's "Go" uses. That shared hook exists because this section used to get one
 * case wrong: it switched the *current* user's workspace, so once a reviewer had
 * become operations finance — a separate simulated user with no org — the
 * merchant button was disabled and there was no way back to Demo User at all. A
 * demo you can get stuck in is not a repeatable demo (ticket #9 / P11).
 */
function IdentitySection() {
  const t = useTranslations('demo.role');
  const state = useDemoSnapshot();
  const actor = useActor();
  const becomeRole = useBecomeRole();
  const tErrors = useTranslations('common.errors');
  const tPanel = useTranslations('demo');

  const has = (capability: 'ops_reviewer' | 'ops_finance') =>
    Object.values(state.users).some((candidate) => candidate.opsCapability === capability);

  /**
   * The org name belongs to the identity that owns the workspaces, not to
   * whoever is acting right now: the label must not change to "Merchant org"
   * just because the reviewer is currently operations.
   */
  const workspaceUser = Object.values(state.users).find(
    (candidate) => candidate.opsCapability === null && candidate.orgIds.length > 0,
  );
  const orgName = workspaceUser?.orgIds[0]
    ? (state.orgs[workspaceUser.orgIds[0]]?.name ?? null)
    : null;

  const switchTo = (role: DemoRole, label: string) => {
    const result = becomeRole(role);
    if (result.ok) {
      toast.success(t('switched', { role: label }));
      return;
    }
    toast.error(
      tPanel('toolbar.failed', {
        reason: result.failure ? tErrors(errorCopyKey(result.failure.code)) : tErrors('unknown'),
      }),
    );
  };

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle icon={UserRound}>{t('title')}</SectionTitle>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          variant={actor.role === 'creator' ? 'secondary' : 'outline'}
          size="sm"
          disabled={!workspaceUser}
          onClick={() => switchTo('creator', t('creator'))}
          data-testid="demo-role-creator"
        >
          {t('creator')}
        </Button>
        <Button
          variant={actor.role === 'merchant' ? 'secondary' : 'outline'}
          size="sm"
          disabled={!orgName}
          onClick={() => switchTo('merchant', orgName ?? t('merchant'))}
          data-testid="demo-role-merchant"
        >
          <span className="truncate">{orgName ?? t('merchant')}</span>
        </Button>
        <Button
          variant={actor.role === 'ops_reviewer' ? 'secondary' : 'outline'}
          size="sm"
          disabled={!has('ops_reviewer')}
          onClick={() => switchTo('ops_reviewer', t('opsReviewer'))}
          data-testid="demo-role-ops-reviewer"
        >
          {t('opsReviewer')}
        </Button>
        <Button
          variant={actor.role === 'ops_finance' ? 'secondary' : 'outline'}
          size="sm"
          disabled={!has('ops_finance')}
          onClick={() => switchTo('ops_finance', t('opsFinance'))}
          data-testid="demo-role-ops-finance"
        >
          {t('opsFinance')}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">{t('note')}</p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Qualified views
// ---------------------------------------------------------------------------

function ViewsSection() {
  const t = useTranslations('demo.views');
  const options = useSubmissionOptions();
  const { run } = useToolDispatch();
  const [submissionId, setSubmissionId] = useState('');
  const [custom, setCustom] = useState('1000');

  const selected = options.find((option) => option.id === submissionId) ?? options[0];
  const parsed = Number.parseInt(custom, 10);
  const customValid = Number.isInteger(parsed) && parsed > 0;

  /**
   * The engine accepts this command after the metering end and deliberately
   * counts nothing ("计量结束后不加计奖观看"), and it also accepts it during a data
   * outage and records a failed read instead of a number. Both are `ok: true`, so
   * a fixed "Added N views" toast would tell the operator the opposite of what
   * happened. The audit entry the command wrote says which case it was.
   */
  const add = (views: number) => {
    if (!selected) return;
    run({ type: 'demo.addQualifiedViews', submissionId: selected.id, views }, (result) => {
      switch (result.state.audit[result.state.audit.length - 1]?.reason) {
        case 'ignored_after_metering_end':
          return t('ignoredAfterMeteringEnd');
        case 'read_failed_source_unreachable':
          return t('ignoredSourceUnreachable');
        default:
          return t('added', { count: views });
      }
    });
  };

  if (options.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <SectionTitle icon={Plus}>{t('title')}</SectionTitle>
        <p className="text-muted-foreground text-xs">{t('none')}</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle icon={Plus}>{t('title')}</SectionTitle>
      <Field>
        <FieldLabel htmlFor="demo-views-submission">{t('submission')}</FieldLabel>
        <Select value={selected?.id ?? ''} onValueChange={setSubmissionId}>
          <SelectTrigger id="demo-views-submission" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id} data-submission-id={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Button size="sm" onClick={() => add(1000)} data-testid="demo-add-1000">
        {t('add1000')}
      </Button>
      <Field>
        <FieldLabel htmlFor="demo-views-custom">{t('customLabel')}</FieldLabel>
        <Input
          id="demo-views-custom"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          aria-invalid={custom !== '' && !customValid ? true : undefined}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={!customValid}
          onClick={() => add(parsed)}
          data-testid="demo-add-custom"
        >
          {t('add')}
        </Button>
      </Field>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Data outage
// ---------------------------------------------------------------------------

function OutageSection() {
  const t = useTranslations('demo.outage');
  const options = useSubmissionOptions();
  const { run } = useToolDispatch();

  if (options.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <SectionTitle icon={WifiOff}>{t('title')}</SectionTitle>
        <p className="text-muted-foreground text-xs">{t('description')}</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle icon={WifiOff}>{t('title')}</SectionTitle>
      <p className="text-muted-foreground text-xs">{t('description')}</p>
      <ul className="flex flex-col gap-2">
        {options.map((option) => (
          <li key={option.id} className="flex items-center justify-between gap-3">
            <Label htmlFor={`demo-outage-${option.id}`} className="min-w-0 truncate text-xs">
              {option.label}
            </Label>
            <Switch
              id={`demo-outage-${option.id}`}
              checked={option.submission.dataOutage}
              onCheckedChange={(checked) =>
                run(
                  { type: 'demo.setDataOutage', submissionId: option.id, outage: checked },
                  t('set', {
                    state: checked ? t('on') : t('off'),
                    submission: option.label,
                  }),
                )
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Campaign readiness
// ---------------------------------------------------------------------------

function ReadinessSection() {
  const t = useTranslations('demo.readiness');
  const state = useDemoSnapshot();
  const { run } = useToolDispatch();
  const campaigns = useMemo(() => selectAllCampaigns(state), [state]);

  if (campaigns.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <SectionTitle icon={ShieldCheck}>{t('title')}</SectionTitle>
        <p className="text-muted-foreground text-xs">{t('none')}</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle icon={ShieldCheck}>{t('title')}</SectionTitle>
      <ul className="flex flex-col gap-3">
        {campaigns.map((campaign) => (
          <li key={campaign.id} className="flex flex-col gap-2 rounded-lg border p-2">
            <span className="truncate text-xs font-medium">{campaign.title}</span>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={`demo-funding-${campaign.id}`} className="text-xs">
                {t('funding')}
              </Label>
              <Switch
                id={`demo-funding-${campaign.id}`}
                checked={campaign.readiness.fundingEvidence}
                onCheckedChange={(checked) =>
                  run(
                    {
                      type: 'demo.setReadiness',
                      campaignId: campaign.id,
                      fundingEvidence: checked,
                    },
                    t('set'),
                  )
                }
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={`demo-source-${campaign.id}`} className="text-xs">
                {t('dataSource')}
              </Label>
              <Switch
                id={`demo-source-${campaign.id}`}
                checked={campaign.readiness.dataSourceReady}
                onCheckedChange={(checked) =>
                  run(
                    {
                      type: 'demo.setReadiness',
                      campaignId: campaign.id,
                      dataSourceReady: checked,
                    },
                    t('set'),
                  )
                }
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Payout outcome
// ---------------------------------------------------------------------------

function PayoutSection() {
  const t = useTranslations('demo.payout');
  const state = useDemoSnapshot();
  const { run } = useToolDispatch();
  const attempts = useMemo(() => selectUnresolvedPayoutAttempts(state), [state]);

  if (attempts.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <SectionTitle icon={Banknote}>{t('title')}</SectionTitle>
        <p className="text-muted-foreground text-xs">{t('none')}</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle icon={Banknote}>{t('title')}</SectionTitle>
      <p className="text-muted-foreground text-xs">{t('description')}</p>
      <ul className="flex flex-col gap-3">
        {attempts.map((attempt) => {
          const obligation = state.obligations[attempt.obligationId];
          return (
            <li key={attempt.id} className="flex flex-col gap-2 rounded-lg border p-2">
              <span className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono">{attempt.providerRef}</span>
                <MoneyText sen={obligation?.amountSen ?? null} tabular />
              </span>
              <div className="flex flex-wrap gap-2">
                {(['succeeded', 'failed', 'unknown'] as const).map((outcome) => (
                  <Button
                    key={outcome}
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      run(
                        {
                          type: 'demo.setPayoutOutcome',
                          attemptId: attempt.id,
                          outcome,
                          // The engine requires a failure reason; the demo supplies a fixed one.
                          ...(outcome === 'failed'
                            ? { reason: 'Simulated provider failure (demo)' }
                            : {}),
                        },
                        t('set', { outcome: t(outcome) }),
                      )
                    }
                  >
                    {t(outcome)}
                  </Button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Scenarios and reset
// ---------------------------------------------------------------------------

function ScenarioSection() {
  const t = useTranslations('demo');
  const tReset = useTranslations('common.reset');
  const tErrors = useTranslations('common.errors');
  const state = useDemoSnapshot();
  const { loadScenario, reset } = useDemoActions();
  const [choice, setChoice] = useState<ScenarioId>(state.scenario);
  const [confirming, setConfirming] = useState(false);

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle icon={Database}>{t('scenario.title')}</SectionTitle>
      <p className="text-muted-foreground text-xs">{t('scenario.description')}</p>
      <Field>
        <FieldLabel htmlFor="demo-scenario">{t('scenario.title')}</FieldLabel>
        <Select value={choice} onValueChange={(next) => setChoice(next as ScenarioId)}>
          <SelectTrigger id="demo-scenario" className="w-full" data-testid="demo-scenario-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCENARIO_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                {t(scenarioLabelKey(id))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Button size="sm" onClick={() => setConfirming(true)} data-testid="demo-scenario-load">
        {t('scenario.load')}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('scenario.confirmTitle')}
        description={t('scenario.description')}
        confirmLabel={t('scenario.load')}
        destructive
        onConfirm={() => {
          const result = loadScenario(choice);
          setConfirming(false);
          if (result.ok) {
            toast.success(
              t('scenario.loaded', { scenario: t(scenarioLabelKey(choice)) }),
            );
          } else {
            toast.error(t('toolbar.failed', { reason: tErrors(errorCopyKey(result.code)) }));
          }
        }}
      />

      <Separator />

      <SectionTitle icon={RotateCcw}>{t('reset.title')}</SectionTitle>
      <ConfirmDialog
        trigger={
          <Button variant="destructive" size="sm" data-testid="demo-reset">
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
          else toast.error(t('toolbar.failed', { reason: tErrors(errorCopyKey(result.code)) }));
        }}
      />
    </section>
  );
}
