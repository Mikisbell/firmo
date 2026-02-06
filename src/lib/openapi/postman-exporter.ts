/**
 * Postman Collection v2.1 Exporter
 * 
 * Converts OpenAPI 3.0 specification to Postman Collection format
 * for easy API testing and integration
 */

import { OpenAPIV3 } from 'openapi-types';

/**
 * Postman Collection v2.1 format
 */
export interface PostmanCollection {
  info: {
    name: string;
    description: string;
    schema: string;
  };
  variable: Array<{
    key: string;
    value: string;
    type: string;
  }>;
  item: PostmanItem[];
}

export interface PostmanItem {
  name: string;
  item?: PostmanItem[];
  request?: PostmanRequest;
}

export interface PostmanRequest {
  method: string;
  header: Array<{
    key: string;
    value: string;
    type: string;
  }>;
  url: {
    raw: string;
    host: string[];
    path: string[];
    query?: Array<{
      key: string;
      value: string;
      description: string;
    }>;
  };
  body?: {
    mode: string;
    raw: string;
    options: {
      raw: {
        language: string;
      };
    };
  };
  description?: string;
}

/**
 * Export OpenAPI specification to Postman Collection v2.1
 * 
 * @param spec - OpenAPI 3.0 specification
 * @returns Postman Collection v2.1 object
 */
export function exportToPostman(spec: OpenAPIV3.Document): PostmanCollection {
  const collection: PostmanCollection = {
    info: {
      name: spec.info.title,
      description: spec.info.description || '',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [
      {
        key: 'baseUrl',
        value: spec.servers?.[0]?.url || 'http://localhost:3000',
        type: 'string',
      },
      {
        key: 'authToken',
        value: '',
        type: 'string',
      },
    ],
    item: [],
  };

  // Group endpoints by tag
  const groupedEndpoints = groupEndpointsByTag(spec);

  // Convert each group to Postman folder
  for (const [tag, endpoints] of Object.entries(groupedEndpoints)) {
    const folder: PostmanItem = {
      name: tag,
      item: endpoints.map((endpoint) => convertEndpointToPostmanItem(endpoint, spec)),
    };
    collection.item.push(folder);
  }

  return collection;
}

/**
 * Group endpoints by their tags
 * 
 * @param spec - OpenAPI specification
 * @returns Endpoints grouped by tag name
 */
function groupEndpointsByTag(spec: OpenAPIV3.Document): Record<string, EndpointInfo[]> {
  const grouped: Record<string, EndpointInfo[]> = {};

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    const operations = ['get', 'post', 'put', 'delete', 'patch'] as const;

    for (const method of operations) {
      const operation = (pathItem as OpenAPIV3.PathItemObject)[method];
      if (!operation) continue;

      const tags = operation.tags || ['Untagged'];
      const tag = tags[0]; // Use first tag for grouping

      if (!grouped[tag]) {
        grouped[tag] = [];
      }

      grouped[tag].push({
        path,
        method: method.toUpperCase(),
        operation,
      });
    }
  }

  return grouped;
}

interface EndpointInfo {
  path: string;
  method: string;
  operation: OpenAPIV3.OperationObject;
}

/**
 * Convert an endpoint to a Postman request item
 * 
 * @param endpoint - Endpoint information
 * @param spec - OpenAPI specification
 * @returns Postman request item
 */
function convertEndpointToPostmanItem(
  endpoint: EndpointInfo,
  spec: OpenAPIV3.Document
): PostmanItem {
  const { path, method, operation } = endpoint;

  // Build URL
  const pathSegments = path.split('/').filter((s) => s);
  const url = {
    raw: `{{baseUrl}}${path}`,
    host: ['{{baseUrl}}'],
    path: pathSegments,
    query: buildQueryParameters(operation),
  };

  // Build headers
  const headers: Array<{ key: string; value: string; type: string }> = [
    {
      key: 'Content-Type',
      value: 'application/json',
      type: 'text',
    },
  ];

  // Add authentication header if required
  if (operation.security && operation.security.length > 0) {
    headers.push({
      key: 'Authorization',
      value: 'Bearer {{authToken}}',
      type: 'text',
    });
  }

  // Build request body
  const body = buildRequestBody(operation, spec);

  const request: PostmanRequest = {
    method,
    header: headers,
    url,
    description: operation.description || operation.summary || '',
  };

  if (body) {
    request.body = body;
  }

  return {
    name: operation.summary || `${method} ${path}`,
    request,
  };
}

