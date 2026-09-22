import { RequireRole } from '@/components/app/require-role';
import { MerchantCampaignEditorView } from '@/features/merchant/campaign-editor-view';

export default async function MerchantCampaignEditPage({
  params,
}: PageProps<'/merchant/campaigns/[id]/edit'>) {
  const { id } = await params;
  return (
    <RequireRole allow={['merchant']} next={`/merchant/campaigns/${id}/edit`}>
      <MerchantCampaignEditorView campaignId={id} />
    </RequireRole>
  );
}
