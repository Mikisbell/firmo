# 🔔 Arquitectura: Sistema de Notificaciones Admin

**Fecha:** 26 Enero 2026  
**Autor:** Análisis de Arquitectura de Software  
**Contexto:** Panel de Administración PARK POS

---

## 🎯 Visión General

El botón de notificaciones (campanita) en el admin panel debe servir como **centro de comando** para que los administradores y owners monitoreen eventos críticos del negocio en tiempo real.

---

## 📋 FUNCIONALIDADES CORE

### 1. **Notificaciones en Tiempo Real**

#### Tipos de Notificaciones Críticas:

**🔴 Operacionales (Alta Prioridad)**
- Estación KDS con retraso > 15 minutos
- Inventario bajo (< 10% del stock mínimo)
- Terminal offline > 5 minutos
- Error en sincronización de eventos
- Conflicto de concurrencia detectado
- Pago fallido o rechazado

**🟡 Alertas de Negocio (Media Prioridad)**
- Venta grande (> S/500)
- Devolución/void solicitado
- Descuento > 20% aplicado
- Turno sin cerrar después de hora de cierre
- Empleado con múltiples intentos de login fallidos

**🟢 Informativas (Baja Prioridad)**
- Nuevo empleado registrado
- Producto agotado
- Reporte diario generado
- Backup completado exitosamente

#### Arquitectura de Notificaciones:

```typescript
interface AdminNotification {
  id: string;
  type: 'OPERATIONAL' | 'BUSINESS' | 'INFO';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'KDS' | 'INVENTORY' | 'TERMINAL' | 'PAYMENT' | 'EMPLOYEE' | 'SYSTEM';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionable: boolean;
  action?: {
    type: 'NAVIGATE' | 'MODAL' | 'API_CALL';
    target: string;
    label: string;
  };
  metadata?: Record<string, any>;
}
```

---

### 2. **UI/UX del Botón de Campanita**

#### Estado Visual:

```typescript
// Estados del botón
type NotificationBellState = 
  | 'idle'           // Sin notificaciones no leídas
  | 'unread'         // Hay notificaciones no leídas
  | 'critical'       // Hay notificaciones críticas
  | 'loading';       // Cargando notificaciones

// Indicadores visuales
interface BellIndicator {
  badge: number;              // Contador de no leídas
  pulse: boolean;             // Animación para críticas
  color: 'gray' | 'blue' | 'red';
}
```

#### Comportamiento del Botón:

1. **Click en Campanita:**
   - Abre dropdown/panel lateral con lista de notificaciones
   - Marca como "vistas" (no necesariamente leídas)
   - Muestra últimas 20 notificaciones
   - Botón "Ver todas" → navega a `/admin/notificaciones`

2. **Badge de Contador:**
   - Muestra número de notificaciones NO LEÍDAS
   - Máximo 99+ para evitar overflow visual
   - Color rojo para notificaciones críticas
   - Desaparece cuando todas están leídas

3. **Animaciones:**
   - Pulse suave para notificaciones críticas nuevas
   - Fade in para nuevas notificaciones
   - Shake sutil para alertas de alta prioridad

---

### 3. **Panel de Notificaciones (Dropdown)**

#### Estructura del Dropdown:

```
┌─────────────────────────────────────┐
│ Notificaciones            [Marcar   │
│                            todas    │
│                            leídas]  │
├─────────────────────────────────────┤
│ 🔴 KDS Parrilla - Retraso 18min    │
│    Orden #1234 - Hace 2 min    [→] │
├─────────────────────────────────────┤
│ 🟡 Descuento 25% aplicado          │
│    Orden #1235 - Hace 5 min    [→] │
├─────────────────────────────────────┤
│ 🟢 Backup completado               │
│    Sistema - Hace 1 hora       [✓] │
├─────────────────────────────────────┤
│           [Ver todas]               │
└─────────────────────────────────────┘
```

#### Funcionalidades del Dropdown:

- **Scroll infinito** para cargar más notificaciones
- **Filtros rápidos:** Todas / No leídas / Críticas
- **Acciones rápidas:**
  - Click en notificación → Navega a contexto relevante
  - Swipe left → Marcar como leída
  - Swipe right → Eliminar
- **Agrupación inteligente:**
  - "3 estaciones con retraso" en lugar de 3 notificaciones separadas
  - "5 productos con stock bajo" agrupados

---

### 4. **Página Completa de Notificaciones**

#### Ruta: `/admin/notificaciones`

**Funcionalidades:**

1. **Vista de Lista Completa:**
   - Todas las notificaciones (paginadas)
   - Filtros avanzados: Tipo, Prioridad, Categoría, Fecha
   - Búsqueda por texto
   - Ordenamiento: Más recientes, Más antiguas, Por prioridad

