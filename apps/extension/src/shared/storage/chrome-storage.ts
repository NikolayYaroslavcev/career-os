export class ChromeStorage {
  async get<T>(key: string): Promise<T | null> {
    const result = await chrome.storage.local.get(key);
    return (result[key] as T) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }

  async getMultiple<T>(keys: string[]): Promise<Record<string, T | null>> {
    const result = await chrome.storage.local.get(keys);
    const output: Record<string, T | null> = {};
    for (const key of keys) {
      output[key] = (result[key] as T) ?? null;
    }
    return output;
  }

  async clear(): Promise<void> {
    await chrome.storage.local.clear();
  }
}

export const storage = new ChromeStorage();
