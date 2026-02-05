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
