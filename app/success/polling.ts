export type StripeSessionPollResponse = {
  subscriberToken?: string | null;
  customerEmail?: string | null;
};

export function shouldContinuePollingForSubscriberToken(data: StripeSessionPollResponse | null | undefined): boolean {
  return !data?.subscriberToken;
}
