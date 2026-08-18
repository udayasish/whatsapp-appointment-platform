const queues = new Map<string, Promise<unknown>>();

/**
 * Serializes calls sharing the same key, in call order — a call only starts
 * once every earlier call for that key has settled. Used to keep
 * conversation_state read-dispatch-write cycles for a given (tenant, phone)
 * from racing when webhook deliveries for the same sender are retried or
 * arrive out of order (Meta does not guarantee in-order delivery).
 */
export function withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  const chained = run.then(
    () => undefined,
    () => undefined
  );
  queues.set(key, chained);
  chained.finally(() => {
    if (queues.get(key) === chained) queues.delete(key);
  });
  return run;
}
