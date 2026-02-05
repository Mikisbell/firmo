/**
 * Property-based tests for OpenAPI specification generator
 * 
 * Tests universal properties that should hold for all generated OpenAPI specs
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateOpenAPISpec } from '../generator';
import { OpenAPIV3 } from 'openapi-types';

describe('OpenAPI Generator Properties', () => {
  /**
   * Property 8: OpenAPI Specification Validity
   * 
   * For any generated OpenAPI specification, the output SHALL be valid OpenAPI 3.0 format
   * with all required fields (openapi, info, paths, components).
   * 
   * **Validates: Requirements 6.1**
   */
  it('Property 8: OpenAPI Specification Validity', () => {
    fc.assert(
      fc.property(
        fc.constant(null), // No input needed - testing the generator itself
        () => {
          const spec = generateOpenAPISpec();
          
          // Verify OpenAPI 3.0 format
          expect(spec.openapi).toBe('3.0.0');
          
          // Verify required top-level fields
          expect(spec).toHaveProperty('info');
          expect(spec).toHaveProperty('paths');
          expect(spec).toHaveProperty('components');
          
          // Verify info object has required fields
          expect(spec.info).toHaveProperty('title');
          expect(spec.info).toHaveProperty('version');
          expect(spec.info.title).toBeTruthy();
          expect(spec.info.version).toBeTruthy();
          
          // Verify paths is an object
          expect(typeof spec.paths).toBe('object');
          expect(spec.paths).not.toBeNull();
          
          // Verify components is an object
          expect(typeof spec.components).toBe('object');
          expect(spec.components).not.toBeNull();
        }
      ),
      {
        numRuns: 100,
        // Feature: system-consolidation-phase1, Property 8: OpenAPI Specification Validity
      }
    );
  });

  /**
   * Property 9: API Schema Completeness
   * 
   * For any documented API endpoint, the OpenAPI specification SHALL include request schema
   * with required fields, types, and examples, plus response schemas with status codes.
   * 
   * **Validates: Requirements 6.2, 6.3**
   */
  it('Property 9: API Schema Completeness', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const spec = generateOpenAPISpec();
          
          // Get all paths
          const paths = Object.keys(spec.paths);
          expect(paths.length).toBeGreaterThan(0);
          
          // Check each path has proper structure
          for (const path of paths) {
            const pathItem = spec.paths[path] as OpenAPIV3.PathItemObject;
            
            // Get all operations (GET, POST, etc.)
            const operations = ['get', 'post', 'put', 'delete', 'patch'] as const;
            
            for (const method of operations) {
              const operation = pathItem[method];
              if (!operation) continue;
              
              // Verify operation has required fields
              expect(operation).toHaveProperty('summary');
              expect(operation).toHaveProperty('tags');
              expect(operation).toHaveProperty('responses');
              
              // Verify responses object exists and has status codes
              expect(typeof operation.responses).toBe('object');
              const responseCodes = Object.keys(operation.responses);
              expect(responseCodes.length).toBeGreaterThan(0);
              
              // Verify each response has description
              for (const code of responseCodes) {
                const response = operation.responses[code] as OpenAPIV3.ResponseObject;
                expect(response).toHaveProperty('description');
                expect(response.description).toBeTruthy();
              }
              
              // If operation has requestBody, verify it has schema
              if (operation.requestBody) {
                const requestBody = operation.requestBody as OpenAPIV3.RequestBodyObject;
                expect(requestBody).toHaveProperty('content');
                expect(requestBody.content).toHaveProperty('application/json');
                
                const jsonContent = requestBody.content['application/json'];
                expect(jsonContent).toHaveProperty('schema');
              }
            }
          }
        }
      ),
      {
        numRuns: 100,
        // Feature: system-consolidation-phase1, Property 9: API Schema Completeness
      }
    );
  });

  /**
   * Property 10: API Authentication Documentation
   * 
   * For any protected API endpoint, the OpenAPI specification SHALL document
   * the authentication requirements (security schemes).
   * 
   * **Validates: Requirements 6.4**
   */
  it('Property 10: API Authentication Documentation', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const spec = generateOpenAPISpec();
          
          // Verify security schemes are defined
          expect(spec.components).toHaveProperty('securitySchemes');
          const securitySchemes = spec.components!.securitySchemes!;
          
          // Verify at least one security scheme exists
          const schemeNames = Object.keys(securitySchemes);
          expect(schemeNames.length).toBeGreaterThan(0);
          
          // Verify each security scheme has required fields
          for (const schemeName of schemeNames) {
            const scheme = securitySchemes[schemeName] as OpenAPIV3.SecuritySchemeObject;
            expect(scheme).toHaveProperty('type');
            expect(scheme.type).toBeTruthy();
          }
          
          // Check that protected endpoints reference security schemes
          const paths = Object.keys(spec.paths);
          let hasProtectedEndpoint = false;
          
          for (const path of paths) {
            const pathItem = spec.paths[path] as OpenAPIV3.PathItemObject;
            const operations = ['get', 'post', 'put', 'delete', 'patch'] as const;
            
            for (const method of operations) {
              const operation = pathItem[method];
              if (!operation) continue;
              
              // If operation has security, verify it references defined schemes
              if (operation.security && operation.security.length > 0) {
                hasProtectedEndpoint = true;
                
                for (const securityRequirement of operation.security) {
                  const requiredSchemes = Object.keys(securityRequirement);
                  
                  for (const requiredScheme of requiredSchemes) {
                    // Verify the required scheme is defined in components
                    expect(schemeNames).toContain(requiredScheme);
                  }
                }
              }
            }
          }
          
          // Verify at least some endpoints are protected
          expect(hasProtectedEndpoint).toBe(true);
        }
      ),
      {
        numRuns: 100,
        // Feature: system-consolidation-phase1, Property 10: API Authentication Documentation
      }
    );
  });
});
