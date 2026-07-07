export async function register() {
  // OpenTelemetry — only on server-side (Node.js runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

    if (otelEndpoint) {
      const { registerOTel } = await import('@vercel/otel');
      registerOTel({
        serviceName: process.env.OTEL_SERVICE_NAME ?? 'firmo-pos',
        attributes: {
          'deployment.environment': process.env.NODE_ENV ?? 'development',
        },
      });
    }
  }

  // Environment validation (production only)
  if (process.env.NODE_ENV === 'production') {
    const { validateEnv } = await import('@/src/core/config/env-validation');
    validateEnv();

    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (dsn) {
      const { initSentry } = await import('@/src/lib/sentry');
      await initSentry({ dsn, environment: 'production' });
    }
  }
}
