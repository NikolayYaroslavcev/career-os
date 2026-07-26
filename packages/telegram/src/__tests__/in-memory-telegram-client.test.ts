import { describe, it, expect } from 'vitest';
import { InMemoryTelegramClient } from '../in-memory-telegram-client.js';

describe('InMemoryTelegramClient', () => {
  it('records sent messages instead of making a network call', async () => {
    const client = new InMemoryTelegramClient();

    const result = await client.send('chat-1', 'hello');

    expect(result).toEqual({ success: true, messageId: 1 });
    expect(client.getSentMessages()).toHaveLength(1);
    expect(client.getSentMessages()[0]).toMatchObject({ chatId: 'chat-1', text: 'hello' });
  });

  it('assigns increasing message ids across sends', async () => {
    const client = new InMemoryTelegramClient();

    const first = await client.send('chat-1', 'a');
    const second = await client.send('chat-1', 'b');

    expect(first).toEqual({ success: true, messageId: 1 });
    expect(second).toEqual({ success: true, messageId: 2 });
  });

  it('reset() clears recorded messages and the id counter', async () => {
    const client = new InMemoryTelegramClient();
    await client.send('chat-1', 'a');

    client.reset();

    expect(client.getSentMessages()).toEqual([]);
    const result = await client.send('chat-1', 'b');
    expect(result).toEqual({ success: true, messageId: 1 });
  });
});
