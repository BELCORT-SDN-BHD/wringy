import { RequireRole } from '@/components/app/require-role';
import { MerchantOverviewView } from '@/features/merchant/overview-view';

export default function MerchantOverviewPage() {
  return (
    <RequireRole allow={['merchant']} next="/merchant">
      <MerchantOverviewView />
    </RequireRole>
  );
}
