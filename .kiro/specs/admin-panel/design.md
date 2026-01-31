# Documento de Diseño — Panel de Administración

## Resumen

Panel de administración centralizado para PARK POS que permite configurar productos, empleados, terminales, promociones, estaciones KDS y configuración del negocio. Implementado como aplicación Next.js con autenticación por PIN y permisos basados en roles.

**Documentación de referencia:**
- Diseño detallado UI: `docs/03-features/FLUJO_ADMIN.md`
- Configuración: `docs/03-features/FLUJO_CONFIGURACION.md`
- Empleados: `docs/03-features/FLUJO_EMPLEADOS_TURNOS.md`
- Reportes: `docs/03-features/FLUJO_REPORTES.md`

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                      /admin (Next.js)                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Dashboard  │  │  Productos  │  │  Empleados  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Terminales  │  │ Promociones │  │  Estaciones │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│  ┌─────────────┐  ┌─────────────┐                          │
│  │   Config    │  │  Reportes   │                          │
│  └─────────────┘  └─────────────┘                          │
├─────────────────────────────────────────────────────────────┤
│                    API Routes (/api/admin/*)                │
├─────────────────────────────────────────────────────────────┤
│                    Prisma + PostgreSQL                      │
└─────────────────────────────────────────────────────────────┘
```

## Componentes e Interfaces

### Estructura de Archivos

```
src/app/admin/
├── layout.tsx              # Layout con sidebar y auth
├── page.tsx                # Dashboard principal
├── productos/
│   ├── page.tsx            # Lista de productos
│   └── [id]/page.tsx       # Editar producto
├── empleados/
│   ├── page.tsx            # Lista de empleados
│   └── [id]/page.tsx       # Editar empleado
├── terminales/
│   └── page.tsx            # Lista y gestión de terminales
├── promociones/
│   └── page.tsx            # Lista y gestión de promociones
├── estaciones/
│   └── page.tsx            # Configuración de estaciones KDS
├── configuracion/
│   └── page.tsx            # Configuración del negocio
├── reportes/
│   └── page.tsx            # Reportes de ventas
└── components/
    ├── AdminSidebar.tsx    # Navegación lateral
    ├── AdminHeader.tsx     # Header con usuario y logout
    ├── StatsCard.tsx       # Tarjeta de métricas
    └── DataTable.tsx       # Tabla reutilizable
```

### Interfaces TypeScript

```typescript
// Permisos por rol
interface AdminPermissions {
  view_dashboard: boolean;
  manage_products: boolean;
  manage_employees: boolean;
  manage_terminals: boolean;
  manage_promotions: boolean;
  manage_stations: boolean;
  manage_config: boolean;
  manage_fiscal: boolean;  // Solo OWNER
  view_reports: boolean;
  view_audit: boolean;
}

type AdminRole = 'OWNER' | 'ADMIN' | 'MANAGER';

const ROLE_PERMISSIONS: Record<AdminRole, AdminPermissions> = {
  OWNER: {
    view_dashboard: true,
    manage_products: true,
    manage_employees: true,
    manage_terminals: true,
    manage_promotions: true,
    manage_stations: true,
    manage_config: true,
    manage_fiscal: true,
    view_reports: true,
    view_audit: true,
  },
  ADMIN: {
    view_dashboard: true,
    manage_products: true,
    manage_employees: true,
    manage_terminals: true,
    manage_promotions: true,
    manage_stations: true,
    manage_config: true,
    manage_fiscal: false,  // No puede configurar fiscal
    view_reports: true,
    view_audit: true,
  },
  MANAGER: {
    view_dashboard: true,
    manage_products: true,
    manage_employees: false,  // No puede gestionar empleados
    manage_terminals: false,  // No puede gestionar terminales
    manage_promotions: true,
    manage_stations: false,
    manage_config: false,
    manage_fiscal: false,
    view_reports: true,
    view_audit: false,
  },
};

// Producto
interface Product {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  short_name?: string;
  price_cents: number;  // Siempre entero
  category: string;
  station: StationType;
  type: 'SIMPLE' | 'COMBO';
  image_url?: string;
  is_active: boolean;
  version: number;
}

// Empleado
interface Employee {
  id: string;
  tenant_id: string;
  name: string;
  role: EmployeeRole;
  pin_hash: string;
  zone_id?: string;
  is_active: boolean;
}

type EmployeeRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'COOK' | 'DRIVER';

// Terminal
interface Terminal {
  id: string;
  tenant_id: string;
  terminal_id: string;
  name: string;
  type: 'POS' | 'KDS' | 'WAITER' | 'ADMIN';
  number_range_start: number;
  number_range_end: number;
  is_active: boolean;
  last_seen_at?: Date;
}

// Código de activación
interface ActivationCode {
  code: string;  // 12 caracteres
  terminal_name: string;
  terminal_type: string;
  expires_at: Date;  // 24 horas desde creación
}

// Promoción
interface Promotion {
  id: string;
  tenant_id: string;
  name: string;
  type: 'PERCENT' | 'FIXED' | 'HAPPY_HOUR' | '2X1' | 'COMBO';
  value: number;
  rules?: Record<string, unknown>;
  starts_at: Date;
  ends_at: Date;
  is_active: boolean;
}

// Estación KDS
type StationType = 'PARRILLA' | 'COCINA' | 'BAR' | 'HORNO' | 'POSTRES' | 'EMPAQUE';

interface Station {
  id: string;
  tenant_id: string;
  code: StationType;
  name: string;
  color: string;  // Hex color
  is_active: boolean;
}

// Configuración del tenant
interface TenantSettings {
  tenant_id: string;
  legal_name: string;
  ruc: string;  // 11 dígitos
  business_name: string;
  address?: string;
  logo_url?: string;
  timezone: string;
  currency: string;
  tax_rate: number;  // Solo editable por OWNER
}
```

## Modelos de Datos

Las tablas ya existen en el schema de Prisma (`prisma/schema.prisma`):
- `employees` - Empleados con roles y PINs
- `terminals` - Terminales registrados
- `products` - Catálogo de productos
- `catalog_meta` - Versión del catálogo
- `promotions` - Promociones activas
- `stations` - Estaciones KDS
- `tenant_settings` - Configuración del negocio
- `terminal_number_ranges` - Rangos de números por terminal

## Propiedades de Correctness

*Una propiedad es una característica o comportamiento que debe mantenerse verdadero en todas las ejecuciones válidas del sistema.*

### Property 1: Jerarquía de Permisos de Rol
*Para cualquier* rol R, los permisos de R deben ser un subconjunto de los permisos de roles superiores en la jerarquía (OWNER > ADMIN > MANAGER).
**Validates: Requirements 1.2, 1.4**

### Property 2: Filtro de Productos Retorna Resultados Correctos
*Para cualquier* combinación de filtros (categoría, estación, estado), todos los productos retornados deben cumplir con todos los criterios de filtro especificados.
**Validates: Requirements 3.1**

### Property 3: Versión de Catálogo Incrementa en Edición
*Para cualquier* edición de producto, la versión del catálogo (catalog_version) debe incrementar en exactamente 1.
**Validates: Requirements 3.3**

### Property 4: Precios Almacenados como Enteros
*Para cualquier* producto en el sistema, el campo price_cents debe ser un número entero no negativo.
**Validates: Requirements 3.4**

### Property 5: Unicidad de PIN dentro del Tenant
*Para cualquier* tenant, no deben existir dos empleados activos con el mismo PIN.
**Validates: Requirements 4.3**

### Property 6: Mínimo un OWNER/ADMIN debe Existir
*Para cualquier* tenant, siempre debe existir al menos un empleado activo con rol OWNER o ADMIN.
**Validates: Requirements 4.4**

### Property 7: Códigos de Activación Válidos
*Para cualquier* código de activación generado, debe tener exactamente 12 caracteres y una fecha de expiración de 24 horas desde su creación.
**Validates: Requirements 5.2**

### Property 8: Rangos de Números No Se Solapan
*Para cualquier* par de terminales activos en el mismo tenant, sus rangos de números (number_range_start, number_range_end) no deben solaparse.
**Validates: Requirements 5.4**

### Property 9: Promociones Expiradas Se Desactivan
*Para cualquier* promoción donde ends_at < fecha_actual, el campo is_active debe ser false.
**Validates: Requirements 6.3**

### Property 10: Validación de RUC
*Para cualquier* RUC almacenado en tenant_settings, debe tener exactamente 11 dígitos numéricos.
**Validates: Requirements 8.2**

### Property 11: Configuración Fiscal Restringida a OWNER
*Para cualquier* intento de modificar tax_rate o credenciales SUNAT, el actor debe tener rol OWNER.
**Validates: Requirements 8.3**

## Manejo de Errores

### Errores de Autenticación
- `INVALID_PIN`: PIN no encontrado o incorrecto
- `ACCOUNT_LOCKED`: Cuenta bloqueada por intentos fallidos
- `INSUFFICIENT_PERMISSIONS`: Rol no tiene permisos para la acción

### Errores de Validación
- `DUPLICATE_PIN`: PIN ya existe en el tenant
- `INVALID_RUC_FORMAT`: RUC no tiene 11 dígitos
- `LAST_ADMIN_DELETE`: No se puede eliminar el último OWNER/ADMIN
- `INVALID_PRICE`: Precio no es un entero positivo
- `OVERLAPPING_RANGE`: Rango de números se solapa con otro terminal

### Errores de Negocio
- `PRODUCT_NOT_FOUND`: Producto no existe
- `EMPLOYEE_NOT_FOUND`: Empleado no existe
- `TERMINAL_NOT_FOUND`: Terminal no existe
- `ACTIVATION_CODE_EXPIRED`: Código de activación expirado

## Estrategia de Testing

### Unit Tests
- Validación de permisos por rol
- Validación de formato de RUC
- Validación de PIN (4-6 dígitos)
- Cálculo de expiración de códigos de activación
- Detección de solapamiento de rangos

### Property-Based Tests
- **Framework:** fast-check (TypeScript)
- **Mínimo 100 iteraciones** por propiedad
- Cada test debe referenciar la propiedad del diseño

### Integration Tests
- CRUD de productos con incremento de versión
- CRUD de empleados con validación de unicidad de PIN
- Generación y uso de códigos de activación
- Asignación de rangos de números a terminales
- Desactivación automática de promociones expiradas
