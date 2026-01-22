# Análisis Arquitectónico: Estaciones KDS

## Fecha
22 Enero 2026

## Problema
La ruta `/admin/estaciones` retorna 404 - la página no existe.

## Análisis Arquitectónico Completo

### 1. ¿Qué son las Estaciones KDS?

**KDS = Kitchen Display System** (Sistema de Pantallas de Cocina)

Las estaciones KDS son **áreas físicas de preparación** en la cocina/bar donde se muestran los pedidos en pantallas digitales.

### 2. Contexto del Negocio (Pollería)

Según `FLUJO_KDS.md` y `ARCHITECTURE.md`, una pollería típica tiene:

```
ESTACIONES FÍSICAS:

1. PARRILLA/HORNO 🔥
   - Pollos a la brasa
   - Carnes
   - Anticuchos
   - Tiempo: 15-25 min
   - Personal: 1-2 parrilleros

2. COCINA/FREIDORA 🍳
   - Papas fritas
   - Yucas
   - Guarniciones
   - Tiempo: 5-10 min
   - Personal: 1-2 cocineros

3. BAR 🍺
   - Bebidas
   - Jugos
   - Cócteles
   - Tiempo: 1-5 min
   - Personal: 1-2 barman

4. COCINA FRÍA ❄️
   - Ensaladas
   - Cremas
   - Aderezos
   - Tiempo: 3-7 min

5. POSTRES 🍰
   - Postres
   - Helados
   - Tiempo: 2-5 min
```

### 3. Modelo de Datos

**Tabla:** `stations`

```prisma
model stations {
  id        String      @id @db.Uuid
  tenant_id String      @db.Uuid
  code      String      // Ej: "PARRILLA", "BAR", "COCINA"
  name      String      // Ej: "Parrilla Principal", "Bar"
  is_active Boolean     @default(true)
  printers  printers[]  // Impresoras asignadas
  terminals terminals[] // Terminales KDS asignadas

  @@unique([tenant_id, code])
}
```

**Relaciones:**
- Una estación puede tener múltiples impresoras
- Una estación puede tener múltiples terminales KDS
- Los productos tienen un campo `station` que indica a qué estación van

### 4. Flujo de Trabajo

```
MESERO TOMA PEDIDO
       ↓
[1/4 Pollo + Papas + Inca Kola]
       ↓
SISTEMA SEPARA POR ESTACIÓN
       ↓
┌──────────────┬──────────────┬──────────────┐
│  PARRILLA    │   COCINA     │     BAR      │
│  1/4 Pollo   │   Papas      │  Inca Kola   │
└──────────────┴──────────────┴──────────────┘
       ↓              ↓              ↓
   [PANTALLA]    [PANTALLA]    [PANTALLA]
```

### 5. Estados de Items en KDS

```
PENDING  → Item recién llegado (gris)
COOKING  → En preparación (verde)
READY    → Listo para servir (amarillo)
DONE     → Entregado (tachado)
VOIDED   → Cancelado (rojo)
```

### 6. Datos del Seed

Según `prisma/seed.ts`, se crean 5 estaciones:

```typescript
const stations = [
    { code: "PARRILLA", name: "Parrilla" },
    { code: "COCINA", name: "Cocina Caliente" },
    { code: "BAR", name: "Bar" },
    { code: "FRIOS", name: "Platos Fríos" },
    { code: "POSTRES", name: "Postres" },
];
```

### 7. Navegación Actual

En `AdminSidebar.tsx` línea 48:
```typescript
{ href: '/admin/estaciones', label: 'Estaciones KDS', icon: ChefHat, permission: 'manage_stations' },
```

**Problema:** La ruta existe en el menú pero la página no está implementada.

### 8. Funcionalidad Requerida

La página `/admin/estaciones` debe permitir:

1. **Listar estaciones** existentes
   - Nombre
   - Código
   - Estado (activa/inactiva)
   - Número de terminales asignadas
   - Número de impresoras asignadas

2. **Crear nueva estación**
   - Código único (ej: "PARRILLA")
   - Nombre descriptivo
   - Estado activo/inactivo

3. **Editar estación**
   - Cambiar nombre
   - Activar/desactivar

4. **Ver detalles**
   - Terminales asignadas
   - Impresoras asignadas
   - Productos que van a esa estación

5. **No eliminar** (soft delete con is_active)
   - Las estaciones tienen relaciones con productos históricos
   - Solo desactivar

### 9. API Endpoint Necesario

**Ruta:** `/api/admin/stations`

