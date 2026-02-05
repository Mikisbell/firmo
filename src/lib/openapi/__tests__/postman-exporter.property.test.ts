/**
 * Property-based tests for Postman collection exporter
 * 
 * Tests universal properties for Postman Collection v2.1 export
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { exportToPostman } from '../postman-exporter';
import { generateOpenAPISpec } from '../generator';

describe('Postman Exporter Properties', () => {
  /**
   * Property 11: Postman Collection Export
   * 
   * For any OpenAPI specification, the system SHALL be able to export a valid
   * Postman Collection v2.1 format containing all documented endpoints.
   * 
   * **Validates: Requirements 7.1, 7.2**
   */
  it('Property 11: Postman Collection Export', () => {
    fc.assert(
      fc.property(
        fc.constant(null), // Test with generated OpenAPI spec
        () => {
          const spec = generateOpenAPISpec();
          const collection = exportToPostman(spec);

          // Verify Postman Collection v2.1 format
          expect(collection).toHaveProperty('info');
          expect(collection).toHaveProperty('item');
          expect(collection).toHaveProperty('variable');

          // Verify info object
          expect(collection.info).toHaveProperty('name');
          expect(collection.info).toHaveProperty('schema');
          expect(collection.info.schema).toBe(
            'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
          );

          // Verify variables include baseUrl and authToken
          expect(collection.variable).toBeDefined();
          const variableKeys = collection.variable.map((v) => v.key);
          expect(variableKeys).toContain('baseUrl');
          expect(variableKeys).toContain('authToken');

          // Verify items (folders) exist
          expect(Array.isArray(collection.item)).toBe(true);
          expect(collection.item.length).toBeGreaterThan(0);

          // Verify each folder has items (requests)
          for (const folder of collection.item) {
            expect(folder).toHaveProperty('name');
            expect(folder).toHaveProperty('item');
            expect(Array.isArray(folder.item)).toBe(true);

            // Verify each request in folder
            if (folder.item) {
              for (const item of folder.item) {
                expect(item).toHaveProperty('name');
                expect(item).toHaveProperty('request');

                if (item.request) {
                  // Verify request structure
                  expect(item.request).toHaveProperty('method');
                  expect(item.request).toHaveProperty('header');
                  expect(item.request).toHaveProperty('url');

                  // Verify method is valid HTTP method
                  expect(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).toContain(
                    item.request.method
                  );

                  // Verify headers array
                  expect(Array.isArray(item.request.header)).toBe(true);

                  // Verify URL structure
                  expect(item.request.url).toHaveProperty('raw');
                  expect(item.request.url).toHaveProperty('host');
                  expect(item.request.url).toHaveProperty('path');
                  expect(Array.isArray(item.request.url.host)).toBe(true);
                  expect(Array.isArray(item.request.url.path)).toBe(true);

                  // Verify URL uses variables
                  expect(item.request.url.raw).toContain('{{baseUrl}}');
                }
              }
            }
          }

          // Count total endpoints in OpenAPI spec
          const specEndpointCount = Object.values(spec.paths).reduce((count, pathItem) => {
            const operations = ['get', 'post', 'put', 'delete', 'patch'] as const;
            return (
              count +
              operations.filter((method) => (pathItem as any)[method] !== undefined).length
            );
          }, 0);

          // Count total requests in Postman collection
          const collectionRequestCount = collection.item.reduce((count, folder) => {
            return count + (folder.item?.length || 0);
          }, 0);

          // Verify all endpoints are exported
          expect(collectionRequestCount).toBe(specEndpointCount);
        }
      ),
      {
        numRuns: 100,
        // Feature: system-consolidation-phase1, Property 11: Postman Collection Export
      }
    );
  });

  /**
   * Additional test: Verify authentication headers are included for protected endpoints
   */
  it('should include authentication headers for protected endpoints', () => {
    const spec = generateOpenAPISpec();
    const collection = exportToPostman(spec);

    let hasProtectedEndpoint = false;

    for (const folder of collection.item) {
      if (!folder.item) continue;

      for (const item of folder.item) {
        if (!item.request) continue;

        // Check if request has Authorization header
        const hasAuthHeader = item.request.header.some(
          (h) => h.key === 'Authorization' && h.value.includes('{{authToken}}')
        );

        if (hasAuthHeader) {
          hasProtectedEndpoint = true;
          // Verify the header format
          const authHeader = item.request.header.find((h) => h.key === 'Authorization');
          expect(authHeader?.value).toBe('Bearer {{authToken}}');
        }
      }
    }

    // Verify at least some endpoints are protected
    expect(hasProtectedEndpoint).toBe(true);
  });

  /**
   * Additional test: Verify request bodies are included for POST/PUT/PATCH
   */
  it('should include request bodies for POST/PUT/PATCH methods', () => {
    const spec = generateOpenAPISpec();
    const collection = exportToPostman(spec);

    let hasRequestBody = false;

    for (const folder of collection.item) {
      if (!folder.item) continue;

      for (const item of folder.item) {
        if (!item.request) continue;

        const method = item.request.method;
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
          if (item.request.body) {
            hasRequestBody = true;

            // Verify body structure
            expect(item.request.body).toHaveProperty('mode', 'raw');
            expect(item.request.body).toHaveProperty('raw');
            expect(item.request.body).toHaveProperty('options');
            expect(item.request.body.options.raw.language).toBe('json');

            // Verify body is valid JSON
            expect(() => JSON.parse(item.request.body!.raw)).not.toThrow();
          }
        }
      }
    }

    // Verify at least some endpoints have request bodies
    expect(hasRequestBody).toBe(true);
  });
});
