type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const serverCache = new Map<string, CacheEntry<unknown>>();
const serverCacheInflight = new Map<string, Promise<unknown>>();

export async function getOrSetServerCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<{ value: T; hit: boolean }> {
  const now = Date.now();
  const cached = serverCache.get(key);
  if (cached && cached.expiresAt > now) {
    return {
      value: cached.value as T,
      hit: true
    };
  }

  const pending = serverCacheInflight.get(key);
  if (pending) {
    return {
      value: (await pending) as T,
      hit: true
    };
  }

  const request = loader();
  serverCacheInflight.set(key, request as Promise<unknown>);

  try {
    const value = await request;
    serverCache.set(key, {
      value,
      expiresAt: Date.now() + Math.max(0, ttlMs)
    });
    return {
      value,
      hit: false
    };
  } finally {
    serverCacheInflight.delete(key);
  }
}
