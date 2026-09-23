import { RequireRole } from '@/components/app/require-role';
import { MerchantCampaignDetailView } from '@/features/merchant/campaign-detail-view';

export default async function MerchantCampaignDetailPage({
  params,
}: PageProps<'/merchant/campaigns/[id]'>) {
  const { id } = await params;
  return (
    <RequireRole allow={['merchant']} next={`/merchant/campaigns/${id}`}>
      <MerchantCampaignDetailView campaignId={id} />
    </RequireRole>
  );
}
