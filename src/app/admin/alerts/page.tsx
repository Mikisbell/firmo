/**
 * Página de Configuración de Alertas
 * 
 * Permite a los administradores:
 * - Ver configuraciones de alertas existentes
 * - Crear nuevas configuraciones de alertas
 * - Editar umbrales y canales de notificación
 * - Ver historial de alertas
 * - Reconocer y resolver alertas activas
 * - Configurar ventanas de mantenimiento (snoozing)
 * 
 * @module app/admin/alerts
 */

'use client';

import { useState, useEffect } from 'react';
import { AlertConfigList } from './components/AlertConfigList';
import { AlertConfigForm } from './components/AlertConfigForm';
import { AlertHistory } from './components/AlertHistory';
import { MaintenanceWindows } from './components/MaintenanceWindows';
import { Button, Card, PageHeader } from '@/src/components/ui';

type TabType = 'configurations' | 'history' | 'maintenance';

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('configurations');
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Alertas"
        description="Gestiona umbrales de alertas, canales de notificación e historial"
      />

      {/* Tabs */}
      <div className="border-b border-park-gray-800 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('configurations')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'configurations'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-park-gray-500 hover:text-park-gray-300 hover:border-park-gray-700'
              }
            `}
          >
            Configuraciones
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'history'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-park-gray-500 hover:text-park-gray-300 hover:border-park-gray-700'
              }
            `}
          >
            Historial de Alertas
          </button>
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'maintenance'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-park-gray-500 hover:text-park-gray-300 hover:border-park-gray-700'
              }
            `}
          >
            Ventanas de Mantenimiento
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'configurations' && (
        <div>
          <div className="mb-4 flex justify-end">
            <Button variant="primary" onClick={() => setShowCreateForm(true)}>
              + Nueva Configuración
            </Button>
          </div>
          
          {showCreateForm && (
            <AlertConfigForm
              onClose={() => setShowCreateForm(false)}
              onSuccess={() => {
                setShowCreateForm(false);
                // Refresh list
              }}
            />
          )}
          
          <AlertConfigList />
        </div>
      )}

      {activeTab === 'history' && <AlertHistory />}
      {activeTab === 'maintenance' && <MaintenanceWindows />}
    </div>
  );
}
