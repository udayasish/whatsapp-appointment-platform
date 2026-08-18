/**
 * Retries a transient failure once (with a short backoff) before giving up.
 * Used around webhook message processing: a dropped/reset pooled DB
 * connection is a one-off blip, and the pool discards the broken client and
 * hands out a fresh one on the next attempt.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 2,
  delayMs = 300,
  onAttemptFailed?: (err: unknown, attempt: number) => void
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      onAttemptFailed?.(err, i + 1);
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastErr;
}