/**
 * Build query parameters from operation parameters
 * 
 * @param operation - OpenAPI operation object
 * @returns Array of query parameters or undefined
 */
function buildQueryParameters(
  operation: OpenAPIV3.OperationObject
): Array<{ key: string; value: string; description: string }> | undefined {
  if (!operation.parameters) return undefined;

  const queryParams = operation.parameters
    .filter((param) => {
      const p = param as OpenAPIV3.ParameterObject;
      return p.in === 'query';
    })
    .map((param) => {
      const p = param as OpenAPIV3.ParameterObject;
      const schema = p.schema as OpenAPIV3.SchemaObject;
      const exampleValue = getExampleValue(schema);
      
      return {
        key: p.name,
        value: typeof exampleValue === 'string' ? exampleValue : String(exampleValue || ''),
        description: p.description || '',
      };
    });

  return queryParams.length > 0 ? queryParams : undefined;
}

/**
 * Build request body from operation requestBody
 * 
 * @param operation - OpenAPI operation object
 * @param spec - OpenAPI specification
 * @returns Request body configuration or undefined
 */
function buildRequestBody(
  operation: OpenAPIV3.OperationObject,
  spec: OpenAPIV3.Document
): PostmanRequest['body'] | undefined {
  if (!operation.requestBody) return undefined;

  const requestBody = operation.requestBody as OpenAPIV3.RequestBodyObject;
  const jsonContent = requestBody.content?.['application/json'];
  if (!jsonContent) return undefined;

  const schema = jsonContent.schema as OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;
  const exampleBody = buildExampleFromSchema(schema, spec);

  return {
    mode: 'raw',
    raw: JSON.stringify(exampleBody, null, 2),
    options: {
      raw: {
        language: 'json',
      },
    },
  };
}

/**
 * Build example object from schema
 * 
 * @param schema - OpenAPI schema object or reference
 * @param spec - OpenAPI specification
 * @returns Example object matching the schema
 */
function buildExampleFromSchema(
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
  spec: OpenAPIV3.Document
): unknown {
  // Handle $ref
  if ('$ref' in schema) {
    const refPath = schema.$ref.replace('#/components/schemas/', '');
    const referencedSchema = spec.components?.schemas?.[refPath] as OpenAPIV3.SchemaObject;
    if (referencedSchema) {
      return buildExampleFromSchema(referencedSchema, spec);
    }
    return {};
  }

  const s = schema as OpenAPIV3.SchemaObject;

  // Use example if provided
  if (s.example) return s.example;

  // Build example based on type
  if (s.type === 'object') {
    const example: Record<string, unknown> = {};
    if (s.properties) {
      for (const [key, propSchema] of Object.entries(s.properties)) {
        example[key] = buildExampleFromSchema(propSchema as OpenAPIV3.SchemaObject, spec);
      }
    }
    return example;
  }

  if (s.type === 'array') {
    const itemSchema = s.items as OpenAPIV3.SchemaObject;
    return [buildExampleFromSchema(itemSchema, spec)];
  }

  return getExampleValue(s);
}

/**
 * Get example value for a schema
 * 
 * @param schema - OpenAPI schema object
 * @returns Example value matching the schema type
 */
function getExampleValue(schema: OpenAPIV3.SchemaObject): unknown {
  if (schema.example) return schema.example;
  if (schema.default) return schema.default;

  switch (schema.type) {
    case 'string':
      if (schema.format === 'uuid') return '123e4567-e89b-12d3-a456-426614174000';
      if (schema.format === 'date-time') return new Date().toISOString();
      if (schema.enum) return schema.enum[0];
      return 'string';
    case 'number':
    case 'integer':
      return schema.minimum || 0;
    case 'boolean':
      return true;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return null;
  }
}
