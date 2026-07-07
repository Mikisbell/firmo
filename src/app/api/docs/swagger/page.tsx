/**
 * Swagger UI page for interactive API documentation
 * 
 * Provides a web interface for exploring and testing the FIRMO POS API
 */

'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { OpenAPIV3 } from 'openapi-types';

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });
import 'swagger-ui-react/swagger-ui.css';

export default function SwaggerUIPage() {
  const [spec, setSpec] = useState<OpenAPIV3.Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch OpenAPI spec from API endpoint
    fetch('/api/docs/openapi.json')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load OpenAPI spec: ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        setSpec(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando documentación de API...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error al cargar documentación</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Especificación de API no disponible</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <SwaggerUI spec={spec} />
    </div>
  );
}
