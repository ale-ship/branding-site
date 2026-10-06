/**
 * Mock only: one copy of the mock's in-memory state per server process. Next.js bundles pages and route
 * handlers separately, and each bundle would otherwise get its own copy of a module's maps (a session
 * made on a page would be unknown to the CSV route). Keeping the state on `globalThis` shares it.
 */
const root = globalThis as typeof globalThis & { __noorcomMock?: Record<string, unknown> };

export function shared<T>(key: string, make: () => T): T {
  const store = (root.__noorcomMock ??= {});
  if (!(key in store)) store[key] = make();
  return store[key] as T;
}
