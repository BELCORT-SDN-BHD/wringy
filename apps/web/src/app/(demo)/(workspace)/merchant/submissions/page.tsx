import { RequireRole } from '@/components/app/require-role';
import { MerchantSubmissionListView } from '@/features/merchant/submission-list-view';

export default function MerchantSubmissionsPage() {
  return (
    <RequireRole allow={['merchant']} next="/merchant/submissions">
      <MerchantSubmissionListView />
    </RequireRole>
  );
}
