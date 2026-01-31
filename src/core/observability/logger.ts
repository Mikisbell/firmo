/**
 * PARK POS Structured Logger
 * 
 * Provides structured logging with consistent format for
 * easy parsing and analysis in log aggregation systems.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
    tenant_id?: string;
    terminal_id?: string;
    order_id?: string;
    event_type?: string;
    correlation_id?: string;
    [key: string]: any;
}

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    event: string;
    message: string;
    context?: LogContext;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}

// Log level priority
const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

// Current log level (can be set via environment)
let currentLogLevel: LogLevel = 
    (typeof process !== 'undefined' && process.env?.LOG_LEVEL as LogLevel) || 'info';

/**
 * Set the minimum log level
 */
export function setLogLevel(level: LogLevel): void {
    currentLogLevel = level;
}

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel];
}

/**
 * Format a log entry
 */
function formatLogEntry(
    level: LogLevel,
    event: string,
    message: string,
    context?: LogContext,
    error?: Error
): LogEntry {
    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        event,
        message,
    };
    
    if (context && Object.keys(context).length > 0) {
        entry.context = context;
    }
    
    if (error) {
        entry.error = {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }
    
    return entry;
}

/**
 * Output a log entry
 */
function output(entry: LogEntry): void {
    const json = JSON.stringify(entry);
    
    switch (entry.level) {
        case 'error':
            console.error(json);
            break;
        case 'warn':
            console.warn(json);
            break;
        case 'debug':
            console.debug(json);
            break;
        default:
            console.log(json);
    }
}

/**
 * Main logger object
 */
export const logger = {
    debug(event: string, message: string, context?: LogContext): void {
        if (shouldLog('debug')) {
            output(formatLogEntry('debug', event, message, context));
        }
    },
    
    info(event: string, message: string, context?: LogContext): void {
        if (shouldLog('info')) {
            output(formatLogEntry('info', event, message, context));
        }
    },
    
    warn(event: string, message: string, context?: LogContext): void {
        if (shouldLog('warn')) {
            output(formatLogEntry('warn', event, message, context));
        }
    },
    
    error(event: string, message: string, error?: Error, context?: LogContext): void {
        if (shouldLog('error')) {
            output(formatLogEntry('error', event, message, context, error));
        }
    },
    
    /**
     * Create a child logger with preset context
     */
    child(baseContext: LogContext) {
        return {
            debug: (event: string, message: string, context?: LogContext) =>
                logger.debug(event, message, { ...baseContext, ...context }),
            info: (event: string, message: string, context?: LogContext) =>
                logger.info(event, message, { ...baseContext, ...context }),
            warn: (event: string, message: string, context?: LogContext) =>
                logger.warn(event, message, { ...baseContext, ...context }),
            error: (event: string, message: string, error?: Error, context?: LogContext) =>
                logger.error(event, message, error, { ...baseContext, ...context }),
        };
    },
};

// ============================================
// Pre-defined Log Events
// ============================================

export const logEvents = {
    // Sync events
    SYNC_BATCH_START: 'sync.batch.start',
    SYNC_BATCH_SUCCESS: 'sync.batch.success',
    SYNC_BATCH_ERROR: 'sync.batch.error',
    SYNC_BACKLOG_HIGH: 'sync.backlog.high',
    
    // Circuit breaker events
    CIRCUIT_OPENED: 'circuit.opened',
    CIRCUIT_HALF_OPEN: 'circuit.half_open',
    CIRCUIT_CLOSED: 'circuit.closed',
    
    // API events
    INGEST_REQUEST: 'api.ingest.request',
    INGEST_SUCCESS: 'api.ingest.success',
    INGEST_ERROR: 'api.ingest.error',
    
    // Projection events
    PROJECTION_ERROR: 'projection.error',
    PROJECTION_WARNING: 'projection.warning',
    
    // Conflict events
    CONFLICT_DETECTED: 'conflict.detected',
    CONFLICT_RESOLVED: 'conflict.resolved',
    CONFLICT_REJECTED: 'conflict.rejected',
    
    // Business events
    ORDER_CREATED: 'business.order.created',
    ORDER_COMPLETED: 'business.order.completed',
    PAYMENT_RECEIVED: 'business.payment.received',
    
    // System events
    STARTUP: 'system.startup',
    SHUTDOWN: 'system.shutdown',
    HEALTH_CHECK: 'system.health_check',
};

// ============================================
// Convenience Loggers
// ============================================

export const syncLogger = {
    batchStart(context: { tenant_id: string; terminal_id: string; events_count: number }) {
        logger.info(logEvents.SYNC_BATCH_START, 'Starting sync batch', context);
    },
    
    batchSuccess(context: { 
        tenant_id: string; 
        terminal_id: string; 
        events_count: number;
        latency_ms: number;
    }) {
        logger.info(logEvents.SYNC_BATCH_SUCCESS, 'Sync batch completed', context);
    },
    
    batchError(error: Error, context: { tenant_id: string; terminal_id: string }) {
        logger.error(logEvents.SYNC_BATCH_ERROR, 'Sync batch failed', error, context);
    },
    
    backlogHigh(context: { tenant_id: string; terminal_id: string; backlog_count: number }) {
        logger.warn(logEvents.SYNC_BACKLOG_HIGH, 'Sync backlog is high', context);
    },
};

export const apiLogger = {
    ingestRequest(context: { tenant_id: string; terminal_id: string; events_count: number }) {
        logger.debug(logEvents.INGEST_REQUEST, 'Ingest request received', context);
    },
    
    ingestSuccess(context: { 
        tenant_id: string; 
        terminal_id: string; 
        events_count: number;
        latency_ms: number;
    }) {
        logger.info(logEvents.INGEST_SUCCESS, 'Ingest completed', context);
    },
    
    ingestError(error: Error, context: { tenant_id: string; terminal_id: string }) {
        logger.error(logEvents.INGEST_ERROR, 'Ingest failed', error, context);
    },
};

export const conflictLogger = {
    detected(context: { 
        order_id: string; 
        event_type: string; 
        expected_revision: number;
        actual_revision: number;
    }) {
        logger.warn(logEvents.CONFLICT_DETECTED, 'Conflict detected', context);
    },
    
    resolved(context: { 
        order_id: string; 
        event_type: string; 
        resolution: string;
    }) {
        logger.info(logEvents.CONFLICT_RESOLVED, 'Conflict resolved', context);
    },
    
    rejected(context: { 
        order_id: string; 
        event_type: string; 
        reason: string;
    }) {
        logger.warn(logEvents.CONFLICT_REJECTED, 'Event rejected due to conflict', context);
    },
};