2. **Panel de Configuración:**
   - Activar/desactivar tipos de notificaciones
   - Configurar umbrales (ej: "Alertar cuando retraso > X minutos")
   - Configurar canales (Web, Push, Email)
   - Horarios de notificaciones (No molestar)

3. **Historial y Auditoría:**
   - Ver notificaciones archivadas
   - Exportar historial
   - Estadísticas de notificaciones

---

## 🏗️ ARQUITECTURA TÉCNICA

### Backend: Sistema de Notificaciones

#### 1. Tabla de Base de Datos:

```sql
CREATE TABLE admin_notifications (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  type VARCHAR(20) NOT NULL,
  priority VARCHAR(10) NOT NULL,
  category VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  viewed BOOLEAN DEFAULT FALSE,
  actionable BOOLEAN DEFAULT FALSE,
  action_type VARCHAR(20),
  action_target VARCHAR(255),
  action_label VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP,
  expires_at TIMESTAMP,
  
  INDEX idx_tenant_unread (tenant_id, read, created_at DESC),
  INDEX idx_tenant_priority (tenant_id, priority, created_at DESC)
);
```

#### 2. API Endpoints:

```typescript
// GET /api/admin/notifications
// Query params: ?unread=true&limit=20&offset=0&priority=HIGH
interface GetNotificationsResponse {
  notifications: AdminNotification[];
  total: number;
  unreadCount: number;
}

// POST /api/admin/notifications/:id/read
// Marcar como leída

// POST /api/admin/notifications/read-all
// Marcar todas como leídas

// DELETE /api/admin/notifications/:id
// Eliminar notificación

// GET /api/admin/notifications/unread-count
// Solo contador (para polling ligero)
interface UnreadCountResponse {
  count: number;
  hasCritical: boolean;
}
```

#### 3. Sistema de Generación de Notificaciones:

```typescript
// src/core/notifications/admin-notifier.ts

class AdminNotifier {
  // Crear notificación desde evento del sistema
  async notifyFromEvent(event: DomainEvent): Promise<void> {
    const notification = this.mapEventToNotification(event);
    if (notification) {
      await this.createNotification(notification);
      await this.broadcastToAdmins(notification);
    }
  }
  
  // Crear notificación manual
  async createNotification(data: CreateNotificationInput): Promise<void> {
    await prisma.admin_notifications.create({ data });
    
    // Broadcast via WebSocket/SSE
    await this.broadcastToAdmins(data);
    
    // Push notification si está configurado
    if (data.priority === 'HIGH') {
      await this.sendPushNotification(data);
    }
  }
  
  // Reglas de negocio para notificaciones
  private mapEventToNotification(event: DomainEvent): AdminNotification | null {
    switch (event.type) {
      case 'KDS_ORDER_DELAYED':
        if (event.delayMinutes > 15) {
          return {
            type: 'OPERATIONAL',
            priority: 'HIGH',
            category: 'KDS',
            title: `KDS ${event.stationName} - Retraso ${event.delayMinutes}min`,
            message: `Orden #${event.orderNumber} lleva ${event.delayMinutes} minutos`,
            actionable: true,
            action: {
              type: 'NAVIGATE',
              target: `/admin/estaciones/${event.stationId}`,
              label: 'Ver estación'
            }
          };
        }
        return null;
        
      case 'INVENTORY_LOW_STOCK':
        return {
          type: 'BUSINESS',
          priority: 'MEDIUM',
          category: 'INVENTORY',
          title: 'Stock bajo',
          message: `${event.productName} tiene solo ${event.quantity} unidades`,
          actionable: true,
          action: {
            type: 'NAVIGATE',
            target: `/admin/inventario`,
            label: 'Ver inventario'
          }
        };
        
      // ... más mapeos
    }
  }
}
```

---

### Frontend: Componente de Notificaciones

#### 1. Hook Personalizado:

```typescript
// src/hooks/useAdminNotifications.ts

interface UseAdminNotificationsReturn {
  notifications: AdminNotification[];
  unreadCount: number;
  hasCritical: boolean;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAdminNotifications(): UseAdminNotificationsReturn {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasCritical, setHasCritical] = useState(false);
  
  // Polling cada 30 segundos para contador
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch('/api/admin/notifications/unread-count');
      const data = await res.json();
      setUnreadCount(data.count);
      setHasCritical(data.hasCritical);
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  // WebSocket/SSE para notificaciones en tiempo real
  useEffect(() => {
    const eventSource = new EventSource('/api/admin/notifications/stream');
    
    eventSource.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      if (notification.priority === 'HIGH') {
        setHasCritical(true);
        // Mostrar toast/alert
        showNotificationToast(notification);
      }
    };
    
    return () => eventSource.close();
  }, []);
  
  // ... resto de funciones
}
```

#### 2. Componente de Campanita:

```typescript
// src/app/admin/components/NotificationBell.tsx

