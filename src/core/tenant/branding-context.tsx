'use client';

/**
 * Tenant Branding Context
 * Provides global access to tenant branding configuration
 * Caches branding data to avoid repeated API calls
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export interface TenantBranding {
  legal_name: string;
  ruc?: string;
  address_text?: string;
  logo_url?: string;
  receipt_footer_text?: string;
  timezone: string;
  currency: string;
}

interface TenantBrandingContextType {
  branding: TenantBranding | null;
  isLoading: boolean;
  error: string | null;
  refreshBranding: () => Promise<void>;
}

const TenantBrandingContext = createContext<TenantBrandingContextType | undefined>(undefined);

export function TenantBrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBranding = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/tenant/configuration', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch branding: ${response.statusText}`);
      }

      const data = await response.json();
      setBranding({
        legal_name: data.legal_name,
        ruc: data.ruc,
        address_text: data.address_text,
        logo_url: data.logo_url,
        receipt_footer_text: data.receipt_footer_text,
        timezone: data.timezone,
        currency: data.currency,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load branding';
      setError(message);
      console.error('Error fetching tenant branding:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch branding on mount
  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const refreshBranding = useCallback(async () => {
    await fetchBranding();
  }, [fetchBranding]);

  return (
    <TenantBrandingContext.Provider
      value={{
        branding,
        isLoading,
        error,
        refreshBranding,
      }}
    >
      {children}
    </TenantBrandingContext.Provider>
  );
}

export function useTenantBranding() {
  const context = useContext(TenantBrandingContext);
  if (context === undefined) {
    throw new Error('useTenantBranding must be used within TenantBrandingProvider');
  }
  return context;
}
