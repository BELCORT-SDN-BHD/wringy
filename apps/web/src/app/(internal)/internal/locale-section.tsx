import { Languages } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { Profile } from '@wringy/contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { LOCALES, type Locale } from '@/i18n/config';

import { SLOT, withSlot } from './embed';
import { InstantText } from './instant-text';
import { LocaleCardForm } from './locale-card-form';
import { INTERNAL_PATH } from './org-paths';

/**
 * The Language card on `/internal`, beside the Session card (M2-04;
 * m2-04-code-review.md R5 rev 2, R7): the account's own preference and the
 * place to change it.
 *
 * Titled "Settings · Preferred language" so the synced notice's "Change in
 * Settings" names a place that exists in a build with no Settings page (record
 * §5). It shows what the account holds, from the same `GET /me` the page
 * already read — `Not set`, or `Saved: 简体中文` with the instant it was saved
 * through `InstantText` (Malaysia time, offset written out, the API's instant in
 * `<time datetime>`) — and a form: a `NativeSelect` named by the card's own
 * `<Label>`, and Save. Without JavaScript Save posts `choose` to
 * `POST /internal/locale`, which answers with a 303 back here and an outcome;
 * with it, Save is the in-place switch (`LocaleCardForm`).
 */
export async function LocaleSection({ profile, locale }: { profile: Profile; locale: Locale }) {
  const t = await getTranslations('internal.locale.card');
  const common = await getTranslations('common');
  const preference = profile.localePref;
  // What the select starts on, and its key, so it follows every switch made anywhere on the page.
  const initial = preference ?? locale;

  return (
    <section aria-labelledby="internal-locale-title" data-internal-section="locale" className="flex min-w-0 flex-col gap-3">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>
            <h2 id="internal-locale-title" className="text-lg font-semibold tracking-tight">
              {t('title')}
            </h2>
          </CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-sm">
            <p
              className="flex flex-wrap items-center gap-2"
              data-testid="locale-card-state"
              data-account-preference={preference ?? 'none'}
            >
              <Languages aria-hidden="true" className="size-4 text-muted-foreground" />
              <span>
                {preference === null
                  ? t('notSet')
                  : withSlot(
                      t('savedAs', { name: SLOT }),
                      <span lang={preference} className="font-medium">
                        {common(`locale.${preference}`)}
                      </span>,
                    )}
              </span>
            </p>
            {preference === null ? null : (
              <p className="text-muted-foreground" data-testid="locale-card-set-at">
                {withSlot(
                  t('savedAt', { time: SLOT }),
                  <InstantText iso={profile.localePrefSetAt} locale={locale} unknownLabel={common('state.unknown')} />,
                )}
              </p>
            )}
          </div>

          <LocaleCardForm>
            <input type="hidden" name="intent" value="choose" />
            <input type="hidden" name="next" value={INTERNAL_PATH} />
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="locale-card-select">{t('fieldLabel')}</Label>
              {/* Keyed by what it starts on: React never re-applies `defaultValue`, and an
                  in-place switch keeps this node, so without the key it would keep showing
                  the old language beside "Saved: <new>" and Save would post it back. */}
              <NativeSelect
                key={initial}
                id="locale-card-select"
                name="locale"
                defaultValue={initial}
                data-testid="locale-card-select"
              >
                {LOCALES.map((code) => (
                  <NativeSelectOption key={code} value={code} lang={code}>
                    {common(`locale.${code}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Button type="submit" data-testid="locale-card-save">
                {t('save')}
              </Button>
            </div>
          </LocaleCardForm>
        </CardContent>
      </Card>
    </section>
  );
}
