'use client';

import { CircleCheck, RotateCcw, TriangleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { HydrationGate } from '@/components/app/hydration-gate';
import { LocaleSelect } from '@/components/app/locale-select';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SCHEMA_VERSION } from '@/domain/types';
import { useAppLocale } from '@/lib/use-app-locale';
import { useCurrentUser } from '@/store/actor';
import { DEMO_STORAGE_KEY, useDemoActions, useDemoSnapshot } from '@/store/demo-store';
import { useSetLocale } from '@/store/use-set-locale';

/**
 * Settings: language, the simulated profile, and the demo data itself.
 *
 * The language field is the durable entry localization-v1 asks for. Changing it
 * updates the interface in place and keeps anything typed on the page, which the
 * scratch-note field below demonstrates and the smoke test asserts. When the
 * browser refuses to store the preference, the page says "switched, not saved"
 * rather than claiming a save that did not happen.
 */
export function SettingsView() {
  return (
    <HydrationGate>
      <Settings />
    </HydrationGate>
  );
}

function Settings() {
  const t = useTranslations('settings');
  const tReset = useTranslations('common.reset');
  const locale = useAppLocale();
  const setLocale = useSetLocale();
  const user = useCurrentUser();
  const state = useDemoSnapshot();
  const { reset } = useDemoActions();

  const languageId = useId();
  const noteId = useId();
  const [note, setNote] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'unsaved'>('idle');

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t('language.title')}</CardTitle>
          <CardDescription>{t('language.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor={languageId}>{t('language.label')}</FieldLabel>
            <LocaleSelect
              id={languageId}
              value={locale}
              onChange={(next) => {
                // An explicit change here is a real preference, not a preview.
                const outcome = setLocale(next, true);
                setSaveState(outcome.saved ? 'saved' : 'unsaved');
              }}
            />
            <FieldDescription>{t('language.draftNote')}</FieldDescription>
          </Field>

          {saveState === 'saved' ? (
            <Alert className="bg-success-subtle">
              <CircleCheck aria-hidden="true" />
              <AlertTitle>{t('language.saved')}</AlertTitle>
            </Alert>
          ) : null}
          {saveState === 'unsaved' ? (
            <Alert className="bg-attention-subtle">
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>{t('language.switchedNotSaved')}</AlertTitle>
            </Alert>
          ) : null}

          <Field>
            <FieldLabel htmlFor={noteId}>{t('language.formCheckLabel')}</FieldLabel>
            <Input
              id={noteId}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              data-testid="settings-scratch-note"
            />
            <FieldDescription>{t('language.formCheckHint')}</FieldDescription>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.title')}</CardTitle>
          <CardDescription>{t('profile.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-muted-foreground text-xs">{t('profile.name')}</dt>
                <dd className="break-words">{user.displayName}</dd>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-muted-foreground text-xs">{t('profile.email')}</dt>
                <dd className="break-all">{user.email}</dd>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-muted-foreground text-xs">{t('profile.workspaces')}</dt>
                <dd className="break-words">
                  {user.orgIds.map((orgId) => state.orgs[orgId]?.name ?? orgId).join(' · ') || '—'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-muted-foreground text-sm">{t('profile.signedOut')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('storage.title')}</CardTitle>
          <CardDescription>{t('storage.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
              <dt className="text-muted-foreground text-xs">{t('storage.key')}</dt>
              <dd className="font-mono break-all">{DEMO_STORAGE_KEY}</dd>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
              <dt className="text-muted-foreground text-xs">{t('storage.schemaVersion')}</dt>
              <dd className="font-mono">{SCHEMA_VERSION}</dd>
            </div>
          </dl>

          <ConfirmDialog
            trigger={
              <Button variant="destructive" className="w-full sm:w-fit" data-testid="settings-reset">
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
            }}
          />
          <p className="text-muted-foreground text-xs">{tReset('description')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
