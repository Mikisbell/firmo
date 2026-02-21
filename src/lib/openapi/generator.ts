/**
 * OpenAPI 3.0 Specification Generator for PARK POS API
 * 
 * Generates comprehensive API documentation from code annotations.
 * Supports authentication, request/response schemas, and error responses.
 */

import { OpenAPIV3 } from 'openapi-types';

/**
 * Generate complete OpenAPI 3.0 specification for PARK POS API
 * 
 * @returns OpenAPI document with all endpoints, schemas, and security definitions
 */
export function generateOpenAPISpec(): OpenAPIV3.Document {
  return {
    openapi: '3.0.0',
    info: {
      title: 'PARK POS API',
      version: '1.0.0',
      description: 'REST API for PARK POS offline-first point-of-sale system for Peruvian restaurants',
      contact: {
        name: 'PARK POS Support',
        email: 'support@parkpos.com',
      },
      license: {
        name: 'Proprietary',
      },
    },
    servers: [
      {
        url: 'https://parkperu.vercel.app',
        description: 'Production',
      },
      {
        url: 'http://localhost:3000',
        description: 'Development',
      },
    ],
    tags: [
      { name: 'Auth', description: 'Authentication and authorization endpoints' },
      { name: 'Events', description: 'Event sourcing endpoints' },
      { name: 'Orders', description: 'Order management endpoints' },
      { name: 'Products', description: 'Product catalog endpoints' },
      { name: 'Inventory', description: 'Inventory management endpoints' },
      { name: 'Admin', description: 'Administrative endpoints' },
      { name: 'Health', description: 'System health and monitoring endpoints' },
      { name: 'Metrics', description: 'Performance and business metrics endpoints' },
      { name: 'HR', description: 'Human resources management endpoints' },
      { name: 'POS', description: 'Point-of-sale terminal endpoints' },
      { name: 'Invoicing', description: 'SUNAT electronic invoicing endpoints' },
      { name: 'Delivery', description: 'Delivery management and driver tracking' },
      { name: 'Recipes', description: 'Recipe and cost management' },
      { name: 'Finance', description: 'Petty cash, purchases, reconciliation, P&L' },
      { name: 'Platforms', description: 'Third-party delivery platform integrations' },
    ],
    paths: {
      ...getAuthPaths(),
      ...getEventPaths(),
      ...getOrderPaths(),
      ...getProductPaths(),
      ...getInventoryPaths(),
      ...getAdminPaths(),
      ...getHealthPaths(),
      ...getMetricsPaths(),
      ...getHRPaths(),
      ...getPOSPaths(),
      ...getInvoicingPaths(),
      ...getRecipePaths(),
      ...getFinancePaths(),
      ...getPlatformPaths(),
    },
    components: {
      securitySchemes: getSecuritySchemes(),
      schemas: getSchemas(),
    },
  };
}

/**
 * Security schemes for API authentication
 */
function getSecuritySchemes(): Record<string, OpenAPIV3.SecuritySchemeObject> {
  return {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'JWT token obtained from /api/auth/login or /api/auth/session',
    },
    pinAuth: {
      type: 'apiKey',
      in: 'header',
      name: 'X-PIN',
      description: 'Employee PIN for terminal authentication',
    },
  };
}

/**
 * Authentication endpoints
 */