**Métodos:**
- `GET` - Listar estaciones (con paginación)
- `POST` - Crear estación
- `PUT /:id` - Actualizar estación
- `DELETE /:id` - Desactivar estación (soft delete)

**Respuesta GET:**
```json
{
  "items": [
    {
      "id": "uuid",
      "code": "PARRILLA",
      "name": "Parrilla Principal",
      "is_active": true,
      "terminals_count": 2,
      "printers_count": 1,
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 5,
    "totalPages": 1
  }
}
```

### 10. Validaciones

1. **Código único** por tenant
2. **Código en mayúsculas** sin espacios (ej: "PARRILLA", no "parrilla")
3. **Nombre requerido** (mínimo 3 caracteres)
4. **No eliminar si tiene terminales activas** asignadas
5. **No eliminar si tiene productos** que referencian esa estación

### 11. Permisos

Según el sidebar, requiere permiso: `manage_stations`

Roles con acceso:
- OWNER
- ADMIN
- MANAGER

### 12. UX Considerations

1. **Iconos por tipo de estación:**
   - PARRILLA: 🔥 Flame
   - COCINA: 🍳 ChefHat
   - BAR: 🍺 Beer
   - FRIOS: ❄️ Snowflake
   - POSTRES: 🍰 Cake

2. **Colores por estado:**
   - Activa: Verde
   - Inactiva: Gris

3. **Badges:**
   - Número de terminales
   - Número de impresoras
   - Número de productos

4. **Acciones:**
   - Editar (siempre disponible)
   - Activar/Desactivar (toggle)
   - Ver detalles (modal o página)

### 13. Integración con KDS

Las estaciones se usan en:

1. **Productos** (`products.station`)
   - Cada producto tiene asignada una estación
   - Determina a qué pantalla KDS va el item

2. **Terminales** (`terminals.station_id`)
   - Cada terminal KDS está asignada a una estación
   - Muestra solo los items de esa estación

3. **Impresoras** (`printers.station_code`)
   - Cada impresora está asignada a una estación
   - Imprime comandas de esa estación

4. **Orders** (`orders.stations_active`)
   - Array de códigos de estaciones con items pendientes
   - Permite queries rápidas: "¿qué órdenes tiene la parrilla?"

### 14. Queries Comunes

```sql
-- Estaciones con más carga
SELECT station, COUNT(*) as pending_items
FROM orders, jsonb_array_elements(items) as item
WHERE item->>'status' IN ('PENDING', 'COOKING')
GROUP BY station
ORDER BY pending_items DESC;

-- Tiempo promedio por estación
SELECT station, AVG(ready_at - created_at) as avg_time
FROM orders, jsonb_array_elements(items) as item
WHERE item->>'status' = 'READY'
GROUP BY station;

-- Productos por estación
SELECT station, COUNT(*) as products_count
FROM products
WHERE is_active = true
GROUP BY station;
```

### 15. Problemas Actuales del Sistema

Según `FLUJO_KDS.md`:

1. **Performance crítico:** El KDS actual carga TODOS los eventos ORDER y hace replay completo
2. **Estaciones hardcodeadas:** `const STATIONS = ["All", "Cocina", "Parrilla", "Bar"]`
3. **Falta "Freidora" y "Cocina Fría"** en el código actual
4. **No hay gestión de estaciones** en el admin panel

### 16. Prioridad de Implementación

**P0 - CRÍTICO:**
- ✅ Crear página `/admin/estaciones`
- ✅ Crear API `/api/admin/stations`
- ✅ CRUD completo de estaciones
- ✅ Listar estaciones existentes del seed

**P1 - IMPORTANTE:**
- Asignar terminales a estaciones
- Asignar impresoras a estaciones
- Ver productos por estación
- Métricas de carga por estación

**P2 - MEJORAS:**
- Reordenar estaciones (sort_order)
- Configurar colores personalizados
- Configurar tiempos estimados
- Dashboard de performance por estación

## Conclusión

Las Estaciones KDS son un componente **CRÍTICO** del sistema POS para pollerías. Permiten:
- Organizar el trabajo de cocina
- Mostrar pedidos en pantallas específicas
- Medir tiempos de preparación
- Coordinar entre áreas

La página `/admin/estaciones` debe implementarse como **PRIORIDAD P0** para permitir la gestión de estas estaciones desde el panel de administración.

## Próximos Pasos

1. Crear API endpoint `/api/admin/stations`
2. Crear página `/admin/estaciones/page.tsx`
3. Implementar CRUD completo
4. Agregar validaciones
5. Probar con datos del seed
