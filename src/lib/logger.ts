type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: Level = (process.env.OLA_NEWS_LOG_LEVEL as Level) ?? 'info';

function emit(level: Level, scope: string, message: string, meta?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;
  const line = { ts: new Date().toISOString(), level, scope, message, ...(meta ?? {}) };
  const target = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  target(JSON.stringify(line));
}

export function createLogger(scope: string) {
  return {
    debug: (m: string, meta?: Record<string, unknown>) => emit('debug', scope, m, meta),
    info: (m: string, meta?: Record<string, unknown>) => emit('info', scope, m, meta),
    warn: (m: string, meta?: Record<string, unknown>) => emit('warn', scope, m, meta),
    error: (m: string, meta?: Record<string, unknown>) => emit('error', scope, m, meta),
  };
}
