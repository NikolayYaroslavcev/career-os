export type AILogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AILogContext {
  readonly provider?: string;
  readonly model?: string;
  readonly promptId?: string;
  readonly promptVersion?: string;
  readonly requestId?: string;
  readonly durationMs?: number;
  readonly tokenUsage?: number;
  readonly cached?: boolean;
  readonly [key: string]: unknown;
}

export interface AILogger {
  debug(message: string, context?: AILogContext): void;
  info(message: string, context?: AILogContext): void;
  warn(message: string, context?: AILogContext): void;
  error(message: string, error?: Error, context?: AILogContext): void;
}

export class ConsoleAILogger implements AILogger {
  constructor(private readonly minLevel: AILogLevel = 'info') {}

  debug(message: string, context?: AILogContext): void {
    if (this.shouldLog('debug')) {
      console.debug(JSON.stringify({ level: 'debug', component: 'ai', message, ...context }));
    }
  }

  info(message: string, context?: AILogContext): void {
    if (this.shouldLog('info')) {
      console.info(JSON.stringify({ level: 'info', component: 'ai', message, ...context }));
    }
  }

  warn(message: string, context?: AILogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(JSON.stringify({ level: 'warn', component: 'ai', message, ...context }));
    }
  }

  error(message: string, error?: Error, context?: AILogContext): void {
    if (this.shouldLog('error')) {
      console.error(JSON.stringify({
        level: 'error',
        component: 'ai',
        message,
        error: error?.message,
        stack: error?.stack,
        ...context,
      }));
    }
  }

  private shouldLog(level: AILogLevel): boolean {
    const levels: AILogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }
}

export class NoopAILogger implements AILogger {
  debug(_message: string, _context?: AILogContext): void {}
  info(_message: string, _context?: AILogContext): void {}
  warn(_message: string, _context?: AILogContext): void {}
  error(_message: string, _error?: Error, _context?: AILogContext): void {}
}