function getAuthPaths(): OpenAPIV3.PathsObject {
  return {
    '/api/auth/login': {
      post: {
        summary: 'Authenticate user with PIN',
        description: 'Authenticate a user (employee) using their PIN code and create a session',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/LoginRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/LoginResponse',
                },
              },
            },
          },
          '401': {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },

    '/api/auth/session': {
      post: {
        summary: 'Create admin session',
        description: 'Create an admin session using PIN authentication',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['pin'],
                properties: {
                  pin: {
                    type: 'string',
                    description: 'Admin PIN code',
                    example: '1234',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Session created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    token: { type: 'string' },
                    employee: { $ref: '#/components/schemas/Employee' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Invalid PIN',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
  };
}

/**
 * Event sourcing endpoints
 */
function getEventPaths(): OpenAPIV3.PathsObject {
  return {
    '/api/events/ingest': {
      post: {
        summary: 'Ingest events from terminals',
        description: 'Receive and process events from offline terminals for event sourcing',
        tags: ['Events'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['events'],
                properties: {
                  events: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/Event',
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Events ingested successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    processed: { type: 'number' },
                    failed: { type: 'number' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid event data',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
  };
}

/**
 * Order management endpoints
 */
function getOrderPaths(): OpenAPIV3.PathsObject {
  return {
    '/api/orders': {
      get: {
        summary: 'List orders',
        description: 'Retrieve a paginated list of orders for the authenticated tenant',
        tags: ['Orders'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
            description: 'Page number',
          },
          {
            name: 'pageSize',
            in: 'query',
            schema: { type: 'integer', default: 20, maximum: 100 },
            description: 'Number of items per page (max 100)',
          },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['PENDING', 'COMPLETED', 'CANCELLED'] },
            description: 'Filter by order status',
          },
        ],
        responses: {
          '200': {
            description: 'Orders retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    orders: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/Order',
                      },
                    },
                    total: { type: 'number' },
                    page: { type: 'number' },
                    pageSize: { type: 'number' },
                    totalPages: { type: 'number' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create order',
        description: 'Create a new order with items',
        tags: ['Orders'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateOrderRequest',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Order created successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Order',
                },
              },
            },
          },
          '400': {
            description: 'Invalid order data',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
  };
}

/**
 * Product catalog endpoints
 */
function getProductPaths(): OpenAPIV3.PathsObject {
  return {
    '/api/products': {
      get: {
        summary: 'List products',
        description: 'Retrieve product catalog for the authenticated tenant',
        tags: ['Products'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'category',
            in: 'query',
            schema: { type: 'string' },
            description: 'Filter by category',
          },
          {
            name: 'isActive',
            in: 'query',
            schema: { type: 'boolean', default: true },
            description: 'Filter by active status',
          },
        ],
        responses: {
          '200': {
            description: 'Products retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Product',
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
  };
}

/**
 * Inventory management endpoints
 */
function getInventoryPaths(): OpenAPIV3.PathsObject {
  return {
    '/api/inventory/stock': {
      get: {
        summary: 'Get stock levels',
        description: 'Retrieve current stock levels for all products',
        tags: ['Inventory'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Stock levels retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/StockLevel',
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
  };
}

/**
 * Admin endpoints
 */
function getAdminPaths(): OpenAPIV3.PathsObject {
  return {
    '/api/admin/employees': {
      get: {
        summary: 'List employees',
        description: 'Retrieve all employees for the authenticated tenant',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Employees retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Employee',
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Forbidden - Admin access required',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
  };
}

/**
 * Health check endpoints
 */
function getHealthPaths(): OpenAPIV3.PathsObject {
  return {
    '/api/health': {
      get: {
        summary: 'Health check',
        description: 'Check system health including database, Redis, and event sourcing components',
        tags: ['Health'],
        responses: {
          '200': {
            description: 'System is healthy',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthCheckResult',
                },
              },
            },
          },
          '503': {
            description: 'System is unhealthy',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthCheckResult',
                },
              },
            },
          },
        },
      },
    },
  };
}

/**
 * Metrics endpoints
 */
function getMetricsPaths(): OpenAPIV3.PathsObject {
  return {
    '/api/metrics': {
      get: {
        summary: 'Get system metrics',
        description: 'Retrieve performance and business metrics',
        tags: ['Metrics'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'timeRange',
            in: 'query',
            schema: { type: 'string', enum: ['1h', '24h', '7d', '30d'], default: '24h' },
            description: 'Time range for metrics',
          },
          {
            name: 'tenantId',
            in: 'query',
            schema: { type: 'string' },
            description: 'Filter by tenant ID',
          },
        ],
        responses: {
          '200': {
            description: 'Metrics retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MetricsResponse',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Forbidden - Admin access required',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
  };
}

/**
 * Schema definitions for request/response bodies
 */
function getSchemas(): Record<string, OpenAPIV3.SchemaObject> {
  return {
    Error: {
      type: 'object',
      required: ['error'],
      properties: {
        error: {
          type: 'object',
          required: ['code', 'message', 'timestamp'],
          properties: {
            code: {
              type: 'string',
              description: 'Machine-readable error code',
              example: 'VALIDATION_ERROR',
            },
            message: {
              type: 'string',
              description: 'Human-readable error message',
              example: 'Invalid order data',
            },
            details: {
              type: 'object',
              description: 'Additional error details',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'ISO 8601 timestamp',
            },
            correlationId: {
              type: 'string',
              description: 'Request correlation ID for tracing',
            },
          },
        },
      },
    },
    LoginRequest: {
      type: 'object',
      required: ['pin', 'terminalId'],
      properties: {
        pin: {
          type: 'string',
          description: 'Employee PIN code',
          example: '1234',
        },
        terminalId: {
          type: 'string',
          format: 'uuid',
          description: 'Terminal identifier',
        },
      },
    },
    LoginResponse: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
        },
        token: {
          type: 'string',
          description: 'JWT authentication token',
        },
        employee: {
          $ref: '#/components/schemas/Employee',
        },
        terminal: {
          $ref: '#/components/schemas/Terminal',
        },
      },
    },
    Employee: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
        },
        name: {
          type: 'string',
          example: 'Juan Pérez',
        },
        role: {
          type: 'string',
          enum: ['ADMIN', 'CASHIER', 'WAITER', 'KITCHEN'],
          example: 'CASHIER',
        },
        isActive: {
          type: 'boolean',
        },
        tenantId: {
          type: 'string',
          format: 'uuid',
        },
      },
    },
    Terminal: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
        },
        name: {
          type: 'string',
          example: 'Terminal 1',
        },
        type: {
          type: 'string',
          enum: ['CASHIER', 'WAITER', 'KDS'],
          example: 'CASHIER',
        },
        isActive: {
          type: 'boolean',
        },
        tenantId: {
          type: 'string',
          format: 'uuid',
        },
      },
    },

    Event: {
      type: 'object',
      required: ['eventId', 'eventType', 'aggregateId', 'tenantId', 'timestamp', 'payload'],
      properties: {
        eventId: {
          type: 'string',
          format: 'uuid',
          description: 'Unique event identifier',
        },
        eventType: {
          type: 'string',
          description: 'Type of event',
          example: 'ORDER_CREATED',
        },
        aggregateId: {
          type: 'string',
          format: 'uuid',
          description: 'ID of the aggregate this event belongs to',
        },
        tenantId: {
          type: 'string',
          format: 'uuid',
          description: 'Tenant identifier',
        },
        terminalId: {
          type: 'string',
          format: 'uuid',
          description: 'Terminal that generated the event',
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          description: 'Event timestamp in ISO 8601 format',
        },
        version: {
          type: 'integer',
          description: 'Event version for optimistic locking',
        },
        payload: {
          type: 'object',
          description: 'Event-specific data',
        },
      },
    },
    Order: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
        },
        orderNumber: {
          type: 'integer',
          description: 'Sequential order number',
          example: 1001,
        },
        status: {
          type: 'string',
          enum: ['PENDING', 'COMPLETED', 'CANCELLED'],
        },
        items: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/OrderItem',
          },
        },
        totalCents: {
          type: 'integer',
          description: 'Total amount in cents (centavos)',
          example: 5000,
        },
        tenantId: {
          type: 'string',
          format: 'uuid',
        },
        terminalId: {
          type: 'string',
          format: 'uuid',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
        },
      },
    },
    OrderItem: {
      type: 'object',
      required: ['productId', 'quantity', 'priceCents'],
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
        },
        productId: {
          type: 'string',
          format: 'uuid',
        },
        product: {
          $ref: '#/components/schemas/Product',
        },
        quantity: {
          type: 'integer',
          minimum: 1,
          example: 2,
        },
        priceCents: {
          type: 'integer',
          description: 'Price per unit in cents',
          example: 2500,
        },
        notes: {
          type: 'string',
          description: 'Special instructions',
          example: 'Sin cebolla',
        },
      },
    },
    CreateOrderRequest: {
      type: 'object',
      required: ['tenantId', 'terminalId', 'items'],
      properties: {
        tenantId: {
          type: 'string',
          format: 'uuid',
        },
        terminalId: {
          type: 'string',
          format: 'uuid',
        },
        items: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['productId', 'quantity', 'priceCents'],
            properties: {
              productId: {
                type: 'string',
                format: 'uuid',
              },
              quantity: {
                type: 'integer',
                minimum: 1,
              },
              priceCents: {
                type: 'integer',
                minimum: 0,
              },
              notes: {
                type: 'string',
              },
            },
          },
        },
      },
    },

    Product: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
        },
        name: {
          type: 'string',
          example: 'Pollo a la Brasa 1/4',
        },
        category: {
          type: 'string',
          example: 'PARRILLA',
        },
        priceCents: {
          type: 'integer',
          description: 'Price in cents',
          example: 2500,
        },
        isActive: {
          type: 'boolean',
        },
        tenantId: {
          type: 'string',
          format: 'uuid',
        },
      },
    },
    StockLevel: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          format: 'uuid',
        },
        product: {
          $ref: '#/components/schemas/Product',
        },
        quantity: {
          type: 'number',
          description: 'Current stock quantity',
          example: 50.5,
        },
        unit: {
          type: 'string',
          description: 'Unit of measurement',
          example: 'kg',
        },
        lastUpdated: {
          type: 'string',
          format: 'date-time',
        },
      },
    },
    HealthCheckResult: {
      type: 'object',
      required: ['status', 'timestamp', 'components'],
      properties: {
        status: {
          type: 'string',
          enum: ['healthy', 'degraded', 'unhealthy'],
          description: 'Overall system health status',
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
        },
        components: {
          type: 'object',
          properties: {
            database: {
              $ref: '#/components/schemas/ComponentHealth',
            },
            redis: {
              $ref: '#/components/schemas/ComponentHealth',
            },
            eventSourcing: {
              $ref: '#/components/schemas/ComponentHealth',
            },
          },
        },
        responseTime: {
          type: 'number',
          description: 'Total response time in milliseconds',
        },
      },
    },
    ComponentHealth: {
      type: 'object',
      required: ['status', 'responseTime'],
      properties: {
        status: {
          type: 'string',
          enum: ['up', 'down', 'degraded'],
        },
        responseTime: {
          type: 'number',
          description: 'Component response time in milliseconds',
        },
        message: {
          type: 'string',
          description: 'Additional status information',
        },
        details: {
          type: 'object',
          description: 'Component-specific details',
        },
      },
    },
    MetricsResponse: {
      type: 'object',
      properties: {
        timeRange: {
          type: 'string',
          example: '24h',
        },
        metrics: {
          type: 'object',
          properties: {
            ordersCreated: {
              type: 'number',
              description: 'Total orders created in time range',
            },
            averageSyncLatency: {
              type: 'number',
              description: 'Average sync latency in milliseconds',
            },
            cacheHitRate: {
              type: 'number',
              description: 'Cache hit rate percentage',
            },
            errorRate: {
              type: 'number',
              description: 'Error rate percentage',
            },
          },
        },
      },
    },
  };
}

