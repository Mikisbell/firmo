/**
 * Sentry integration — opt-in via NEXT_PUBLIC_SENTRY_DSN env var.
 * If DSN is not set or @sentry/nextjs is not installed, all exports are safe no-ops.
 */

let _sentry: any = null // Sentry module — dynamic import yields untyped result
let _initialized = false

async function getSentry() {
  if (_sentry) return _sentry
  try {
    // @ts-expect-error — optional dependency, safe to fail
    _sentry = await import(/* webpackIgnore: true */ '@sentry/nextjs')
    return _sentry
  } catch {
    return null
  }
}

export async function initSentry(options: { dsn: string; environment: string }) {
  if (_initialized) return
  const Sentry = await getSentry()
  if (!Sentry) return

  Sentry.init({
    dsn: options.dsn,
    environment: options.environment,
    tracesSampleRate: options.environment === 'production' ? 0.1 : 1.0,
    enabled: process.env.NODE_ENV !== 'test',
  })
  _initialized = true
}

export async function captureException(error: unknown, context?: Record<string, unknown>) {
  const Sentry = await getSentry()
  if (!Sentry) return
  Sentry.captureException(error, context ? { extra: context } : undefined)
}

export async function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  const Sentry = await getSentry()
  if (!Sentry) return
  Sentry.captureMessage(message, level)
}
