import { StandardRetryStrategy } from "@aws-sdk/middleware-retry";

export const RETRY_STRATEGY = new StandardRetryStrategy(async () => 10000, {
  retryDecider: (e: any) => {
    if (
      [
        "ThrottlingException",
        "Throttling",
        "TooManyRequestsException",
        "OperationAbortedException",
        "TimeoutError",
        "NetworkingError",
        "SlowDown",
      ].includes(e.name)
    ) {
      return true;
    }
    return false;
  },
  delayDecider: (_, attempts) => {
    return Math.min(1.5 ** attempts * 100, 5000);
  },
  // AWS SDK v3 has an idea of "retry tokens" which are used to
  // prevent multiple retries from happening at the same time.
  // This is a workaround to disable that.
  retryQuota: {
    hasRetryTokens: () => true,
    releaseRetryTokens: () => {},
    retrieveRetryTokens: () => 1,
  },
});
