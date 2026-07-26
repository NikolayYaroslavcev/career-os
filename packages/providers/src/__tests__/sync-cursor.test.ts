import { describe, it, expect } from 'vitest';
import { createInitialCursor, advanceCursor } from '../interfaces/sync-cursor.js';

describe('createInitialCursor', () => {
  it('should create cursor for page strategy', () => {
    const cursor = createInitialCursor('page', { pageSize: 50 });

    expect(cursor.strategy).toBe('page');
    expect(cursor.exhausted).toBe(false);
    expect(cursor.fetchedCount).toBe(0);
    if (cursor.cursor.type === 'page') {
      expect(cursor.cursor.page).toBe(1);
      expect(cursor.cursor.perPage).toBe(50);
    }
  });

  it('should create cursor for offset strategy', () => {
    const cursor = createInitialCursor('offset', { pageSize: 10 });

    expect(cursor.strategy).toBe('offset');
    if (cursor.cursor.type === 'offset') {
      expect(cursor.cursor.offset).toBe(0);
      expect(cursor.cursor.limit).toBe(10);
    }
  });

  it('should create cursor for timestamp strategy', () => {
    const since = new Date('2024-01-01');
    const cursor = createInitialCursor('timestamp', { since });

    expect(cursor.strategy).toBe('timestamp');
    if (cursor.cursor.type === 'timestamp') {
      expect(cursor.cursor.since).toBe(since);
    }
  });

  it('should create exhausted cursor for none strategy', () => {
    const cursor = createInitialCursor('none');

    expect(cursor.strategy).toBe('none');
    expect(cursor.exhausted).toBe(true);
  });
});

describe('advanceCursor', () => {
  it('should advance page cursor', () => {
    const initial = createInitialCursor('page');
    const advanced = advanceCursor(initial, { count: 20, hasMore: true });

    expect(advanced.exhausted).toBe(false);
    expect(advanced.fetchedCount).toBe(20);
    if (advanced.cursor.type === 'page') {
      expect(advanced.cursor.page).toBe(2);
    }
  });

  it('should mark cursor as exhausted when no more results', () => {
    const initial = createInitialCursor('page');
    const advanced = advanceCursor(initial, { count: 10, hasMore: false });

    expect(advanced.exhausted).toBe(true);
    expect(advanced.fetchedCount).toBe(10);
  });

  it('should advance offset cursor', () => {
    const initial = createInitialCursor('offset', { pageSize: 10 });
    const advanced = advanceCursor(initial, { count: 10, hasMore: true });

    if (advanced.cursor.type === 'offset') {
      expect(advanced.cursor.offset).toBe(10);
    }
  });
});
