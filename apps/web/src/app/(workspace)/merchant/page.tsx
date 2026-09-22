import { RequireRole } from '@/components/app/require-role';
import { WorkspaceOverview } from '@/components/app/workspace-overview';

// Placeholder: the wave-2 merchant worker replaces this page with the real
// overview. The guard, the shell and the selectors it uses stay as they are.
export default function MerchantOverviewPage() {
  return (
    <RequireRole allow={['merchant']} next="/merchant">
      <WorkspaceOverview />
    </RequireRole>
  );
}
