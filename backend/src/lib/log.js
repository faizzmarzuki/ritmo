const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 }
const threshold = LEVELS[process.env.LOG_LEVEL || 'info'] ?? 20

function emit(level, scope, msg, extra) {
  if (LEVELS[level] < threshold) return
  const stamp = new Date().toISOString().slice(11, 23)
  const line = `${stamp} ${level.toUpperCase().padEnd(5)} [${scope}] ${msg}`
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  if (extra === undefined) sink(line)
  else sink(line, extra)
}

export function logger(scope) {
  return {
    debug: (m, e) => emit('debug', scope, m, e),
    info: (m, e) => emit('info', scope, m, e),
    warn: (m, e) => emit('warn', scope, m, e),
    error: (m, e) => emit('error', scope, m, e),
  }
}
