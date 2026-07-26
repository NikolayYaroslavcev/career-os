import { ChromeStorage } from '../shared/storage/chrome-storage.js';

export class StorageBridge {
  private storage = new ChromeStorage();

  async get<T>(key: string): Promise<T | null> {
    return this.storage.get<T>(key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    return this.storage.set(key, value);
  }

  async remove(key: string): Promise<void> {
    return this.storage.remove(key);
  }
}
