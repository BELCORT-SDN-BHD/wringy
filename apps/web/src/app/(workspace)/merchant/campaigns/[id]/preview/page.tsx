import { RequireRole } from '@/components/app/require-role';
import { MerchantCampaignPreviewView } from '@/features/merchant/campaign-preview-view';

export default async function MerchantCampaignPreviewPage({
  params,
}: PageProps<'/merchant/campaigns/[id]/preview'>) {
  const { id } = await params;
  return (
    <RequireRole allow={['merchant']} next={`/merchant/campaigns/${id}/preview`}>
      <MerchantCampaignPreviewView campaignId={id} />
    </RequireRole>
  );
}
