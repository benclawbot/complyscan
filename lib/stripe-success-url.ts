export function buildSubscriptionSuccessUrl(
  appUrl: string,
  scanId: string,
  websiteUrl?: string,
  email?: string,
): string {
  const queryParts = [
    'session_id={CHECKOUT_SESSION_ID}',
    `scan_id=${encodeURIComponent(scanId)}`,
    'plan=monthly',
  ];

  if (websiteUrl) queryParts.push(`url=${encodeURIComponent(websiteUrl)}`);
  if (email) queryParts.push(`email=${encodeURIComponent(email)}`);

  return `${appUrl}/success?${queryParts.join('&')}`;
}
