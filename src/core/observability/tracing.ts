/**
 * Lightweight tracing helpers for business-critical routes.
 *
 * Wraps OpenTelemetry span creation with PARK-specific context
 * (tenant_id, terminal_id, event_type, etc.).
 *
 * @module core/observability/tracing
 */

import { trace, SpanStatusCode, type Span, type Attributes } from '@opentelemetry/api';

const tracer = trace.getTracer('firmo-pos');

export interface SpanOptions {
  attributes?: Attributes;
}

/**
 * Run an async function inside a named span.
 * The span is automatically ended when the function resolves or rejects.
 *
 * Usage:
 *   const result = await withSpan('ingest.transaction', async (span) => {
 *     span.setAttribute('batch.size', events.length);
 *     return processEvents(events);
 *   });
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  opts?: SpanOptions,
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes: opts?.attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Start a span manually (for large blocks where withSpan nesting is impractical).
 * Caller MUST call endSpan() in finally/catch.
 */
export function startSpan(
  name: string,
  attrs?: {
    tenantId?: string;
    terminalId?: string;
    shiftId?: string;
    orderId?: string;
    eventType?: string;
    batchSize?: number;
  },
): Span {
  const span = tracer.startSpan(name);
  if (attrs) setBusinessAttributes(span, attrs);
  return span;
}

/**
 * End a span with proper status and optional error recording.
 */
export function endSpan(span: Span, error?: unknown): void {
  if (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    span.recordException(err);
  } else {
    span.setStatus({ code: SpanStatusCode.OK });
  }
  span.end();
}

/**
 * Add standard PARK business attributes to a span.
 */
export function setBusinessAttributes(
  span: Span,
  attrs: {
    tenantId?: string;
    terminalId?: string;
    shiftId?: string;
    orderId?: string;
    eventType?: string;
    batchSize?: number;
  },
): void {
  if (attrs.tenantId) span.setAttribute('park.tenant_id', attrs.tenantId);
  if (attrs.terminalId) span.setAttribute('park.terminal_id', attrs.terminalId);
  if (attrs.shiftId) span.setAttribute('park.shift_id', attrs.shiftId);
  if (attrs.orderId) span.setAttribute('park.order_id', attrs.orderId);
  if (attrs.eventType) span.setAttribute('park.event_type', attrs.eventType);
  if (attrs.batchSize != null) span.setAttribute('park.batch_size', attrs.batchSize);
}
