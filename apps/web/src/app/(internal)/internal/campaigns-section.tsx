import { Inbox } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { InternalCampaignsResponse } from '@wringy/contracts';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Locale } from '@/i18n/config';
import { formatDateTime } from '@/lib/format';

import { ApiFailureAlert } from './api-failure';
import type { ApiRead } from './api-read';
import { InstantText } from './instant-text';
import { CAMPAIGN_STATUS_STYLE, DATA_ORIGIN_STYLE, StateBadge, styleOf } from './state-badge';

/**
 * The fixture campaigns as `GET /internal/campaigns` returned them (read from
 * PostgreSQL by the API's runtime login), with an explicit empty state and an
 * explicit failure state. On a narrow screen the table scrolls sideways inside
 * its own container (the official Table's `overflow-x-auto`), never the page.
 */
export async function CampaignsSection({ read, locale }: { read: ApiRead<InternalCampaignsResponse>; locale: Locale }) {
  const t = await getTranslations('internal');
  const tCommon = await getTranslations('common');
  const unknown = tCommon('state.unknown');

  return (
    <section aria-labelledby="internal-campaigns-title" data-internal-section="campaigns" className="flex min-w-0 flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h2 id="internal-campaigns-title" className="text-lg font-semibold tracking-tight">
          {t('campaigns.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('campaigns.description')}</p>
      </header>

      {!read.ok ? (
        <ApiFailureAlert failure={read.failure} />
      ) : read.data.items.length === 0 ? (
        <Empty className="border" data-app-state="empty">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t('campaigns.emptyTitle')}</EmptyTitle>
            <EmptyDescription>{t('campaigns.emptyDescription')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="min-w-0 py-2">
          <CardContent className="px-2">
            <Table data-testid="internal-campaigns-table">
              <TableCaption className="sr-only">{t('campaigns.caption')}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('campaigns.columns.title')}</TableHead>
                  <TableHead>{t('campaigns.columns.org')}</TableHead>
                  <TableHead>{t('campaigns.columns.status')}</TableHead>
                  <TableHead>{t('campaigns.columns.origin')}</TableHead>
                  <TableHead>{t('campaigns.columns.updated')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {read.data.items.map((campaign) => {
                  const statusKnown = Object.hasOwn(CAMPAIGN_STATUS_STYLE, campaign.status);
                  const originKnown = Object.hasOwn(DATA_ORIGIN_STYLE, campaign.dataOrigin);
                  return (
                    <TableRow key={campaign.id} data-campaign-id={campaign.id}>
                      <TableCell className="font-medium" data-field="title">
                        {campaign.title}
                      </TableCell>
                      <TableCell data-field="org">{campaign.orgName}</TableCell>
                      <TableCell>
                        <StateBadge
                          kind="campaign-status"
                          code={campaign.status}
                          style={styleOf(CAMPAIGN_STATUS_STYLE, campaign.status)}
                          label={statusKnown ? tCommon(`status.campaign.${campaign.status}`) : unknown}
                        />
                      </TableCell>
                      <TableCell>
                        <StateBadge
                          kind="data-origin"
                          code={campaign.dataOrigin}
                          style={styleOf(DATA_ORIGIN_STYLE, campaign.dataOrigin)}
                          label={originKnown ? t(`dataOrigin.${campaign.dataOrigin}`) : unknown}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <InstantText iso={campaign.updatedAt} locale={locale} unknownLabel={unknown} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {read.ok ? (
        <p className="text-xs text-muted-foreground" data-data-as-of="campaigns">
          <time dateTime={read.data.dataAsOf}>
            {t('campaigns.dataAsOf', { time: formatDateTime(read.data.dataAsOf, locale) })}
          </time>
        </p>
      ) : null}
    </section>
  );
}
