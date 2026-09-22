import { RequireRole } from '@/components/app/require-role';
import { MerchantCampaignListView } from '@/features/merchant/campaign-list-view';

export default function MerchantCampaignsPage() {
  return (
    <RequireRole allow={['merchant']} next="/merchant/campaigns">
      <MerchantCampaignListView />
    </RequireRole>
  );
}
