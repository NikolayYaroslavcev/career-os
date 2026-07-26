import { describe, it, expect } from 'vitest';
import { TelegramConnection } from './telegram-connection.js';
import { TelegramConnectionStatus } from '../enums/telegram-connection-status.js';
import { createUserId, createTelegramConnectionId } from '../base/identifier.js';

describe('TelegramConnection', () => {
  const userId = createUserId('user-1');
  const connectionId = createTelegramConnectionId('connection-1');

  it('creates an active connection with verifiedAt defaulting to now', () => {
    const before = new Date();
    const connection = TelegramConnection.create({
      id: connectionId,
      userId,
      telegramChatId: '123456',
      telegramUsername: 'jdoe',
    });
    const after = new Date();

    expect(connection.id).toBe(connectionId);
    expect(connection.userId).toBe(userId);
    expect(connection.telegramChatId).toBe('123456');
    expect(connection.telegramUsername).toBe('jdoe');
    expect(connection.status).toBe(TelegramConnectionStatus.ACTIVE);
    expect(connection.isActive).toBe(true);
    expect(connection.verifiedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(connection.verifiedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    expect(connection.createdAt).toEqual(connection.verifiedAt);
  });

  it('trims telegramChatId and drops an empty telegramUsername', () => {
    const connection = TelegramConnection.create({
      id: connectionId,
      userId,
      telegramChatId: '  123456  ',
      telegramUsername: '   ',
    });

    expect(connection.telegramChatId).toBe('123456');
    expect(connection.telegramUsername).toBeUndefined();
  });

  it('rejects an empty telegramChatId', () => {
    expect(() =>
      TelegramConnection.create({ id: connectionId, userId, telegramChatId: '   ' })
    ).toThrow('telegramChatId cannot be empty');
  });

  it('revokes an active connection', () => {
    const connection = TelegramConnection.create({ id: connectionId, userId, telegramChatId: '123456' });

    connection.revoke();

    expect(connection.status).toBe(TelegramConnectionStatus.REVOKED);
    expect(connection.isActive).toBe(false);
  });

  it('reverify re-activates a revoked connection and updates chat/username', () => {
    const connection = TelegramConnection.create({ id: connectionId, userId, telegramChatId: '123456' });
    connection.revoke();

    connection.reverify('999999', 'newname');

    expect(connection.isActive).toBe(true);
    expect(connection.telegramChatId).toBe('999999');
    expect(connection.telegramUsername).toBe('newname');
  });
});
