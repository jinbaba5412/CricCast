'use strict';
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const ENV_LEVEL = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function log(level, context, message, data) {
  if (LEVELS[level] > ENV_LEVEL) return;
  const ts   = new Date().toISOString();
  const line = data
    ? `[${level.toUpperCase()}] [${ts}] [${context}] ${message} ${JSON.stringify(data)}`
    : `[${level.toUpperCase()}] [${ts}] [${context}] ${message}`;
  if (LEVELS[level] <= LEVELS.warn) process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

module.exports = {
  error: (ctx, msg, data) => log('error', ctx, msg, data),
  warn:  (ctx, msg, data) => log('warn',  ctx, msg, data),
  info:  (ctx, msg, data) => log('info',  ctx, msg, data),
  debug: (ctx, msg, data) => log('debug', ctx, msg, data),
};
