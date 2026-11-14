import { ParcelDetail } from '@/features/parcels/parcel-detail';
export default async function Page({
  params
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const {
    id
  } = await params;
  return <ParcelDetail id={id} />;
}