export function NotificationBell() {
  const { unreadCount, hasCritical, notifications } = useAdminNotifications();
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-2 rounded-lg transition-colors",
          hasCritical ? "text-red-400 animate-pulse" : "text-zinc-400",
          "hover:bg-zinc-800"
        )}
      >
        <Bell className="w-5 h-5" />
        
        {unreadCount > 0 && (
          <span className={cn(
            "absolute -top-1 -right-1 px-1.5 py-0.5 text-xs font-bold rounded-full",
            hasCritical ? "bg-red-500" : "bg-blue-500",
            "text-white"
          )}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      
      {isOpen && (
        <NotificationDropdown
          notifications={notifications}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
```

---

## 🎨 MEJORES PRÁCTICAS

### 1. **Performance**

- **Polling inteligente:** Solo contador cada 30s, no toda la lista
- **WebSocket/SSE:** Para notificaciones en tiempo real
- **Paginación:** Cargar 20 notificaciones a la vez
- **Cache:** Usar React Query o SWR para cache de notificaciones
- **Optimistic updates:** Marcar como leída inmediatamente en UI

### 2. **UX**

- **No interrumpir:** Notificaciones no deben bloquear el trabajo
- **Contexto claro:** Cada notificación debe explicar QUÉ pasó y POR QUÉ importa
- **Acción directa:** Botón para ir al contexto relevante
- **Agrupación:** Evitar spam de notificaciones similares
- **Persistencia:** Notificaciones importantes no desaparecen hasta ser leídas

### 3. **Seguridad**

- **Autenticación:** Solo ADMIN y OWNER pueden ver notificaciones
- **Tenant isolation:** Cada tenant solo ve sus notificaciones
- **Rate limiting:** Limitar creación de notificaciones para evitar spam
- **Sanitización:** Escapar HTML en mensajes de notificaciones

### 4. **Escalabilidad**

- **Expiración automática:** Notificaciones > 30 días se archivan
- **Límite de almacenamiento:** Máximo 1000 notificaciones por tenant
- **Background jobs:** Generación de notificaciones en workers
- **Índices optimizados:** Para queries de notificaciones no leídas

---

## 🚀 ROADMAP DE IMPLEMENTACIÓN

### Fase 1: MVP (Actual) ✅
- [x] Botón de campanita en header
- [x] Navegación a página de notificaciones
- [x] Página básica de gestión de suscripciones push

### Fase 2: Notificaciones Básicas (Próxima)
- [ ] Tabla `admin_notifications` en base de datos
- [ ] API endpoints CRUD
- [ ] Dropdown con lista de notificaciones
- [ ] Contador de no leídas
- [ ] Marcar como leída

### Fase 3: Tiempo Real
- [ ] WebSocket/SSE para notificaciones en tiempo real
- [ ] Sistema de generación automática desde eventos
- [ ] Toast notifications para alertas críticas
- [ ] Sonido/vibración para notificaciones importantes

### Fase 4: Avanzado
- [ ] Filtros y búsqueda avanzada
- [ ] Configuración de preferencias
- [ ] Push notifications (Web Push API)
- [ ] Email notifications
- [ ] Historial y auditoría

---

## 📊 MÉTRICAS DE ÉXITO

| Métrica | Objetivo |
|---------|----------|
| Tiempo de respuesta a alertas críticas | < 2 minutos |
| Tasa de notificaciones leídas | > 80% |
| Falsos positivos | < 5% |
| Tiempo de carga del dropdown | < 200ms |
| Latencia de notificación en tiempo real | < 1 segundo |

---

## 🔗 REFERENCIAS

- **Página actual:** `/admin/notificaciones` (gestión de suscripciones push)
- **Componente:** `src/app/admin/components/AdminHeader.tsx` (campanita)
- **API:** `src/app/api/admin/notifications/status/route.ts`
- **Tipos:** `src/core/notifications/types.ts`

---

**Conclusión:**

El botón de notificaciones debe evolucionar de un simple enlace a un **centro de comando en tiempo real** que permita a los administradores:

1. **Monitorear** el estado del negocio
2. **Reaccionar** rápidamente a problemas
3. **Tomar decisiones** informadas
4. **Mantener control** sobre operaciones críticas

La implementación debe ser **incremental**, empezando con funcionalidad básica y evolucionando hacia un sistema robusto de notificaciones en tiempo real.
