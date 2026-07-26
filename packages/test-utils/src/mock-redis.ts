export function createMockRedis() {
  const store = new Map<string, string>();

  return {
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
    exists: vi.fn(async (key: string) => (store.has(key) ? 1 : 0)),
    expire: vi.fn(async () => 1),
    ttl: vi.fn(async () => -1),
    quit: vi.fn().mockResolvedValue('OK'),
    disconnect: vi.fn(),
    _store: store,
  };
}

export type MockRedis = ReturnType<typeof createMockRedis>;
