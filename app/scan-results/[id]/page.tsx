import ScanResultsClient from './ScanResultsClient';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ScanResultsPage({ params }: Props) {
  const { id } = await params;
  const scanId = decodeURIComponent(id);

  return (
    <ScanResultsClient
      scanId={scanId}
      url=""
      email={null}
      status="loading"
      result={null}
      isLimitedPreview
    />
  );
}
