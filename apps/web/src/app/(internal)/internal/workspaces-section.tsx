import { Building2, Plus, UserRound } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import type { WorkspacesResponse } from '@wringy/contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { ApiFailureAlert } from './api-failure';
import type { ApiRead } from './api-read';
import { CREATE_ORG_PATH, orgPath } from './org-paths';
import { ROLE_STYLE, StateBadge, styleOf } from './state-badge';

/** `orgNameSchema`'s upper bound (packages/contracts/src/orgs.ts), as the input's own limit. */
const ORG_NAME_MAX_LENGTH = 100;

/**
 * The workspaces the signed-in person can act in, from `GET /me/workspaces`
 * (M2-03; m2-03-code-review.md R9 rev 2, R10; M2-AC03/1).
 *
 * The personal context first, then one row per **active** membership (org name,
 * role badge, a link to the org's page), ordered by the API. Switching workspace
 * is navigation: each org is its own URL, and every read and write there is
 * re-authorised by the API from the path (R5), so nothing here is cached or
 * remembered. The create form is a plain POST to a Route Handler; its creator
 * becomes the org's first admin.
 *
 * Grants (`review`, `finance`, `ops_runtime`) stay in the response for M2-08 and
 * are not shown: nothing is operable behind them yet.
 */
export async function WorkspacesSection({ read }: { read: ApiRead<WorkspacesResponse> }) {
  const t = await getTranslations('internal');

  return (
    <section
      aria-labelledby="internal-workspaces-title"
      data-internal-section="workspaces"
      className="flex min-w-0 flex-col gap-3"
    >
      <header className="flex flex-col gap-1">
        <h2 id="internal-workspaces-title" className="text-lg font-semibold tracking-tight">
          {t('workspaces.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('workspaces.description')}</p>
      </header>

      {!read.ok ? (
        <ApiFailureAlert failure={read.failure} />
      ) : (
        <Card className="min-w-0">
          <CardContent className="flex flex-col gap-4">
            <ul aria-label={t('workspaces.listLabel')} className="flex flex-col divide-y" data-testid="workspace-list">
              <li className="flex min-w-0 items-center gap-3 py-2 first:pt-0" data-workspace="personal">
                <UserRound aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">{t('workspaces.personal')}</span>
                  <span className="text-sm text-muted-foreground">{t('workspaces.personalDescription')}</span>
                </div>
              </li>
              {read.data.orgs.map((org) => (
                <li
                  key={org.orgId}
                  className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 py-2"
                  data-workspace="org"
                  data-org-id={org.orgId}
                >
                  <Building2 aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  <Link
                    href={orgPath(org.orgId)}
                    prefetch={false}
                    className="min-w-0 flex-1 font-medium break-words underline-offset-4 hover:underline"
                    data-testid="workspace-org-link"
                  >
                    {org.name}
                  </Link>
                  <StateBadge kind="role" code={org.role} style={styleOf(ROLE_STYLE, org.role)} label={t(`role.${org.role}`)} />
                </li>
              ))}
            </ul>

            {read.data.orgs.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="workspace-none">
                {t('workspaces.none')}
              </p>
            ) : null}

            <form
              method="post"
              action={CREATE_ORG_PATH}
              className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end"
              data-testid="create-org-form"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Label htmlFor="create-org-name">{t('workspaces.create.nameLabel')}</Label>
                <Input
                  id="create-org-name"
                  name="name"
                  required
                  maxLength={ORG_NAME_MAX_LENGTH}
                  autoComplete="off"
                  data-testid="create-org-name"
                />
              </div>
              <Button type="submit" data-testid="create-org-submit">
                <Plus aria-hidden="true" />
                {t('workspaces.create.submit')}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">{t('workspaces.create.note')}</p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
