import type { PaginationStrategy } from '../types/provider.js';

export type SyncCursor =
  | CursorCursor
  | PageCursor
  | OffsetCursor
  | TimestampCursor
  | NoCursor;

export interface CursorCursor {
  readonly type: 'cursor';
  readonly value: string;
  readonly hasMore: boolean;
  readonly totalResults?: number;
}

export interface PageCursor {
  readonly type: 'page';
  readonly page: number;
  readonly perPage: number;
  readonly totalPages?: number;
  readonly totalResults?: number;
}

export interface OffsetCursor {
  readonly type: 'offset';
  readonly offset: number;
  readonly limit: number;
  readonly totalResults?: number;
}

export interface TimestampCursor {
  readonly type: 'timestamp';
  readonly since: Date;
  readonly inclusive: boolean;
  readonly maxRangeMs?: number;
}

export interface NoCursor {
  readonly type: 'none';
  readonly message: string;
}

export interface CursorState {
  readonly cursor: SyncCursor;
  readonly strategy: PaginationStrategy;
  readonly exhausted: boolean;
  readonly fetchedCount: number;
}

export function createInitialCursor(
  strategy: PaginationStrategy,
  options?: {
    pageSize?: number;
    since?: Date;
  },
): CursorState {
  switch (strategy) {
    case 'cursor':
      return {
        cursor: { type: 'cursor', value: '', hasMore: true },
        strategy,
        exhausted: false,
        fetchedCount: 0,
      };
    case 'page':
      return {
        cursor: {
          type: 'page',
          page: 1,
          perPage: options?.pageSize ?? 20,
        },
        strategy,
        exhausted: false,
        fetchedCount: 0,
      };
    case 'offset':
      return {
        cursor: {
          type: 'offset',
          offset: 0,
          limit: options?.pageSize ?? 20,
        },
        strategy,
        exhausted: false,
        fetchedCount: 0,
      };
    case 'timestamp':
      return {
        cursor: {
          type: 'timestamp',
          since: options?.since ?? new Date(0),
          inclusive: false,
        },
        strategy,
        exhausted: false,
        fetchedCount: 0,
      };
    case 'none':
      return {
        cursor: { type: 'none', message: 'Provider does not support pagination' },
        strategy,
        exhausted: true,
        fetchedCount: 0,
      };
  }
}

export function advanceCursor(
  current: CursorState,
  result: { count: number; hasMore: boolean; nextValue?: string },
): CursorState {
  const newFetched = current.fetchedCount + result.count;

  if (!result.hasMore) {
    return {
      ...current,
      exhausted: true,
      fetchedCount: newFetched,
    };
  }

  let nextCursor: SyncCursor;

  switch (current.cursor.type) {
    case 'cursor':
      nextCursor = {
        type: 'cursor',
        value: result.nextValue ?? '',
        hasMore: result.hasMore,
      };
      break;
    case 'page':
      nextCursor = {
        type: 'page',
        page: current.cursor.page + 1,
        perPage: current.cursor.perPage,
        totalPages: current.cursor.totalPages,
        totalResults: current.cursor.totalResults,
      };
      break;
    case 'offset':
      nextCursor = {
        type: 'offset',
        offset: current.cursor.offset + current.cursor.limit,
        limit: current.cursor.limit,
        totalResults: current.cursor.totalResults,
      };
      break;
    case 'timestamp':
      nextCursor = {
        type: 'timestamp',
        since: new Date(),
        inclusive: false,
        maxRangeMs: current.cursor.maxRangeMs,
      };
      break;
    case 'none':
      nextCursor = current.cursor;
      break;
  }

  return {
    cursor: nextCursor,
    strategy: current.strategy,
    exhausted: false,
    fetchedCount: newFetched,
  };
}
