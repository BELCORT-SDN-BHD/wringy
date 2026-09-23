import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

import { LoadingState } from '@/components/app/loading-state';

import { SignInView } from './sign-in-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('public.signIn');
  return { title: t('metaTitle'), description: t('description') };
}

export default function SignInPage() {
  // The view reads `next` from the query string, so it needs a Suspense boundary.
  return (
    <Suspense fallback={<LoadingState rows={1} />}>
      <SignInView />
    </Suspense>
  );
}
