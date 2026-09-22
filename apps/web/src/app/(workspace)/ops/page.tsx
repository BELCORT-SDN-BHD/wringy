import { RequireRole } from '@/components/app/require-role';
import { WorkspaceOverview } from '@/components/app/workspace-overview';

// Placeholder: the wave-2 operations worker replaces this page with the real
// work queue. `/ops` is the queue entry in the sidebar, so this is the page that
// becomes it. Both operations capabilities may read it; the individual actions
// behind it are checked by the engine per capability.
export default function OpsQueuePage() {
  return (
    <RequireRole allow={['ops_reviewer', 'ops_finance']} next="/ops">
      <WorkspaceOverview />
    </RequireRole>
  );
}
