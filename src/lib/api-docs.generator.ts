/**
 * OpenAPI/Swagger Documentation Generator
 * 
 * Generates comprehensive API documentation with:
 * - Schema definitions from Prisma models
 * - Endpoint documentation from route analysis
 * - Security schemes for JWT authentication
 * - Example requests and responses
 * - Interactive testing interface
 */

import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

type PrismaModel = any;

export interface OpenAPIDocument {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
    contact: {
      name: string;
      email: string;
    };
    license: {
      name: string;
      url: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  security: Array<{
    type: string;
    scheme?: string;
    bearerFormat?: string;
    description: string;
    in?: string;
    name?: string;
    [key: string]: any;
  }>;
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
    securitySchemes: Record<string, any>;
    responses: Record<string, any>;
    parameters: Record<string, any>;
  };
  tags: Array<{
    name: string;
    description: string;
  }>;
}

class DocumentationGenerator {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Generate complete OpenAPI documentation
   */
  async generateDocumentation(): Promise<OpenAPIDocument> {
    const schemas = await this.generateSchemas();
    const paths = await this.generatePaths();
    const security = this.generateSecuritySchemes();

    return {
      openapi: '3.0.0',
      info: {
        title: 'PARK POS API',
        description: `
## Overview
PARK POS is a comprehensive Point of Sale system for restaurants with delivery capabilities.

## Features
- **Order Management**: Create, update, and manage customer orders
- **Inventory Control**: Real-time stock tracking and management
- **Employee Management**: Role-based access control and authentication
- **Delivery Tracking**: Real-time driver assignment and delivery monitoring
- **Payment Processing**: Multiple payment methods and automatic billing
- **Analytics & Reporting**: Comprehensive sales and operational metrics

## Authentication
The API uses JWT tokens for authentication. Include the token in the Authorization header:

\`\`\`http
Authorization: Bearer <your-jwt-token>
\`\`\`

## Rate Limiting
- **100 requests per minute** for regular endpoints
- **30 requests per minute** for authentication endpoints

## Error Handling
All errors follow this standard format:
\`\`\`json
{
  "error": "Error message",
  "errorCode": "ERROR_CODE",
  "details": { ... }
}
\`\`\`

## Environment
- **Development**: http://localhost:3000/api
- **Production**: https://parkpos.pe/api
        `,
        version: '2.0.0',
        contact: {
          name: 'PARK POS Support',
          email: 'support@parkpos.pe',
        },
        license: {
          name: 'MIT',
          url: 'https://github.com/park-pos/license',
        },
      },
      servers: [
        {
          url: process.env.NODE_ENV === 'production' 
            ? 'https://parkpos.pe/api'
            : 'http://localhost:3000/api',
          description: process.env.NODE_ENV === 'production' 
            ? 'Production Server'
            : 'Development Server',
        },
      ],
      security,
      paths,
      components: {
        schemas,
        securitySchemes: security.reduce((acc: Record<string, unknown>, scheme) => {
          const name = scheme.name || scheme.scheme || 'default';
          acc[name] = scheme;
          return acc;
        }, {}),
        responses: this.generateStandardResponses(),
        parameters: this.generateStandardParameters(),
      },
      tags: this.generateTags(),
    };
  }

  /**
   * Generate schema definitions from Prisma models
   */
  private async generateSchemas(): Promise<Record<string, any>> {
    return {
      // Authentication schemas
      LoginRequest: {
        type: 'object',
        required: ['pin', 'tenantId'],
        properties: {
          pin: {
            type: 'string',
            description: 'Employee PIN (4-6 digits)',
            pattern: '^[0-9]{4,6}$',
            example: '1234',
          },
          tenantId: {
            type: 'string',
            format: 'uuid',
            description: 'Tenant identifier',
            example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          },
          metadata: {
            type: 'object',
            properties: {
              ip: { type: 'string', description: 'Client IP address' },
              userAgent: { type: 'string', description: 'Client user agent' },
              terminalId: { type: 'string', description: 'Terminal identifier' },
            },
          },
        },
      },

      LoginResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          token: { 
            type: 'string',
            description: 'JWT authentication token',
          },
          refreshToken: {
            type: 'string',
            description: 'Token for refreshing authentication',
          },
          employee: { $ref: '#/components/schemas/Employee' },
          expiresAt: {
            type: 'string',
            format: 'date-time',
          },
          mfaRequired: {
            type: 'boolean',
            description: 'Whether MFA is required',
          },
        },
      },

