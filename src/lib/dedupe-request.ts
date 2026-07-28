const pendingRequests = new Map<string, Promise<unknown>>();

/**
 * Share an in-flight request with duplicate callers, then remove it from the
 * cache as soon as it settles. This prevents React Strict Mode's development
 * effect replay from sending the same request twice without caching responses.
 */
export function dedupeRequest<T>(key: string, request: () => Promise<T>): Promise<T> {
  const pendingRequest = pendingRequests.get(key) as Promise<T> | undefined;

  if (pendingRequest) {
    return pendingRequest;
  }

  const trackedRequest = Promise.resolve()
    .then(request)
    .finally(() => {
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, trackedRequest);

  return trackedRequest;
}
