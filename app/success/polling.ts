export type StripeSessionPollResponse = {
  subscriptionReady?: boolean;
  customerEmail?: string | null;
};

export function shouldContinuePollingForSubscription(data: StripeSessionPollResponse | null | undefined): boolean {
  return !data?.subscriptionReady;
}
