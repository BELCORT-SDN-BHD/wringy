import { RequireRole } from '@/components/app/require-role';
import { MerchantContentReviewView } from '@/features/merchant/content-review-view';

export default async function MerchantContentReviewPage({
  params,
}: PageProps<'/merchant/submissions/[id]'>) {
  const { id } = await params;
  return (
    <RequireRole allow={['merchant']} next={`/merchant/submissions/${id}`}>
      <MerchantContentReviewView submissionId={id} />
    </RequireRole>
  );
}
