import { CircleX, DoorOpen, Pencil, UserMinus, UserPlus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { INVITATION_LIFETIME_DAYS, ORG_ROLES, type OrgDetailResponse, type OrgRole } from '@wringy/contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
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

import { InstantText } from '../../instant-text';
import { ORG_ACTIONS } from '../../org-paths';
import { ROLE_STYLE, StateBadge, styleOf } from '../../state-badge';

/** `orgNameSchema`'s upper bound (packages/contracts/src/orgs.ts), as the input's own limit. */
const ORG_NAME_MAX_LENGTH = 100;
/** `createInvitationBodySchema`'s bound on the address (packages/contracts/src/orgs.ts). */
const EMAIL_MAX_LENGTH = 320;

export interface OrgViewProps {
  /** The org as the path named it, already parsed as a uuid: every form posts back to this org. */
  orgId: string;
  detail: OrgDetailResponse;
  /** The signed-in person's own id, so their own row carries no remove or role form (leave is theirs). */
  selfId: string;
  locale: Locale;
}

/**
 * One organisation as `GET /orgs/:orgId` answered it (M2-03;
 * m2-03-code-review.md R9 rev 2; M2-AC03/1, /2).
 *
 * Everybody sees the name, the members (display name, role, since) and their
 * own role, and can leave. Admins also see the rename form, the invite form, the
 * pending invitations with a revoke button each, and a role form and a remove
 * button on every other member's row. Whether the caller is an admin is the
 * API's `self.role` at read time only: every form is a plain POST that the API
 * re-authorises under the org lock, so a form rendered before a demotion is
 * refused when submitted (`admin_required`), never obeyed.
 *
 * No member row carries an address of any kind (the contract has none); the
 * pending invitations show the invited address to admins only, because the
 * API sends `invitations` to admins only.
 */
export async function OrgView({ orgId, detail, selfId, locale }: OrgViewProps) {
  const t = await getTranslations('internal');
  const tCommon = await getTranslations('common');
  const unknown = tCommon('state.unknown');
  const { org, self, members } = detail;
  const admin = self.role === 'admin';
  const invitations = admin ? (detail.invitations ?? []) : null;

  const roleBadge = (role: OrgRole) => (
    <StateBadge kind="role" code={role} style={styleOf(ROLE_STYLE, role)} label={t(`role.${role}`)} />
  );

  return (
    <>
      <header className="flex min-w-0 flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight break-words" data-testid="org-name">
          {org.name}
        </h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" data-testid="org-own-role" data-role={self.role}>
          <span>{t('org.yourRole')}</span>
          {roleBadge(self.role)}
        </p>
      </header>

      <section aria-labelledby="org-members-title" data-org-section="members" className="flex min-w-0 flex-col gap-3">
        <h2 id="org-members-title" className="text-lg font-semibold tracking-tight">
          {t('org.members.title')}
        </h2>
        <Card className="min-w-0 py-2">
          <CardContent className="px-2">
            <Table data-testid="org-members-table">
              <TableCaption className="sr-only">{t('org.members.caption')}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('org.members.columns.name')}</TableHead>
                  <TableHead>{t('org.members.columns.role')}</TableHead>
                  <TableHead>{t('org.members.columns.since')}</TableHead>
                  {admin ? <TableHead>{t('org.members.columns.actions')}</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const isSelf = member.userId === selfId;
                  const name = member.displayName ?? t('org.members.unnamed');
                  return (
                    <TableRow key={member.userId} data-member-id={member.userId} data-member-self={isSelf ? 'true' : 'false'}>
                      <TableCell className="min-w-32 font-medium whitespace-normal">
                        <span className="break-words">{name}</span>
                        {isSelf ? <span className="ml-2 text-xs font-normal text-muted-foreground">{t('org.members.you')}</span> : null}
                      </TableCell>
                      <TableCell>{roleBadge(member.role)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        <InstantText iso={member.grantedAt} locale={locale} unknownLabel={unknown} />
                      </TableCell>
                      {admin ? (
                        <TableCell>
                          {isSelf ? null : (
                            <div className="flex items-center gap-2">
                              <form
                                method="post"
                                action={ORG_ACTIONS.role(orgId, member.userId)}
                                className="flex items-center gap-2"
                                data-testid="member-role-form"
                              >
                                <NativeSelect
                                  name="role"
                                  size="sm"
                                  defaultValue={member.role}
                                  aria-label={t('org.members.roleFor', { name })}
                                  data-testid="member-role-select"
                                >
                                  {ORG_ROLES.map((role) => (
                                    <NativeSelectOption key={role} value={role}>
                                      {t(`role.${role}`)}
                                    </NativeSelectOption>
                                  ))}
                                </NativeSelect>
                                <Button type="submit" size="sm" variant="outline" data-testid="member-role-submit">
                                  {t('org.members.changeRole')}
                                </Button>
                              </form>
                              <form method="post" action={ORG_ACTIONS.remove(orgId, member.userId)} data-testid="member-remove-form">
                                <Button type="submit" size="sm" variant="destructive" data-testid="member-remove-submit">
                                  <UserMinus aria-hidden="true" />
                                  {t('org.members.remove')}
                                </Button>
                              </form>
                            </div>
                          )}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {invitations !== null ? (
        <section aria-labelledby="org-invite-title" data-org-section="invitations" className="flex min-w-0 flex-col gap-3">
          <h2 id="org-invite-title" className="text-lg font-semibold tracking-tight">
            {t('org.invite.title')}
          </h2>
          <Card className="min-w-0">
            <CardHeader>
              <CardDescription>{t('org.invite.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form method="post" action={ORG_ACTIONS.invite(orgId)} className="flex flex-col gap-4" data-testid="invite-form">
                <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor="invite-email">{t('org.invite.emailLabel')}</Label>
                    <Input
                      id="invite-email"
                      name="email"
                      type="email"
                      required
                      maxLength={EMAIL_MAX_LENGTH}
                      autoComplete="off"
                      data-testid="invite-email"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="invite-role">{t('org.invite.roleLabel')}</Label>
                    <NativeSelect id="invite-role" name="role" defaultValue="member" data-testid="invite-role">
                      {ORG_ROLES.map((role) => (
                        <NativeSelectOption key={role} value={role}>
                          {t(`role.${role}`)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                </div>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
                  <li data-testid="invite-sign-in-note">{t('org.invite.signInNote')}</li>
                  <li>{t('org.invite.lifetime', { days: INVITATION_LIFETIME_DAYS })}</li>
                  <li>{t('org.invite.handOver')}</li>
                </ul>
                <div>
                  <Button type="submit" data-testid="invite-submit">
                    <UserPlus aria-hidden="true" />
                    {t('org.invite.submit')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <h3 className="text-base font-semibold tracking-tight">{t('org.invitations.title')}</h3>
          {invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="invitations-none">
              {t('org.invitations.none')}
            </p>
          ) : (
            <Card className="min-w-0 py-2">
              <CardContent className="px-2">
                <Table data-testid="org-invitations-table">
                  <TableCaption className="sr-only">{t('org.invitations.caption')}</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('org.invitations.columns.address')}</TableHead>
                      <TableHead>{t('org.invitations.columns.role')}</TableHead>
                      <TableHead>{t('org.invitations.columns.expires')}</TableHead>
                      <TableHead>{t('org.invitations.columns.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((invitation) => (
                      <TableRow key={invitation.id} data-invitation-id={invitation.id}>
                        <TableCell className="min-w-40 font-medium break-all whitespace-normal">{invitation.inviteeEmailNorm}</TableCell>
                        <TableCell>{roleBadge(invitation.role)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          <InstantText iso={invitation.expiresAt} locale={locale} unknownLabel={unknown} />
                        </TableCell>
                        <TableCell>
                          <form method="post" action={ORG_ACTIONS.revoke(orgId, invitation.id)} data-testid="invitation-revoke-form">
                            <Button type="submit" size="sm" variant="destructive" data-testid="invitation-revoke-submit">
                              <CircleX aria-hidden="true" />
                              {t('org.invitations.revoke')}
                            </Button>
                          </form>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </section>
      ) : null}

      {admin ? (
        <section aria-labelledby="org-rename-title" data-org-section="rename" className="flex min-w-0 flex-col gap-3">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>
                <h2 id="org-rename-title" className="text-lg font-semibold tracking-tight">
                  {t('org.rename.title')}
                </h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                method="post"
                action={ORG_ACTIONS.rename(orgId)}
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
                data-testid="rename-form"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Label htmlFor="rename-name">{t('org.rename.nameLabel')}</Label>
                  <Input
                    id="rename-name"
                    name="name"
                    required
                    maxLength={ORG_NAME_MAX_LENGTH}
                    defaultValue={org.name}
                    autoComplete="off"
                    data-testid="rename-name"
                  />
                </div>
                <Button type="submit" variant="outline" data-testid="rename-submit">
                  <Pencil aria-hidden="true" />
                  {t('org.rename.submit')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section aria-labelledby="org-leave-title" data-org-section="leave" className="flex min-w-0 flex-col gap-3">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>
              <h2 id="org-leave-title" className="text-lg font-semibold tracking-tight">
                {t('org.leave.title')}
              </h2>
            </CardTitle>
            <CardDescription>{t('org.leave.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form method="post" action={ORG_ACTIONS.leave(orgId)} data-testid="leave-form">
              <Button type="submit" variant="destructive" data-testid="leave-submit">
                <DoorOpen aria-hidden="true" />
                {t('org.leave.submit')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
