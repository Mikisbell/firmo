/**
 * Clases de error personalizadas para el módulo de rentabilidad
 * 
 * Estas clases extienden Error y agregan propiedades específicas
 * para facilitar el manejo de errores y logging.
 * 
 * @module core/errors/profitability-errors
 */

/**
 * Error de validación - Datos de entrada inválidos
 * 
 * Usado cuando los parámetros de entrada no cumplen con las reglas de validación.
 * Retorna código HTTP 400 (Bad Request).
 * 
 * @example
 * throw new ValidationError('Fecha de inicio debe ser anterior a fecha de fin', 'startDate');
 */
export class ValidationError extends Error {
  readonly name = 'ValidationError';
  readonly statusCode = 400;
  
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super(message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error de recurso no encontrado
 * 
 * Usado cuando un producto, ingrediente u otro recurso no existe en la base de datos.
 * Retorna código HTTP 404 (Not Found).
 * 
 * @example
 * throw new NotFoundError('Producto no encontrado', 'product', 'prod_123');
 */
export class NotFoundError extends Error {
  readonly name = 'NotFoundError';
  readonly statusCode = 404;
  
  constructor(
    message: string,
    public readonly resourceType?: string,
    public readonly resourceId?: string
  ) {
    super(message);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Error de cálculo - Fallo en operaciones matemáticas
 * 
 * Usado cuando hay errores en cálculos de COGS, ganancia o margen.
 * Retorna código HTTP 500 (Internal Server Error).
 * 
 * @example
 * throw new CalculationError('Error al calcular COGS: división por cero', 'calculateCOGS', { productId: 'prod_123' });
 */
export class CalculationError extends Error {
  readonly name = 'CalculationError';
  readonly statusCode = 500;
  
  constructor(
    message: string,
    public readonly operation?: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    Object.setPrototypeOf(this, CalculationError.prototype);
  }
}

/**
 * Error de infraestructura - Fallo en servicios externos
 * 
 * Usado cuando hay errores de conexión a base de datos, Redis, u otros servicios.
 * Retorna código HTTP 503 (Service Unavailable).
 * 
 * @example
 * throw new InfrastructureError('Error al conectar con Redis', 'redis', 'ECONNREFUSED');
 */
export class InfrastructureError extends Error {
  readonly name = 'InfrastructureError';
  readonly statusCode = 503;
  
  constructor(
    message: string,
    public readonly service?: string,
    public readonly code?: string
  ) {
    super(message);
    Object.setPrototypeOf(this, InfrastructureError.prototype);
  }
}

/**
 * Type guard para verificar si un error es de tipo ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard para verificar si un error es de tipo NotFoundError
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

/**
 * Type guard para verificar si un error es de tipo CalculationError
 */
export function isCalculationError(error: unknown): error is CalculationError {
  return error instanceof CalculationError;
}

/**
 * Type guard para verificar si un error es de tipo InfrastructureError
 */
export function isInfrastructureError(error: unknown): error is InfrastructureError {
  return error instanceof InfrastructureError;
}

/**
 * Helper para obtener el código HTTP de un error
 * 
 * @param error - Error a analizar
 * @returns Código HTTP apropiado (400, 404, 500, 503) o 500 por defecto
 */
export function getErrorStatusCode(error: unknown): number {
  if (isValidationError(error)) return error.statusCode;
  if (isNotFoundError(error)) return error.statusCode;
  if (isCalculationError(error)) return error.statusCode;
  if (isInfrastructureError(error)) return error.statusCode;
  return 500; // Internal Server Error por defecto
}

/**
 * Helper para formatear un error para logging
 * 
 * @param error - Error a formatear
 * @returns Objeto con información estructurada del error
 */
export function formatErrorForLogging(error: unknown): Record<string, unknown> {
  if (isValidationError(error)) {
    return {
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
      field: error.field,
      value: error.value,
    };
  }
  
  if (isNotFoundError(error)) {
    return {
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
      resourceType: error.resourceType,
      resourceId: error.resourceId,
    };
  }
  
  if (isCalculationError(error)) {
    return {
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
      operation: error.operation,
      context: error.context,
    };
  }
  
  if (isInfrastructureError(error)) {
    return {
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
      service: error.service,
      code: error.code,
    };
  }
  
  // Error genérico
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  
  // Error desconocido
  return {
    name: 'UnknownError',
    message: String(error),
  };
}