      Employee: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', description: 'Employee full name' },
          role: { 
            type: 'string',
            enum: ['ADMIN', 'MANAGER', 'CASHIER', 'COOK', 'WAITER', 'DRIVER'],
            description: 'Employee role/permissions',
          },
          isActive: { type: 'boolean', description: 'Whether the employee is active' },
          pinHash: { type: 'string', description: 'Hashed PIN (internal use only)' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      Order: {
        type: 'object',
        required: ['orderType', 'items'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          orderNumber: { type: 'integer', description: 'Sequential order number' },
          orderType: { 
            type: 'string',
            enum: ['DINE_IN', 'TAKEOUT', 'DELIVERY', 'ONLINE'],
            description: 'Type of order',
          },
          orderStatus: {
            type: 'string',
            enum: ['OPEN', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'],
            description: 'Current order status',
          },
          fulfillmentStatus: {
            type: 'string',
            enum: ['PENDING', 'COOKING', 'READY', 'PICKED_UP', 'DELIVERED'],
            description: 'Order fulfillment status',
          },
          subtotalCents: { type: 'integer', minimum: 0, description: 'Subtotal in cents' },
          taxCents: { type: 'integer', minimum: 0, description: 'Tax amount in cents' },
          totalCents: { type: 'integer', minimum: 0, description: 'Total amount in cents' },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/OrderItem' },
            description: 'Order items',
          },
          customerId: { type: 'string', format: 'uuid', description: 'Customer identifier' },
          terminalId: { type: 'string', format: 'uuid' },
          shiftId: { type: 'string', format: 'uuid' },
          tableId: { type: 'string', format: 'uuid' },
          waiterId: { type: 'string', format: 'uuid' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      OrderItem: {
        type: 'object',
        required: ['productId', 'quantity', 'priceCents'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          productId: { type: 'string', format: 'uuid' },
          quantity: { type: 'number', minimum: 0.01 },
          unitPriceCents: { type: 'integer', minimum: 0 },
          totalPriceCents: { type: 'integer', minimum: 0 },
          notes: { type: 'string' },
          modifications: { type: 'array', items: { type: 'string' } },
        },
      },

      Product: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          sku: { type: 'string', description: 'Stock keeping unit' },
          name: { type: 'string', description: 'Product name' },
          shortName: { type: 'string', description: 'Display name' },
          priceCents: { type: 'integer', minimum: 0 },
          category: { type: 'string', description: 'Product category' },
          station: { type: 'string', description: 'Preparation station' },
          type: { type: 'string', enum: ['SIMPLE', 'COMBO', 'CUSTOM'] },
          isActive: { type: 'boolean' },
          images: {
            type: 'array',
            items: { type: 'string', format: 'uri' },
            description: 'Product image URLs',
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      Customer: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          phone: { type: 'string', description: 'Phone number (primary identifier)' },
          name: { type: 'string', description: 'Customer full name' },
          email: { type: 'string', format: 'email' },
          addresses: {
            type: 'array',
            items: { $ref: '#/components/schemas/DeliveryAddress' },
          },
          marketingOptIn: { type: 'boolean' },
          totalOrders: { type: 'integer' },
          totalSpent: { type: 'integer' },
          lastOrderAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      DeliveryAddress: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          label: { type: 'string' },
          addressText: { type: 'string' },
          reference: { type: 'string' },
          district: { type: 'string' },
          lat: { type: 'number', minimum: -90, maximum: 90 },
          lng: { type: 'number', minimum: -180, maximum: 180 },
          isDefault: { type: 'boolean' },
          deliveryFee: { type: 'integer', minimum: 0 },
        },
      },

      DeliveryOrder: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          orderId: { type: 'string', format: 'uuid' },
          driverId: { type: 'string', format: 'uuid' },
          addressId: { type: 'string', format: 'uuid' },
          addressText: { type: 'string' },
          customerPhone: { type: 'string' },
          deliveryFee: { type: 'integer', minimum: 0 },
          status: {
            type: 'string',
            enum: ['PENDING', 'ASSIGNED', 'DISPATCHED', 'DELIVERED', 'FAILED'],
          },
          estimatedDeliveryAt: { type: 'string', format: 'date-time' },
          assignedAt: { type: 'string', format: 'date-time' },
          dispatchedAt: { type: 'string', format: 'date-time' },
          deliveredAt: { type: 'string', format: 'date-time' },
          deliveryTimeMins: { type: 'integer', minimum: 0 },
          signatureUrl: { type: 'string', format: 'uri' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      // Pagination schemas
      PaginatedRequest: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          cursor: { type: 'string' },
          orderBy: { type: 'object' },
        },
      },

      PaginatedResponse: {
        type: 'object',
        properties: {
          data: { type: 'array' },
          pagination: { $ref: '#/components/schemas/PaginationInfo' },
        },
      },

      PaginationInfo: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
          hasNext: { type: 'boolean' },
          hasPrevious: { type: 'boolean' },
          nextCursor: { type: 'string' },
        },
      },