// ============================================================================
// New Module Paths (Phases A, B, E, F1-F3)
// ============================================================================

function getHRPaths(): OpenAPIV3.PathsObject {
  return {
    '/api/hr/employees': {
      get: { tags: ['HR'], summary: 'List employees', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Employee list' } } },
      post: { tags: ['HR'], summary: 'Create employee', security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, position: { type: 'string' }, dni: { type: 'string' } }, required: ['name', 'position', 'dni'] } } } }, responses: { '201': { description: 'Employee created' } } },
    },
    '/api/hr/employees/{id}': {
      get: { tags: ['HR'], summary: 'Get employee details', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'Employee details' } } },
      put: { tags: ['HR'], summary: 'Update employee', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'Employee updated' } } },
    },
    '/api/hr/attendance': {
      get: { tags: ['HR'], summary: 'List attendance records', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Attendance list' } } },
      post: { tags: ['HR'], summary: 'Clock in/out', security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { employeeId: { type: 'string' }, type: { type: 'string', enum: ['CLOCK_IN', 'CLOCK_OUT'] } } } } } }, responses: { '200': { description: 'Attendance recorded' } } },
    },
    '/api/hr/payroll/calculate': {
      post: { tags: ['HR'], summary: 'Calculate payroll for period', security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { periodMonth: { type: 'string', example: '2026-02' } } } } } }, responses: { '200': { description: 'Payroll calculated' } } },
    },
    '/api/hr/leave-requests': {
      get: { tags: ['HR'], summary: 'List leave requests', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Leave request list' } } },
      post: { tags: ['HR'], summary: 'Submit leave request', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Leave request created' } } },
    },
    '/api/hr/schedules': {
      get: { tags: ['HR'], summary: 'List schedules', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Schedule list' } } },
      post: { tags: ['HR'], summary: 'Create schedule', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Schedule created' } } },
    },
    '/api/hr/evaluations': {
      get: { tags: ['HR'], summary: 'List performance evaluations', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Evaluation list' } } },
      post: { tags: ['HR'], summary: 'Create evaluation', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Evaluation created' } } },
    },
    '/api/hr/training': {
      get: { tags: ['HR'], summary: 'List training modules', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Training list' } } },
      post: { tags: ['HR'], summary: 'Create training module', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Training created' } } },
    },
    '/api/hr/advances': {
      get: { tags: ['HR'], summary: 'List salary advances', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Advance list' } } },
      post: { tags: ['HR'], summary: 'Request salary advance', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Advance requested' } } },
    },
    '/api/hr/me': {
      get: { tags: ['HR'], summary: 'Get current employee profile (self-service)', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Employee profile' } } },
    },
    '/api/hr/reports': {
      get: { tags: ['HR'], summary: 'Generate HR reports (headcount, rotation, absenteeism)', security: [{ bearerAuth: [] }], parameters: [{ name: 'type', in: 'query', schema: { type: 'string', enum: ['headcount', 'rotation', 'absenteeism'] } }], responses: { '200': { description: 'Report data' } } },
    },
  };
}

function getPOSPaths(): OpenAPIV3.PathsObject {
  return {
    '/api/pos/shifts': {
      get: { tags: ['POS'], summary: 'Get current shift status', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Shift info' } } },
      post: { tags: ['POS'], summary: 'Open/close shift', security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { action: { type: 'string', enum: ['OPEN', 'CLOSE'] }, initialCash: { type: 'integer', description: 'Initial cash in centavos' } } } } } }, responses: { '200': { description: 'Shift updated' } } },
    },
    '/api/pos/payments': {
      post: { tags: ['POS'], summary: 'Process payment', security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { orderId: { type: 'string' }, method: { type: 'string', enum: ['CASH', 'CARD', 'YAPE', 'PLIN'] }, amount: { type: 'integer', description: 'Amount in centavos' } } } } } }, responses: { '200': { description: 'Payment processed' } } },
    },
    '/api/pos/invoices': {
      post: { tags: ['POS'], summary: 'Generate electronic invoice (boleta/factura)', security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { orderId: { type: 'string' }, type: { type: 'string', enum: ['BOLETA', 'FACTURA'] }, customerRuc: { type: 'string' } } } } } }, responses: { '200': { description: 'Invoice generated' } } },
    },
    '/api/pos/payment-qr': {
      post: { tags: ['POS'], summary: 'Generate Yape/Plin QR code for payment', security: [{ bearerAuth: [] }], responses: { '200': { description: 'QR code data' } } },
    },
  };
}

