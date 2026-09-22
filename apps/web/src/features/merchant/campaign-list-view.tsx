'use client';

/**
 * The merchant's campaign list: a dense Linear-style table on a wide screen and
 * the same rows as cards below `sm`, because a five-column money table cannot be
 * read at 390px and a sideways scroll is an acceptance failure (P10).
 *
 * "New campaign" creates the draft through `campaign.createDraft` — which starts
 * from the approved defaults — and goes straight to the editor, so the merchant
 * never faces an empty form (campaign-configuration-v1: "平台提供默认配置，商家可调整",
 * and the setup flow is not "start from blank").
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Hourglass, Megaphone, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { EmptyState } from '@/components/app/empty-state';
import { CommandErrorAlert } from '@/components/app/error-state';
import { HydrationGate } from '@/components/app/hydration-gate';
import { MoneyText } from '@/components/app/money-text';
import { StatusBadge } from '@/components/app/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item';

import { useCreateDraft, useMerchantCampaignRows } from './hooks';
import type { MerchantCampaignRow } from './selectors';

export function MerchantCampaignListView() {
  return (
    <HydrationGate>
      <CampaignList />
    </HydrationGate>
  );
}

/** Shared by the list page and the overview's "New campaign" button. */
export function NewCampaignButton({
  onError,
  size = 'default',
}: {
  onError?: (error: { code: string; detail?: string }) => void;
  size?: 'default' | 'sm';
}) {
  const t = useTranslations('merchant.campaigns');
  const router = useRouter();
  const createDraft = useCreateDraft();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      size={size}
      disabled={busy}
      data-testid="new-campaign"
      onClick={() => {
        setBusy(true);
        const result = createDraft(t('draftTitle'), t('draftBrief'));
        if (!result.ok) {
          setBusy(false);
          onError?.({ code: result.code, detail: result.detail });
          toast.error(t('createFailed'));
          return;
        }
        toast.success(t('created'));
        router.push(`/merchant/campaigns/${result.campaignId}/edit`);
      }}
    >
      <Plus aria-hidden="true" />
      {t('new')}
    </Button>
  );
}

function CampaignList() {
  const t = useTranslations('merchant.campaigns');
  const rows = useMerchantCampaignRows();
  const [error, setError] = useState<{ code: string; detail?: string } | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
        </div>
        <NewCampaignButton onError={setError} />
      </header>

      {error ? <CommandErrorAlert code={error.code} detail={error.detail} /> : null}

      {rows.length === 0 ? (
        <EmptyState icon={Megaphone} title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <>
          <div className="hidden sm:block" data-testid="campaign-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colCampaign')}</TableHead>
                  <TableHead>{t('colStatus')}</TableHead>
                  <TableHead className="text-right">{t('colPool')}</TableHead>
                  <TableHead className="text-right">{t('colAvailable')}</TableHead>
                  <TableHead className="text-right">{t('colSubmissions')}</TableHead>
                  <TableHead className="text-right">{t('colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.campaign.id} data-campaign-id={row.campaign.id}>
                    <TableCell className="max-w-[18rem] font-medium">
                      <Link
                        href={`/merchant/campaigns/${row.campaign.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        <span className="line-clamp-2 break-words">{row.campaign.title}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge group="campaign" code={row.campaign.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyText sen={row.budget.poolSen} tabular />
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyText sen={row.budget.availableSen} tabular />
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      <span className="flex flex-col items-end gap-1">
                        <span>{t('submissionsCount', { count: row.submissionCount })}</span>
                        {row.pendingContentReviews > 0 ? (
                          <Badge className="bg-attention-subtle text-attention-foreground gap-1 border-transparent">
                            <Hourglass aria-hidden="true" />
                            {t('reviewsPending', { count: row.pendingContentReviews })}
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActions row={row} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ItemGroup className="sm:hidden" data-testid="campaign-cards">
            {rows.map((row) => (
              <Item
                key={row.campaign.id}
                variant="outline"
                className="items-start"
                data-campaign-id={row.campaign.id}
              >
                <ItemContent className="min-w-0">
                  <ItemTitle className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/merchant/campaigns/${row.campaign.id}`}
                      className="break-words underline-offset-4 hover:underline"
                    >
                      {row.campaign.title}
                    </Link>
                    <StatusBadge group="campaign" code={row.campaign.status} />
                  </ItemTitle>
                  <ItemDescription className="flex flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>
                        {t('colPool')} <MoneyText sen={row.budget.poolSen} tabular />
                      </span>
                      <span>
                        {t('colAvailable')} <MoneyText sen={row.budget.availableSen} tabular />
                      </span>
                    </span>
                    <span>{t('submissionsCount', { count: row.submissionCount })}</span>
                    {row.pendingContentReviews > 0 ? (
                      <span>{t('reviewsPending', { count: row.pendingContentReviews })}</span>
                    ) : null}
                  </ItemDescription>
                </ItemContent>
                <ItemActions className="w-full flex-col items-stretch gap-2">
                  <RowActions row={row} stacked />
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </>
      )}
    </div>
  );
}

function RowActions({ row, stacked }: { row: MerchantCampaignRow; stacked?: boolean }) {
  const t = useTranslations('merchant.campaigns');
  const draft = row.campaign.status === 'draft';

  return (
    <div
      className={
        stacked ? 'flex w-full flex-col gap-2' : 'flex flex-wrap items-center justify-end gap-2'
      }
    >
      <Button asChild variant="outline" size="sm">
        <Link href={`/merchant/campaigns/${row.campaign.id}`}>
          <span className="truncate">{t('open')}</span>
        </Link>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <Link href={`/merchant/campaigns/${row.campaign.id}/edit`}>
          <span className="truncate">{draft ? t('edit') : t('view')}</span>
        </Link>
      </Button>
      {draft ? (
        <Button asChild variant="ghost" size="sm">
          <Link href={`/merchant/campaigns/${row.campaign.id}/preview`}>
            <span className="truncate">{t('preview')}</span>
          </Link>
        </Button>
      ) : (
        <Button asChild variant="ghost" size="sm">
          <Link href={`/campaigns/${row.campaign.id}`}>
            <span className="truncate">{t('publicPage')}</span>
          </Link>
        </Button>
      )}
    </div>
  );
}