      // Error schemas
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string', description: 'Human-readable error message' },
          errorCode: {
            type: 'string',
            description: 'Machine-readable error code',
            enum: [
              'INVALID_PIN', 'ACCOUNT_LOCKED', 'ROLE_NOT_ALLOWED', 'INACTIVE_EMPLOYEE',
              'MFA_REQUIRED', 'INVALID_MFA', 'SESSION_EXPIRED',
              'VALIDATION_ERROR', 'NOT_FOUND', 'UNAUTHORIZED',
              'RATE_LIMITED', 'INTERNAL_ERROR'
            ],
          },
          details: { type: 'object', description: 'Additional error details' },
          timestamp: { type: 'string', format: 'date-time' },
          requestId: { type: 'string', description: 'Request tracking identifier' },
        },
      },
    };
  }

  /**
   * Generate API path documentation
   */
  private async generatePaths(): Promise<Record<string, any>> {
    return {
      // Authentication endpoints
      '/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Employee login with PIN',
          description: 'Authenticates an employee using their PIN and tenant ID. Returns JWT token and refresh token.',
          requestBody: {
            description: 'Login credentials',
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/LoginResponse' },
                },
              },
            },
            '401': {
              description: 'Invalid credentials',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            '429': {
              description: 'Rate limit exceeded',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
          security: [],
        },
      },

      '/auth/refresh': {
        post: {
          tags: ['Authentication'],
          summary: 'Refresh JWT token',
          description: 'Uses a valid refresh token to generate a new JWT token.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['refreshToken'],
                  properties: {
                    refreshToken: {
                      type: 'string',
                      description: 'Valid refresh token',
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Token refreshed successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      token: { type: 'string' },
                      expiresAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
            '401': {
              description: 'Invalid or expired refresh token',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
          security: [],
        },
      },

      '/auth/logout': {
        post: {
          tags: ['Authentication'],
          summary: 'Logout user',
          description: 'Invalidates the current JWT token and revokes the session.',
          requestBody: {
            description: 'Empty request body',
          },
          responses: {
            '200': {
              description: 'Logout successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
          security: [{ bearerAuth: [] }],
        },
      },

      // Order endpoints
      '/orders': {
        get: {
          tags: ['Orders'],
          summary: 'List orders with pagination',
          description: 'Returns a paginated list of orders for the authenticated tenant.',
          parameters: [
            {
              name: 'page',
              in: 'query',
              schema: { type: 'integer', minimum: 1, default: 1 },
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            },
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['OPEN', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'],
              },
            },
            {
              name: 'startDate',
              in: 'query',
              schema: { type: 'string', format: 'date' },
            },
            {
              name: 'endDate',
              in: 'query',
              schema: { type: 'string', format: 'date' },
            },
          ],
          responses: {
            '200': {
              description: 'Orders retrieved successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/PaginatedResponse' },
                },
              },
            },
          },
          security: [{ bearerAuth: [] }],
        },

        post: {
          tags: ['Orders'],
          summary: 'Create new order',
          description: 'Creates a new order with items and calculates total.',
          requestBody: {
            description: 'Order data with items',
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Order' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Order created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Order' },
                },
              },
            },
            '400': {
              description: 'Invalid order data',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
          security: [{ bearerAuth: [] }],
        },
      },

      '/orders/{id}': {
        get: {
          tags: ['Orders'],
          summary: 'Get order by ID',
          description: 'Returns detailed information about a specific order.',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Order UUID',
            },
          ],
          responses: {
            '200': {
              description: 'Order retrieved successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Order' },
                },
              },
            },
            '404': {
              description: 'Order not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
          security: [{ bearerAuth: [] }],
        },

        put: {
          tags: ['Orders'],
          summary: 'Update order',
          description: 'Updates order status, items, or other details.',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Order UUID',
            },
          ],
          requestBody: {
            description: 'Updated order data',
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Order' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Order updated successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Order' },
                },
              },
            },
            '404': {
              description: 'Order not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
          security: [{ bearerAuth: [] }],
        },
      },

      // Product endpoints
      '/products': {
        get: {
          tags: ['Products'],
          summary: 'List products',
          description: 'Returns a paginated list of products with filtering options.',
          parameters: [
            {
              name: 'page',
              in: 'query',
              schema: { type: 'integer', minimum: 1, default: 1 },
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            },
            {
              name: 'category',
              in: 'query',
              schema: { type: 'string' },
            },
            {
              name: 'search',
              in: 'query',
              schema: { type: 'string' },
            },
            {
              name: 'isActive',
              in: 'query',
              schema: { type: 'boolean' },
            },
          ],
          responses: {
            '200': {
              description: 'Products retrieved successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/PaginatedResponse' },
                },
              },
            },
          },
          security: [{ bearerAuth: [] }],
        },
      },

      // Delivery endpoints
      '/delivery/orders': {
        get: {
          tags: ['Delivery'],
          summary: 'List delivery orders',
          description: 'Returns delivery orders with driver assignments and status.',
          parameters: [
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['PENDING', 'ASSIGNED', 'DISPATCHED', 'DELIVERED', 'FAILED'],
              },
            },
            {
              name: 'driverId',
              in: 'query',
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            '200': {
              description: 'Delivery orders retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/DeliveryOrder' },
                  },
                },
              },
            },
          },
          security: [{ bearerAuth: [] }],
        },

        post: {
          tags: ['Delivery'],
          summary: 'Assign driver to delivery',
          description: 'Assigns a driver to a delivery order and calculates ETA.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['orderId', 'driverId'],
                  properties: {
                    orderId: { type: 'string', format: 'uuid' },
                    driverId: { type: 'string', format: 'uuid' },
                    notes: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Driver assigned successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/DeliveryOrder' },
                },
              },
            },
          },
          security: [{ bearerAuth: [] }],
        },
      },

      // Customer endpoints
      '/customers': {
        get: {
          tags: ['Customers'],
          summary: 'List customers',
          description: 'Returns a paginated list of customers.',
          parameters: [
            {
              name: 'page',
              in: 'query',
              schema: { type: 'integer', minimum: 1, default: 1 },
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            },
            {
              name: 'phone',
              in: 'query',
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Customers retrieved successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/PaginatedResponse' },
                },
              },
            },
          },
          security: [{ bearerAuth: [] }],
        },

        post: {
          tags: ['Customers'],
          summary: 'Create new customer',
          description: 'Creates a new customer profile.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Customer' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Customer created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Customer' },
                },
              },
            },
          },
          security: [{ bearerAuth: [] }],
        },
      },

      // Add more endpoints as needed...
    };
  }

  /**
   * Generate security schemes
   */
  private generateSecuritySchemes(): Array<{
    type: string;
    scheme?: string;
    bearerFormat?: string;
    description: string;
    in?: string;
    name?: string;
    [key: string]: any;
  }> {
    return [
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT authentication token obtained from login endpoint',
      },
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-Api-Secret',
        description: 'API secret key for system-to-system communication',
      },
    ];
  }

  /**
   * Generate standard response schemas
   */
  private generateStandardResponses(): Record<string, any> {
    return {
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: { type: 'object' },
        },
      },
      
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string' },
          errorCode: { type: 'string' },
          details: { type: 'object' },
          timestamp: { type: 'string', format: 'date-time' },
          requestId: { type: 'string' },
        },
      },

      ValidationError: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Validation failed' },
          errorCode: { type: 'string', example: 'VALIDATION_ERROR' },
          details: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },

      NotFoundError: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Resource not found' },
          errorCode: { type: 'string', example: 'NOT_FOUND' },
          resourceId: { type: 'string' },
          resourceType: { type: 'string' },
        },
      },

      UnauthorizedError: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Unauthorized access' },
          errorCode: { type: 'string', example: 'UNAUTHORIZED' },
        },
      },

      RateLimitError: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Rate limit exceeded' },
          errorCode: { type: 'string', example: 'RATE_LIMITED' },
          retryAfter: { type: 'integer', description: 'Seconds to wait before retrying' },
          limit: { type: 'integer', description: 'Request limit' },
          windowMs: { type: 'integer', description: 'Time window in milliseconds' },
        },
      },
    };
  }

  /**
   * Generate standard parameter schemas
   */
  private generateStandardParameters(): Record<string, any> {
    return {
      PageParam: {
        name: 'page',
        in: 'query',
        description: 'Page number for pagination',
        schema: { type: 'integer', minimum: 1, default: 1 },
      },

      LimitParam: {
        name: 'limit',
        in: 'query',
        description: 'Number of items per page (max 100)',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },

      SearchParam: {
        name: 'search',
        in: 'query',
        description: 'Search term for filtering results',
        schema: { type: 'string' },
      },

      SortParam: {
        name: 'sort',
        in: 'query',
        description: 'Sort field and direction (format: field:asc|desc)',
        schema: { type: 'string', pattern: '^[a-zA-Z_]+:(asc|desc)$' },
      },

      FilterParam: {
        name: 'filter',
        in: 'query',
        description: 'Filter criteria in JSON format',
        schema: { type: 'string' },
      },

      UUIDParam: {
        name: 'id',
        in: 'path',
        required: true,
        description: 'Resource UUID identifier',
        schema: { type: 'string', format: 'uuid' },
      },
    };
  }

  /**
   * Generate API tags
   */
  private generateTags(): Array<{
    name: string;
    description: string;
  }> {
    return [
      {
        name: 'Authentication',
        description: 'Login, logout, and token management operations',
      },
      {
        name: 'Orders',
        description: 'Order creation, management, and tracking',
      },
      {
        name: 'Products',
        description: 'Product catalog management and inventory',
      },
      {
        name: 'Customers',
        description: 'Customer profile and order history management',
      },
      {
        name: 'Delivery',
        description: 'Delivery order management and driver assignment',
      },
      {
        name: 'Employees',
        description: 'Employee management and access control',
      },
      {
        name: 'Analytics',
        description: 'Sales reports and operational metrics',
      },
      {
        name: 'Inventory',
        description: 'Stock management and tracking',
      },
      {
        name: 'Payments',
        description: 'Payment processing and transaction management',
      },
    ];
  }

  /**
   * Generate Swagger UI HTML page
   */
  generateSwaggerHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PARK POS API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.0.0/swagger-ui-bundle.css" />
    <style>
        body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #2563eb; }
        .header p { color: #6c757d; max-width: 600px; margin: 0 auto; }
        .api-info { background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .endpoint { margin-bottom: 20px; border: 1px solid #dee2e6; border-radius: 5px; padding: 15px; }
        .endpoint h3 { color: #2563eb; margin-top: 0; }
        .method { display: inline-block; padding: 4px 8px; border-radius: 3px; color: white; font-weight: bold; margin-right: 10px; }
        .method.get { background: #28a745; }
        .method.post { background: #007bff; }
        .method.put { background: #ffc107; color: #000; }
        .method.delete { background: #dc3545; }
        .path { font-family: monospace; background: #f1f3f4; padding: 2px 6px; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🍽️ PARK POS API</h1>
        <p>Comprehensive Point of Sale API with real-time order tracking, inventory management, and delivery coordination.</p>
    </div>
    
    <div class="api-info">
        <h3>🚀 Quick Start</h3>
        <p><strong>Base URL:</strong> <code id="baseUrl"></code></p>
        <p><strong>Authentication:</strong> Include token in Authorization header: <code>Bearer &lt;token&gt;</code></p>
        <p><strong>Rate Limiting:</strong> 100 requests/minute (30 for auth endpoints)</p>
    </div>

    <div id="swagger-ui"></div>

    <script src="https://unpkg.com/swagger-ui-dist@5.0.0/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.0.0/swagger-ui-standalone-preset.js"></script>
    <script>
        // Set base URL dynamically
        document.getElementById('baseUrl').textContent = window.location.origin + '/api';
        
        // Initialize Swagger UI
        SwaggerUIBundle({
            url: '/api/docs/openapi.json',
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset
            ],
            plugins: [
                SwaggerUIBundle.plugins.DownloadUrl
            ],
            layout: "StandaloneLayout"
        });
    </script>
</body>
</html>
    `;
  }

  /**
   * Export documentation as JSON
   */
  async exportDocumentation(): Promise<{ openapi: OpenAPIDocument; swaggerHTML: string }> {
    const openapi = await this.generateDocumentation();
    const swaggerHTML = this.generateSwaggerHTML();

    return {
      openapi,
      swaggerHTML,
    };
  }
}

export default DocumentationGenerator;