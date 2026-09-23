import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import type { WorkerHealth, WorkerHealthResponse } from '@wringy/contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Locale } from '@/i18n/config';
import { formatDateTime } from '@/lib/format';

import { ApiFailureAlert } from './api-failure';
import type { ApiRead } from './api-read';
import { InstantText } from './instant-text';
import { PROCESS_STATE_STYLE, QUEUE_STATE_STYLE, StateBadge, UNKNOWN_STATE, styleOf } from './state-badge';

/** Process states with their own label; `never_seen` and anything unrecognised read "unknown". */
const PROCESS_LABELLED = new Set(['healthy', 'stale', 'stopped']);
/** Queue states with their own label; `never` and anything unrecognised read "unknown". */
const QUEUE_LABELLED = new Set(['ok', 'overdue']);

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-0.5 sm:grid-cols-[11rem_1fr] sm:gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/**
 * 后台任务健康状态: one card per worker row of `GET /internal/worker-health`,
 * with the process state (from the heartbeat) and the queue state (from the
 * pg-boss round trip) the API judged on the database clock. A state the API
 * could not know yet (`never_seen`, `never`) and a missing time read as the
 * localized "unknown" word, never as 0 or a dash; an empty list is "no worker
 * has reported yet", an unknown state rather than a healthy count of zero.
 */
export async function WorkerHealthSection({ read, locale }: { read: ApiRead<WorkerHealthResponse>; locale: Locale }) {
  const t = await getTranslations('internal');
  const tCommon = await getTranslations('common');
  const unknown = tCommon('state.unknown');

  const processLabel = (worker: WorkerHealth) =>
    PROCESS_LABELLED.has(worker.state) ? t(`processState.${worker.state as 'healthy' | 'stale' | 'stopped'}`) : unknown;
  const queueLabel = (worker: WorkerHealth) =>
    QUEUE_LABELLED.has(worker.queueState) ? t(`queueState.${worker.queueState as 'ok' | 'overdue'}`) : unknown;

  return (
    <section aria-labelledby="internal-workers-title" data-internal-section="workers" className="flex min-w-0 flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h2 id="internal-workers-title" className="text-lg font-semibold tracking-tight">
          {t('workers.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('workers.description')}</p>
      </header>

      {!read.ok ? (
        <ApiFailureAlert failure={read.failure} />
      ) : read.data.workers.length === 0 ? (
        <Card data-app-state="no-workers" data-worker-state="unknown">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {t('workers.noneTitle')}
              <StateBadge kind="process" code="unknown" style={UNKNOWN_STATE} label={unknown} />
            </CardTitle>
            <CardDescription>{t('workers.noneDescription')}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid min-w-0 gap-3 lg:grid-cols-2">
          {read.data.workers.map((worker) => (
            <Card
              key={worker.workerId}
              className="min-w-0"
              data-worker-id={worker.workerId}
              data-worker-state={worker.state}
              data-queue-state={worker.queueState}
            >
              <CardHeader>
                <CardTitle className="font-mono break-all">{worker.workerId}</CardTitle>
                <CardDescription className="flex flex-wrap gap-2">
                  <StateBadge
                    kind="process"
                    code={worker.state}
                    style={styleOf(PROCESS_STATE_STYLE, worker.state)}
                    label={t('workers.badge', { field: t('workers.fields.process'), value: processLabel(worker) })}
                  />
                  <StateBadge
                    kind="queue"
                    code={worker.queueState}
                    style={styleOf(QUEUE_STATE_STYLE, worker.queueState)}
                    label={t('workers.badge', { field: t('workers.fields.queue'), value: queueLabel(worker) })}
                  />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="flex flex-col gap-2 text-sm">
                  <Field label={t('workers.fields.image')}>
                    <span className="font-mono text-xs break-all" data-field="image-ref">
                      {worker.imageRef}
                    </span>
                  </Field>
                  <Field label={t('workers.fields.started')}>
                    <InstantText iso={worker.startedAt} locale={locale} unknownLabel={unknown} />
                  </Field>
                  <Field label={t('workers.fields.lastBeat')}>
                    <InstantText iso={worker.lastBeatAt} locale={locale} unknownLabel={unknown} />
                  </Field>
                  <Field label={t('workers.fields.lastRoundTrip')}>
                    <span data-field="last-round-trip">
                      <InstantText iso={worker.lastQueueRoundTripAt} locale={locale} unknownLabel={unknown} />
                    </span>
                  </Field>
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {read.ok ? (
        <p className="text-xs text-muted-foreground" data-data-as-of="workers">
          <time dateTime={read.data.dbNow}>
            {t('workers.checkedAt', { time: formatDateTime(read.data.dbNow, locale) })}
          </time>
        </p>
      ) : null}
    </section>
  );
}
