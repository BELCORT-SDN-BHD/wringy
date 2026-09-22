import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { RequireRole } from '@/components/app/require-role';
import { OpsQueueView } from '@/features/ops/queue-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ops.queue');
  return { title: t('metaTitle'), description: t('subtitle') };
}

/**
 * The operations landing page. Both capabilities read the same queue: hiding
 * finance work from the reviewer who has to escalate it would make the queue
 * lie. The actions behind each link are checked per capability by the engine.
 */
export default function OpsQueuePage() {
  return (
    <RequireRole allow={['ops_reviewer', 'ops_finance']} next="/ops">
      <OpsQueueView />
    </RequireRole>
  );
}
