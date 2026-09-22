'use client';

import Link from 'next/link';
import { ArrowRight, Coins, Gavel, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { LocaleSelect } from '@/components/app/locale-select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia } from '@/components/ui/item';
import { useAppLocale } from '@/lib/use-app-locale';
import { useSetLocale } from '@/store/use-set-locale';

/**
 * The landing page.
 *
 * "Continue with Google (simulated)" is the only way in, here and everywhere
 * else in the prototype: no email, no password, no one-time code. The language
 * select is on this page so a visitor can choose before signing in.
 */
export function LandingView() {
  const t = useTranslations('public.landing');
  const locale = useAppLocale();
  const setLocale = useSetLocale();

  const points = [
    { icon: Coins, text: t('pointRate') },
    { icon: ShieldCheck, text: t('pointCap') },
    { icon: Gavel, text: t('pointReview') },
  ];

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-5">
        <Badge variant="outline" className="w-fit">
          {t('eyebrow')}
        </Badge>
        <h1 className="font-heading text-2xl font-semibold text-balance sm:text-4xl">
          {t('headline')}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm sm:text-base">{t('sub')}</p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/campaigns">
              {t('browse')}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link href="/sign-in" data-testid="landing-sign-in">
              {t('signIn')}
            </Link>
          </Button>
        </div>
        <p className="text-muted-foreground max-w-xl text-xs">{t('signInNote')}</p>
      </section>

      <section className="flex max-w-md flex-col gap-2">
        <label htmlFor="landing-locale" className="text-sm font-medium">
          {t('languageLabel')}
        </label>
        <LocaleSelect
          id="landing-locale"
          value={locale}
          onChange={(next) => setLocale(next, true)}
        />
      </section>

      <section>
        <ItemGroup>
          {points.map((point) => {
            const Icon = point.icon;
            return (
              <Item key={point.text} variant="outline">
                <ItemMedia variant="icon">
                  <Icon aria-hidden="true" />
                </ItemMedia>
                <ItemContent>
                  <ItemDescription className="text-foreground">{point.text}</ItemDescription>
                </ItemContent>
              </Item>
            );
          })}
        </ItemGroup>
      </section>

      {/* The guided entry (ticket #9). It sits in a footer rather than next to
          the two primary actions because a first-time visitor should be able to
          just browse; the walkthrough is for whoever is reviewing the prototype. */}
      <footer
        className="flex flex-col gap-2 border-t pt-6"
        data-testid="landing-footer"
      >
        <h2 className="text-sm font-medium">{t('demoGuideTitle')}</h2>
        <p className="text-muted-foreground max-w-2xl text-xs">{t('demoGuideNote')}</p>
        <div className="flex">
          <Button asChild variant="outline" size="sm">
            <Link href="/demo" data-testid="landing-demo-guide">
              {t('demoGuideAction')}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </footer>
    </div>
  );
}
