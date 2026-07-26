export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  readonly providerId?: string;
  readonly operation?: string;
  readonly durationMs?: number;
  readonly [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
}

export class ConsoleLogger implements Logger {
  constructor(private readonly minLevel: LogLevel = 'info') {}

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.debug(JSON.stringify({ level: 'debug', message, ...context }));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.info(JSON.stringify({ level: 'info', message, ...context }));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(JSON.stringify({ level: 'warn', message, ...context }));
    }
  }

  error(message: string, error?: Error, context?: LogContext): void {
    if (this.shouldLog('error')) {
      console.error(JSON.stringify({
        level: 'error',
        message,
        error: error?.message,
        stack: error?.stack,
        ...context,
      }));
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }
}

export class NoopLogger implements Logger {
  debug(_message: string, _context?: LogContext): void {}
  info(_message: string, _context?: LogContext): void {}
  warn(_message: string, _context?: LogContext): void {}
  error(_message: string, _error?: Error, _context?: LogContext): void {}
}
