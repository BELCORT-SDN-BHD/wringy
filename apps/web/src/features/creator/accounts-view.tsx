'use client';

/**
 * Creator accounts.
 *
 * Two facts the page must never blur (ticket #4): an unusable connection carries
 * the specific reason and the next action, and there is no upload entry anywhere
 * — the creator publishes on the platform and submits the post link afterwards.
 *
 * Connecting is simulated: the engine marks the connection usable without
 * contacting any platform and stores no credential.
 */

import { Link2, Plus, RefreshCw, TriangleAlert, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { DateTimeText } from '@/components/app/date-time-text';
import { EmptyState } from '@/components/app/empty-state';
import { CommandErrorAlert } from '@/components/app/error-state';
import { HydrationGate } from '@/components/app/hydration-gate';
import { StatusBadge } from '@/components/app/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDispatch } from '@/store/demo-store';
import type { AccountConnection, Platform } from '@/domain/types';

import { PageHeader, useConnectionCopy } from './creator-ui';
import { useCreatorConnections } from './use-creator-data';

const PLATFORMS: Platform[] = ['tiktok', 'instagram', 'youtube'];

export function CreatorAccountsView() {
  return (
    <HydrationGate>
      <Accounts />
    </HydrationGate>
  );
}

function Accounts() {
  const t = useTranslations('creator.accounts');
  const connections = useCreatorConnections();
  const invalid = connections.filter((connection) => connection.status !== 'valid');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={<ConnectDialog />}
      />

      <Alert data-testid="accounts-no-upload">
        <Link2 aria-hidden="true" />
        <AlertTitle>{t('noUpload')}</AlertTitle>
        <AlertDescription>{t('replaceNote')}</AlertDescription>
      </Alert>

      {invalid.length > 0 ? <InvalidConnectionsAlert connections={invalid} /> : null}

      {connections.length === 0 ? (
        <EmptyState icon={UserRound} title={t('empty')} description={t('emptyHint')} />
      ) : (
        <ItemGroup data-testid="connections-list">
          {connections.map((connection) => (
            <ConnectionRow key={connection.id} connection={connection} />
          ))}
        </ItemGroup>
      )}
    </div>
  );
}

/** One banner naming every connection that has to be reconnected, and why. */
function InvalidConnectionsAlert({ connections }: { connections: AccountConnection[] }) {
  const t = useTranslations('creator.accounts');
  const { platformName, invalidReason } = useConnectionCopy();

  return (
    <Alert
      className="bg-attention-subtle text-attention-foreground"
      data-testid="accounts-attention"
    >
      <TriangleAlert aria-hidden="true" className="text-attention-foreground" />
      <AlertTitle>{t('nextStepInvalid')}</AlertTitle>
      <AlertDescription className="text-attention-foreground">
        <span className="flex flex-col gap-1">
          {connections.map((connection) => (
            <span key={connection.id} className="break-words">
              {platformName(connection.platform)} {connection.handle} — {invalidReason(connection)}
            </span>
          ))}
        </span>
      </AlertDescription>
    </Alert>
  );
}

function ConnectionRow({ connection }: { connection: AccountConnection }) {
  const t = useTranslations('creator.accounts');
  const dispatch = useDispatch();
  const { platformName, invalidReason } = useConnectionCopy();
  const [error, setError] = useState<{ code: string; detail?: string } | null>(null);

  const reason = invalidReason(connection);

  const reconnect = () => {
    const result = dispatch({ type: 'connection.reconnect', connectionId: connection.id });
    if (!result.ok) {
      setError({ code: result.code, detail: result.detail });
      return;
    }
    setError(null);
    toast.success(t('reconnectedToast'));
  };

  return (
    <Item
      variant="outline"
      className="items-start"
      data-testid={`connection-${connection.id}`}
      data-connection-status={connection.status}
    >
      <ItemContent className="min-w-0">
        <ItemTitle className="flex flex-wrap items-center gap-2">
          <span className="break-words">{platformName(connection.platform)}</span>
          <span className="text-muted-foreground break-all">{connection.handle}</span>
          <StatusBadge group="connection" code={connection.status} />
        </ItemTitle>
        <ItemDescription className="flex flex-col gap-1">
          {reason ? (
            <span className="text-foreground break-words" data-testid="connection-reason">
              {t('reasonLabel')}: {reason}
            </span>
          ) : null}
          {reason ? <span className="break-words">{t('nextStepInvalid')}</span> : null}
          <span className="flex flex-wrap items-center gap-1 text-xs">
            {t('updatedLabel')}
            <DateTimeText iso={connection.updatedAt} hideOffset />
          </span>
          {error ? <CommandErrorAlert code={error.code} detail={error.detail} /> : null}
        </ItemDescription>
      </ItemContent>
      {connection.status === 'valid' ? null : (
        <ItemActions>
          <Button
            variant="outline"
            size="sm"
            onClick={reconnect}
            data-testid={`reconnect-${connection.id}`}
          >
            <RefreshCw aria-hidden="true" />
            <span className="truncate">{t('reconnect')}</span>
          </Button>
        </ItemActions>
      )}
    </Item>
  );
}

/**
 * The official Dialog composition for a short input task (reference-contract:
 * Linear's create dialog pattern). Focus return, Escape and the overlay are the
 * library's behaviour.
 */
function ConnectDialog() {
  const t = useTranslations('creator.accounts');
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>('tiktok');
  const [handle, setHandle] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<{ code: string; detail?: string } | null>(null);
  const { platformName } = useConnectionCopy();

  const missingHandle = handle.trim() === '';

  const submit = () => {
    if (missingHandle) {
      setTouched(true);
      return;
    }
    const result = dispatch({ type: 'connection.connect', platform, handle: handle.trim() });
    if (!result.ok) {
      setError({ code: result.code, detail: result.detail });
      return;
    }
    setError(null);
    setHandle('');
    setTouched(false);
    setOpen(false);
    toast.success(t('connectedToast'));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
          setTouched(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button data-testid="connect-account">
          <Plus aria-hidden="true" />
          <span className="truncate">{t('connect')}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('connectTitle')}</DialogTitle>
          <DialogDescription>{t('connectDescription')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="connect-platform">{t('platformLabel')}</FieldLabel>
            <Select value={platform} onValueChange={(value) => setPlatform(value as Platform)}>
              <SelectTrigger id="connect-platform" data-testid="connect-platform">
                <SelectValue placeholder={t('platformPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((value) => (
                  <SelectItem key={value} value={value} data-platform={value}>
                    {platformName(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field data-invalid={touched && missingHandle ? true : undefined}>
            <FieldLabel htmlFor="connect-handle">{t('handleLabel')}</FieldLabel>
            <Input
              id="connect-handle"
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              onBlur={() => setTouched(true)}
              placeholder={t('handlePlaceholder')}
              aria-invalid={touched && missingHandle ? true : undefined}
              data-testid="connect-handle"
              autoComplete="off"
            />
            <FieldDescription>{t('replaceNote')}</FieldDescription>
            {touched && missingHandle ? <FieldError>{t('handleRequired')}</FieldError> : null}
          </Field>

          {error ? <CommandErrorAlert code={error.code} detail={error.detail} /> : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t('cancel')}</Button>
          </DialogClose>
          <Button onClick={submit} disabled={missingHandle} data-testid="connect-submit">
            {t('connectSubmit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
