/**
 * Unit Tests: Dynamic Imports Utility
 * 
 * Tests the dynamic import utilities for code splitting functionality.
 */

import { describe, it, expect, vi } from 'vitest';
import { ComponentType } from 'react';

// Mock Next.js dynamic import
vi.mock('next/dynamic', () => ({
  default: (importFn: () => Promise<any>, options?: any) => {
    // Return a mock component that tracks the import function and options
    const MockComponent = () => null;
    (MockComponent as any).__importFn = importFn;
    (MockComponent as any).__options = options;
    return MockComponent;
  },
}));

describe('Dynamic Imports Utility', () => {
  describe('createDynamicComponent', () => {
    it('should create a dynamic component with default options', async () => {
      const { createDynamicComponent } = await import('../dynamic-imports');
      
      const mockImport = vi.fn(() => 
        Promise.resolve({ default: (() => null) as ComponentType })
      );
      
      const DynamicComp = createDynamicComponent(mockImport);
      
      expect(DynamicComp).toBeDefined();
      expect((DynamicComp as any).__importFn).toBe(mockImport);
      expect((DynamicComp as any).__options).toMatchObject({
        ssr: true,
      });
    });
    
    it('should create a dynamic component with SSR disabled', async () => {
      const { createDynamicComponent } = await import('../dynamic-imports');
      
      const mockImport = vi.fn(() => 
        Promise.resolve({ default: (() => null) as ComponentType })
      );
      
      const DynamicComp = createDynamicComponent(mockImport, { ssr: false });
      
      expect(DynamicComp).toBeDefined();
      expect((DynamicComp as any).__options).toMatchObject({
        ssr: false,
      });
    });
    
    it('should create a dynamic component with custom loading component', async () => {
      const { createDynamicComponent } = await import('../dynamic-imports');
      
      const mockImport = vi.fn(() => 
        Promise.resolve({ default: (() => null) as ComponentType })
      );
      
      const CustomLoading = () => null;
      const DynamicComp = createDynamicComponent(mockImport, { 
        loading: CustomLoading 
      });
      
      expect(DynamicComp).toBeDefined();
      expect((DynamicComp as any).__options.loading).toBe(CustomLoading);
    });
  });
  
  describe('createClientOnlyComponent', () => {
    it('should create a client-only component (SSR disabled)', async () => {
      const { createClientOnlyComponent } = await import('../dynamic-imports');
      
      const mockImport = vi.fn(() => 
        Promise.resolve({ default: (() => null) as ComponentType })
      );
      
      const ClientComp = createClientOnlyComponent(mockImport);
      
      expect(ClientComp).toBeDefined();
      expect((ClientComp as any).__options).toMatchObject({
        ssr: false,
      });
    });
  });
  
  describe('createDynamicPage', () => {
    it('should create a dynamic page with SSR disabled by default', async () => {
      const { createDynamicPage } = await import('../dynamic-imports');
      
      const mockImport = vi.fn(() => 
        Promise.resolve({ default: (() => null) as ComponentType })
      );
      
      const DynamicPage = createDynamicPage(mockImport);
      
      expect(DynamicPage).toBeDefined();
      expect((DynamicPage as any).__options).toMatchObject({
        ssr: false,
      });
    });
    
    it('should create a dynamic page with SSR enabled when specified', async () => {
      const { createDynamicPage } = await import('../dynamic-imports');
      
      const mockImport = vi.fn(() => 
        Promise.resolve({ default: (() => null) as ComponentType })
      );
      
      const DynamicPage = createDynamicPage(mockImport, true);
      
      expect(DynamicPage).toBeDefined();
      expect((DynamicPage as any).__options).toMatchObject({
        ssr: true,
      });
    });
  });
  
  describe('DynamicDocComponents', () => {
    it('should export pre-defined documentation components', async () => {
      const { DynamicDocComponents } = await import('../dynamic-imports');
      
      expect(DynamicDocComponents.SwaggerUI).toBeDefined();
    });
    
    it('should configure doc components as client-only', async () => {
      const { DynamicDocComponents } = await import('../dynamic-imports');
      
      // Documentation components should be client-only
      expect((DynamicDocComponents.SwaggerUI as any).__options.ssr).toBe(false);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle import function that throws error', async () => {
      const { createDynamicComponent } = await import('../dynamic-imports');
      
      const mockImport = vi.fn(() => 
        Promise.reject(new Error('Import failed'))
      );
      
      const DynamicComp = createDynamicComponent(mockImport);
      
      expect(DynamicComp).toBeDefined();
      // The component should still be created, error handling is done by Next.js
    });
    
    it('should handle undefined options', async () => {
      const { createDynamicComponent } = await import('../dynamic-imports');
      
      const mockImport = vi.fn(() => 
        Promise.resolve({ default: (() => null) as ComponentType })
      );
      
      const DynamicComp = createDynamicComponent(mockImport, undefined);
      
      expect(DynamicComp).toBeDefined();
      expect((DynamicComp as any).__options).toBeDefined();
    });
    
    it('should handle empty options object', async () => {
      const { createDynamicComponent } = await import('../dynamic-imports');
      
      const mockImport = vi.fn(() => 
        Promise.resolve({ default: (() => null) as ComponentType })
      );
      
      const DynamicComp = createDynamicComponent(mockImport, {});
      
      expect(DynamicComp).toBeDefined();
      expect((DynamicComp as any).__options.ssr).toBe(true); // Default value
    });
  });
});
