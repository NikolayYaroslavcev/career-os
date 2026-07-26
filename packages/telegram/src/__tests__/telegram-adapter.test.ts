import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMessage = vi.fn();

vi.mock('telegraf', () => ({
  Telegraf: vi.fn().mockImplementation(() => ({
    telegram: { sendMessage },
  })),
}));

const { TelegramAdapter } = await import('../telegram-adapter.js');

describe('TelegramAdapter', () => {
  beforeEach(() => {
    sendMessage.mockReset();
  });

  it('sends the given text as-is and reports the message id on success', async () => {
    sendMessage.mockResolvedValue({ message_id: 42 });
    const adapter = new TelegramAdapter({ botToken: 'test-token' });

    const result = await adapter.send('chat-1', 'hello world');

    expect(result).toEqual({ success: true, messageId: 42 });
    expect(sendMessage).toHaveBeenCalledWith('chat-1', 'hello world', { parse_mode: 'Markdown' });
  });

  it('returns a failure result instead of throwing when the Bot API call rejects', async () => {
    sendMessage.mockRejectedValue(new Error('bot was blocked by the user'));
    const adapter = new TelegramAdapter({ botToken: 'test-token' });

    const result = await adapter.send('chat-1', 'hello world');

    expect(result).toEqual({ success: false, error: 'bot was blocked by the user' });
  });

  it('wraps non-Error rejections into a string error', async () => {
    sendMessage.mockRejectedValue('rate limited');
    const adapter = new TelegramAdapter({ botToken: 'test-token' });

    const result = await adapter.send('chat-1', 'hello world');

    expect(result).toEqual({ success: false, error: 'rate limited' });
  });

  it('respects a custom parseMode', async () => {
    sendMessage.mockResolvedValue({ message_id: 1 });
    const adapter = new TelegramAdapter({ botToken: 'test-token', parseMode: 'HTML' });

    await adapter.send('chat-1', '<b>hi</b>');

    expect(sendMessage).toHaveBeenCalledWith('chat-1', '<b>hi</b>', { parse_mode: 'HTML' });
  });

  it('is a pure passthrough of the given text — no formatting or business decisions', async () => {
    sendMessage.mockResolvedValue({ message_id: 2 });
    const adapter = new TelegramAdapter({ botToken: 'test-token' });
    const rawText = 'literally *anything* the caller already built';

    await adapter.send('chat-1', rawText);

    expect(sendMessage).toHaveBeenCalledWith('chat-1', rawText, expect.anything());
  });
});
