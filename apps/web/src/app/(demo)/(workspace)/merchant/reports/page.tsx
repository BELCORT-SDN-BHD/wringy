import { RequireRole } from '@/components/app/require-role';
import { MerchantReportsView } from '@/features/merchant/reports-view';

export default function MerchantReportsPage() {
  return (
    <RequireRole allow={['merchant']} next="/merchant/reports">
      <MerchantReportsView />
    </RequireRole>
  );
}