function getInvoicingPaths(): OpenAPIV3.PathsObject {
  return {
    '/api/admin/facturacion': {
      get: { tags: ['Invoicing'], summary: 'List invoices', security: [{ bearerAuth: [] }], parameters: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'SENT', 'ACCEPTED', 'REJECTED', 'VOIDED'] } }], responses: { '200': { description: 'Invoice list' } } },
      post: { tags: ['Invoicing'], summary: 'Create invoice', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Invoice created' } } },
    },
    '/api/admin/facturacion/{invoiceId}': {
      get: { tags: ['Invoicing'], summary: 'Get invoice details', security: [{ bearerAuth: [] }], parameters: [{ name: 'invoiceId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Invoice details' } } },
    },
    '/api/admin/facturacion/{invoiceId}/pdf': {
      get: { tags: ['Invoicing'], summary: 'Download invoice PDF', security: [{ bearerAuth: [] }], parameters: [{ name: 'invoiceId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'PDF file' } } },
    },
    '/api/admin/facturacion/{invoiceId}/void': {
      post: { tags: ['Invoicing'], summary: 'Void invoice', security: [{ bearerAuth: [] }], parameters: [{ name: 'invoiceId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Invoice voided' } } },
    },
    '/api/admin/facturacion/stats': {
      get: { tags: ['Invoicing'], summary: 'Invoicing statistics', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Stats data' } } },
    },
  };
}

function getRecipePaths(): OpenAPIV3.PathsObject {
  return {
    '/api/admin/recipes': {
      get: { tags: ['Recipes'], summary: 'List recipes', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Recipe list' } } },
      post: { tags: ['Recipes'], summary: 'Create recipe with ingredients', security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, productId: { type: 'string' }, ingredients: { type: 'array', items: { type: 'object', properties: { inventoryItemCode: { type: 'string' }, quantity: { type: 'number' }, unit: { type: 'string' } } } } } } } } }, responses: { '201': { description: 'Recipe created' } } },
    },
    '/api/admin/recipes/{id}': {
      put: { tags: ['Recipes'], summary: 'Update recipe', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Recipe updated' } } },
      delete: { tags: ['Recipes'], summary: 'Delete recipe', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '204': { description: 'Recipe deleted' } } },
    },
    '/api/admin/pollo-control': {
      get: { tags: ['Recipes'], summary: 'Get chicken production status', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Production data' } } },
    },
    '/api/admin/pollo-control/production': {
      post: { tags: ['Recipes'], summary: 'Register chicken production batch', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Production registered' } } },
    },
    '/api/admin/products/{id}/availability': {
      put: { tags: ['Recipes'], summary: 'Toggle product availability (auto-86)', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Availability updated' } } },
    },
  };
}

function getFinancePaths(): OpenAPIV3.PathsObject {
  return {
    '/api/admin/petty-cash': {
      get: { tags: ['Finance'], summary: 'List petty cash transactions', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Transaction list' } } },
      post: { tags: ['Finance'], summary: 'Register petty cash expense', security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { amount: { type: 'integer', description: 'Amount in centavos' }, description: { type: 'string' }, category: { type: 'string' } } } } } }, responses: { '201': { description: 'Expense registered' } } },
    },
    '/api/admin/petty-cash/{id}/approve': {
      post: { tags: ['Finance'], summary: 'Approve petty cash expense', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Expense approved' } } },
    },
    '/api/admin/petty-cash/reconcile': {
      post: { tags: ['Finance'], summary: 'Reconcile petty cash for period', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Reconciliation complete' } } },
    },
    '/api/admin/purchases': {
      get: { tags: ['Finance'], summary: 'List purchase orders', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Purchase order list' } } },
      post: { tags: ['Finance'], summary: 'Create purchase order', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Purchase order created' } } },
    },
    '/api/admin/purchases/{id}': {
      put: { tags: ['Finance'], summary: 'Update purchase order', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Purchase order updated' } } },
    },
    '/api/admin/reconciliation': {
      get: { tags: ['Finance'], summary: 'List payment settlements', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Settlement list' } } },
      post: { tags: ['Finance'], summary: 'Create reconciliation', security: [{ bearerAuth: [] }], responses: { '201': { description: 'Reconciliation created' } } },
    },
    '/api/admin/reconciliation/export': {
      get: { tags: ['Finance'], summary: 'Export reconciliation report', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Export file' } } },
    },
    '/api/admin/pnl': {
      get: { tags: ['Finance'], summary: 'Get profit & loss report', security: [{ bearerAuth: [] }], parameters: [{ name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } }, { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } }], responses: { '200': { description: 'P&L report data' } } },
    },
    '/api/admin/pnl/export': {
      get: { tags: ['Finance'], summary: 'Export P&L report as Excel', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Excel file' } } },
    },
  };
}

function getPlatformPaths(): OpenAPIV3.PathsObject {
  return {
    '/api/admin/platform-config': {
      get: { tags: ['Platforms'], summary: 'List platform configurations (PedidosYa, LlamaFood)', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Platform config list' } } },
      post: { tags: ['Platforms'], summary: 'Update platform configuration', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Config updated' } } },
    },
    '/api/admin/platform-orders': {
      get: { tags: ['Platforms'], summary: 'List platform orders', security: [{ bearerAuth: [] }], parameters: [{ name: 'platform', in: 'query', schema: { type: 'string', enum: ['PEDIDOSYA', 'LLAMAFOOD'] } }, { name: 'status', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'Platform order list' } } },
    },
    '/api/admin/platform-orders/{id}/accept': {
      post: { tags: ['Platforms'], summary: 'Accept platform order', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Order accepted' } } },
    },
    '/api/admin/platform-orders/{id}/reject': {
      post: { tags: ['Platforms'], summary: 'Reject platform order', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Order rejected' } } },
    },
    '/api/admin/waiter-ranking': {
      get: { tags: ['Platforms'], summary: 'Get waiter ranking metrics', security: [{ bearerAuth: [] }], parameters: [{ name: 'period', in: 'query', schema: { type: 'string', enum: ['daily', 'weekly', 'monthly'] } }], responses: { '200': { description: 'Waiter ranking data' } } },
    },
    '/api/admin/waiter-ranking/export': {
      get: { tags: ['Platforms'], summary: 'Export waiter ranking report', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Export file' } } },
    },
    '/api/webhooks/pedidosya': {
      post: { tags: ['Platforms'], summary: 'PedidosYa webhook receiver', responses: { '200': { description: 'Webhook processed' } } },
    },
    '/api/webhooks/llamafood': {
      post: { tags: ['Platforms'], summary: 'LlamaFood webhook receiver', responses: { '200': { description: 'Webhook processed' } } },
    },
    '/api/menu/{tenantSlug}/{tableId}': {
      get: { tags: ['Platforms'], summary: 'Public menu for QR table ordering', parameters: [{ name: 'tenantSlug', in: 'path', required: true, schema: { type: 'string' } }, { name: 'tableId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Public menu data' } } },
    },
    '/api/menu/{tenantSlug}/{tableId}/call-waiter': {
      post: { tags: ['Platforms'], summary: 'Call waiter from table QR', parameters: [{ name: 'tenantSlug', in: 'path', required: true, schema: { type: 'string' } }, { name: 'tableId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Waiter notified' } } },
    },
  };
}
