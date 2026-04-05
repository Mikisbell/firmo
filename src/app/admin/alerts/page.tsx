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
import { Button, Card, PageHeader, Tabs, TabsContent } from '@/src/components/ui';

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
      <Tabs
        className="mb-6"
        value={activeTab}
        onChange={(v) => setActiveTab(v as TabType)}
        tabs={[
          { value: 'configurations', label: 'Configuraciones' },
          { value: 'history', label: 'Historial de Alertas' },
          { value: 'maintenance', label: 'Ventanas de Mantenimiento' },
        ]}
      />

      {/* Tab Content */}
      <TabsContent value="configurations" activeValue={activeTab}>
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
      </TabsContent>

      <TabsContent value="history" activeValue={activeTab}><AlertHistory /></TabsContent>
      <TabsContent value="maintenance" activeValue={activeTab}><MaintenanceWindows /></TabsContent>
    </div>
  );
}
