/**
 * Minimal structured JSON logger. Callers must never pass tokens, passwords,
 * transcripts, images or other user content — only identifiers and metadata.
 */
type Level = 'info' | 'warn' | 'error';

function write(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  if (process.env.LOG_SILENT === 'true') return;
  const line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (msg: string, fields?: Record<string, unknown>) => write('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => write('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => write('error', msg, fields),
};
