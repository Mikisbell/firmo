# 👔 FLUJO DE ADMINISTRACIÓN — Diseño Completo

> **Documento:** Panel de administración (NO existe actualmente)  
> **Fecha:** Enero 2026  
> **Estado:** Diseño desde cero — No hay código de admin

---

## 📋 ÍNDICE

1. [Contexto del Negocio](#contexto-del-negocio)
2. [Roles de Administración](#roles-de-administración)
3. [Módulos del Panel](#módulos-del-panel)
4. [Escenarios Reales](#escenarios-reales)
5. [Diseño de UI](#diseño-de-ui)
6. [Implementación](#implementación)

---

## CONTEXTO DEL NEGOCIO

### ¿Quién usa el Panel de Admin?

```
USUARIOS DEL PANEL:

1. DUEÑO/GERENTE GENERAL
   - Ve todo
   - Configura todo
   - Accede desde cualquier lugar
   - Toma decisiones estratégicas

2. ADMINISTRADOR DE LOCAL
   - Gestiona día a día
   - Autoriza descuentos/devoluciones
   - Supervisa cajeros y meseros
   - Cierra el día

3. SUPERVISOR DE TURNO
   - Autoriza operaciones especiales
   - Resuelve problemas operativos
   - No configura sistema

4. CONTADOR (Externo)
   - Solo ve reportes fiscales
   - Exporta datos para contabilidad
   - Acceso limitado
```

### Necesidades por Rol

| Necesidad | Dueño | Admin | Supervisor | Contador |
|-----------|-------|-------|------------|----------|
| Dashboard ventas | ✅ | ✅ | ✅ | ❌ |
| Reportes detallados | ✅ | ✅ | ❌ | ✅ |
| Gestión usuarios | ✅ | ✅ | ❌ | ❌ |
| Gestión terminales | ✅ | ✅ | ❌ | ❌ |
| Configuración fiscal | ✅ | ❌ | ❌ | ❌ |
| Gestión catálogo | ✅ | ✅ | ❌ | ❌ |
| Autorizar descuentos | ✅ | ✅ | ✅ | ❌ |
| Autorizar devoluciones | ✅ | ✅ | ✅ | ❌ |
| Ver auditoría | ✅ | ✅ | ❌ | ❌ |
| Exportar datos | ✅ | ✅ | ❌ | ✅ |

---

## ROLES DE ADMINISTRACIÓN

### Jerarquía de Permisos

```
┌─────────────────────────────────────────────────────────────────┐
│                      OWNER (Dueño)                              │
│  - Todo acceso                                                  │
│  - Configuración de negocio                                     │
│  - Gestión de admins                                            │
├─────────────────────────────────────────────────────────────────┤
│                      ADMIN (Administrador)                      │
│  - Gestión operativa                                            │
│  - Usuarios y terminales                                        │
│  - Reportes completos                                           │
├─────────────────────────────────────────────────────────────────┤
│                    SUPERVISOR                                   │
│  - Autorizaciones                                               │
│  - Dashboard básico                                             │
│  - Sin configuración                                            │
├─────────────────────────────────────────────────────────────────┤
│                    ACCOUNTANT (Contador)                        │
│  - Solo reportes fiscales                                       │
│  - Solo lectura                                                 │
│  - Sin operaciones                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Definición de Roles

```typescript
type AdminRole = "OWNER" | "ADMIN" | "SUPERVISOR" | "ACCOUNTANT";

interface AdminPermissions {
  // Dashboard
  view_dashboard: boolean;
  view_realtime: boolean;
  
  // Reportes
  view_sales_reports: boolean;
  view_fiscal_reports: boolean;
  export_reports: boolean;
  
  // Usuarios
  manage_users: boolean;
  create_admin: boolean;
  reset_pins: boolean;
  
  // Terminales
  manage_terminals: boolean;
  register_terminal: boolean;
  deactivate_terminal: boolean;
  
  // Catálogo
  manage_catalog: boolean;
  manage_prices: boolean;
  manage_promotions: boolean;
  
  // Operaciones
  authorize_discounts: boolean;
  authorize_refunds: boolean;
  authorize_voids: boolean;
  
  // Configuración
  manage_tenant_config: boolean;
  manage_fiscal_config: boolean;
  manage_integrations: boolean;
  
  // Auditoría
  view_audit_logs: boolean;
  view_security_logs: boolean;
}

const ROLE_PERMISSIONS: Record<AdminRole, AdminPermissions> = {
  OWNER: {
    view_dashboard: true,
    view_realtime: true,
    view_sales_reports: true,
    view_fiscal_reports: true,
    export_reports: true,
    manage_users: true,
    create_admin: true,
    reset_pins: true,
    manage_terminals: true,
    register_terminal: true,
    deactivate_terminal: true,
    manage_catalog: true,
    manage_prices: true,
    manage_promotions: true,
    authorize_discounts: true,
    authorize_refunds: true,
    authorize_voids: true,
    manage_tenant_config: true,
    manage_fiscal_config: true,
    manage_integrations: true,
    view_audit_logs: true,
    view_security_logs: true,
  },
  ADMIN: {
    view_dashboard: true,
    view_realtime: true,
    view_sales_reports: true,
    view_fiscal_reports: true,
    export_reports: true,
    manage_users: true,
    create_admin: false,  // No puede crear otros admins
    reset_pins: true,
    manage_terminals: true,
    register_terminal: true,
    deactivate_terminal: true,
    manage_catalog: true,
    manage_prices: true,
    manage_promotions: true,
    authorize_discounts: true,
    authorize_refunds: true,
    authorize_voids: true,
    manage_tenant_config: false,  // No puede cambiar config de negocio
    manage_fiscal_config: false,
    manage_integrations: false,
    view_audit_logs: true,
    view_security_logs: false,
  },
  SUPERVISOR: {
    view_dashboard: true,
    view_realtime: true,
    view_sales_reports: false,
    view_fiscal_reports: false,
    export_reports: false,
    manage_users: false,
    create_admin: false,
    reset_pins: false,
    manage_terminals: false,
    register_terminal: false,
    deactivate_terminal: false,
    manage_catalog: false,
    manage_prices: false,
    manage_promotions: false,
    authorize_discounts: true,
    authorize_refunds: true,
    authorize_voids: true,
    manage_tenant_config: false,
    manage_fiscal_config: false,
    manage_integrations: false,
    view_audit_logs: false,
    view_security_logs: false,
  },
  ACCOUNTANT: {
    view_dashboard: false,
    view_realtime: false,
    view_sales_reports: false,
    view_fiscal_reports: true,
    export_reports: true,
    manage_users: false,
    create_admin: false,
    reset_pins: false,
    manage_terminals: false,
    register_terminal: false,
    deactivate_terminal: false,
    manage_catalog: false,
    manage_prices: false,
    manage_promotions: false,
    authorize_discounts: false,
    authorize_refunds: false,
    authorize_voids: false,
    manage_tenant_config: false,
    manage_fiscal_config: false,
    manage_integrations: false,
    view_audit_logs: false,
    view_security_logs: false,
  },
};
```

---

## MÓDULOS DEL PANEL

### Estructura de Navegación

```
/admin
├── /dashboard              # Vista general
├── /ventas                 # Reportes de ventas
│   ├── /diario
│   ├── /semanal
│   ├── /mensual
│   └── /personalizado
├── /productos              # Gestión de catálogo
│   ├── /lista
│   ├── /categorias
│   ├── /precios
│   └── /agotados
├── /promociones            # Gestión de promociones
│   ├── /activas
│   ├── /programadas
│   └── /historial
├── /usuarios               # Gestión de personal
│   ├── /lista
│   ├── /roles
│   └── /turnos
├── /terminales             # Gestión de dispositivos
│   ├── /lista
│   ├── /registrar
│   └── /rangos
├── /operaciones            # Autorizaciones pendientes
│   ├── /descuentos
│   ├── /devoluciones
│   └── /anulaciones
├── /fiscal                 # Reportes SUNAT
│   ├── /boletas
│   ├── /facturas
│   ├── /notas-credito
│   └── /resumen-igv
├── /configuracion          # Ajustes del sistema
│   ├── /negocio
│   ├── /fiscal
│   ├── /impresoras
│   └── /integraciones
├── /auditoria              # Logs y seguridad
│   ├── /eventos
│   ├── /accesos
│   └── /cambios
└── /soporte                # Ayuda y diagnóstico
    ├── /sync-status
    ├── /logs
    └── /contacto
```


### Módulo 1: Dashboard

```
PROPÓSITO: Vista rápida del estado del negocio

MÉTRICAS EN TIEMPO REAL:
- Ventas del día (actualiza cada minuto)
- Órdenes activas
- Mesas ocupadas
- Terminales online/offline

MÉTRICAS DEL DÍA:
- Ventas totales vs ayer vs semana pasada
- Ticket promedio
- Productos más vendidos
- Métodos de pago

ALERTAS:
- Descuadres de caja
- Terminales offline
- Productos agotados
- Autorizaciones pendientes
```

### Módulo 2: Gestión de Usuarios

```
FUNCIONALIDADES:
- Listar todos los usuarios
- Crear nuevo usuario
- Editar usuario existente
- Desactivar usuario
- Resetear PIN
- Asignar rol
- Asignar zona (meseros)
- Ver historial de actividad

CAMPOS DE USUARIO:
- Nombre completo
- Email (opcional)
- Teléfono (opcional)
- PIN (4-6 dígitos)
- Rol (CASHIER, WAITER, COOK, SUPERVISOR, ADMIN)
- Zona asignada (para meseros)
- Estado (activo/inactivo)
- Fecha de ingreso
```

### Módulo 3: Gestión de Terminales

```
FUNCIONALIDADES:
- Listar terminales registrados
- Ver estado (online/offline/último uso)
- Generar código de activación
- Desactivar terminal
- Asignar rango de números
- Ver eventos del terminal
- Forzar sincronización

TIPOS DE TERMINAL:
- POS (Caja)
- KDS (Cocina/Bar)
- WAITER (Mesero)
- ADMIN (Administración)
```

### Módulo 4: Gestión de Catálogo

```
FUNCIONALIDADES:
- Listar productos
- Crear/editar producto
- Gestionar categorías
- Cambiar precios
- Marcar agotado
- Gestionar modificadores
- Importar/exportar catálogo

CAMPOS DE PRODUCTO:
- Nombre
- SKU
- Categoría
- Precio (en centavos)
- Estación (PARRILLA, FREIDORA, BAR, etc.)
- Imagen (opcional)
- Descripción
- Estado (activo/agotado/descontinuado)
```

### Módulo 5: Operaciones Pendientes

```
FUNCIONALIDADES:
- Ver descuentos pendientes de autorización
- Ver devoluciones pendientes
- Ver anulaciones pendientes
- Aprobar/rechazar con un click
- Ver historial de autorizaciones

INFORMACIÓN POR SOLICITUD:
- Quién solicitó
- Cuándo
- Monto
- Motivo
- Orden relacionada
```

### Módulo 6: Reportes Fiscales

```
FUNCIONALIDADES:
- Listar boletas emitidas
- Listar facturas emitidas
- Listar notas de crédito
- Resumen de IGV
- Exportar para SUNAT
- Reenviar a SUNAT (si falló)

FILTROS:
- Por fecha/rango
- Por tipo de documento
- Por estado (emitido/anulado)
- Por monto
```

### Módulo 7: Configuración

```
SECCIONES:

7.1 DATOS DEL NEGOCIO:
- Nombre comercial
- RUC
- Razón social
- Dirección
- Logo
- Horario de atención

7.2 CONFIGURACIÓN FISCAL:
- Tasa de IGV
- Series de boletas/facturas
- Certificado SUNAT
- Modo de facturación

7.3 IMPRESORAS:
- Impresora de tickets
- Impresora de cocina
- Impresora de bar

7.4 INTEGRACIONES:
- Yape Business
- Plin
- Delivery (Rappi, PedidosYa)
```

### Módulo 8: Auditoría

```
FUNCIONALIDADES:
- Ver todos los eventos del sistema
- Filtrar por tipo/usuario/fecha
- Ver cambios de configuración
- Ver accesos al sistema
- Ver intentos fallidos
- Exportar logs

EVENTOS AUDITADOS:
- Login/logout
- Cambios de precio
- Descuentos aplicados
- Devoluciones
- Anulaciones
- Cambios de configuración
- Errores de sync
```

---

## ESCENARIOS REALES

### ESCENARIO A1: Dueño Revisa Ventas desde Casa

```
SITUACIÓN:
- Son las 10 PM
- Dueño está en casa
- Quiere ver cómo va el día

FLUJO ESPERADO:
1. Dueño abre app/web en celular
2. Login con email + contraseña
3. Dashboard muestra:
   - Ventas hoy: S/ 4,850
   - vs ayer: +12%
   - Órdenes: 98
   - Ticket promedio: S/ 49.49
4. Dueño ve gráfico de ventas por hora
5. Ve que 8-9 PM fue el pico
6. Ve top 5 productos del día
7. Ve que no hay alertas

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO A2: Admin Autoriza Descuento Grande

```
SITUACIÓN:
- Cajero quiere dar 30% de descuento
- Requiere autorización de Admin

FLUJO ESPERADO:
1. Cajero aplica 30% en POS
2. Sistema detecta: > 20%, requiere auth
3. Admin recibe notificación push:
   🔔 "Descuento 30% pendiente - Mesa 12"
4. Admin abre panel en su tablet
5. Ve en "Operaciones Pendientes":
   - Orden #067
   - Mesa 12
   - Total: S/ 120
   - Descuento solicitado: 30% (S/ 36)
   - Solicitado por: María (Cajera)
   - Motivo: "Cliente frecuente"
6. Admin presiona "Aprobar"
7. Sistema notifica a Caja
8. Descuento se aplica

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO A3: Admin Registra Nuevo Mesero

```
SITUACIÓN:
- Contratan nuevo mesero: Juan
- Admin debe darle acceso

FLUJO ESPERADO:
1. Admin abre Panel → Usuarios → Nuevo
2. Completa formulario:
   - Nombre: Juan Pérez
   - Rol: Mesero
   - Zona: B (Mesas 9-16)
   - PIN: 5678
3. Sistema crea usuario
4. Admin genera código de activación para tablet
5. Juan activa su tablet con el código
6. Juan puede empezar a trabajar

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO A4: Admin Desactiva Terminal Perdido

```
SITUACIÓN:
- Tablet de mesero se perdió
- Debe desactivarse inmediatamente

FLUJO ESPERADO:
1. Admin abre Panel → Terminales
2. Busca "MESA-03" (tablet perdida)
3. Ve: Último uso hace 2 horas
4. Presiona "Desactivar"
5. Sistema:
   - Marca terminal como inactivo
   - Invalida sesiones
   - Bloquea sincronización
6. Si alguien intenta usar la tablet:
   - Muestra "Terminal desactivado"
   - No puede operar

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO A5: Admin Cambia Precio de Producto

```
SITUACIÓN:
- Sube el precio del pollo
- De S/ 32 a S/ 35

FLUJO ESPERADO:
1. Admin abre Panel → Productos
2. Busca "1/2 Pollo"
3. Edita precio: 3200 → 3500 centavos
4. Sistema pregunta:
   - ¿Aplicar inmediatamente?
   - ¿Programar para mañana?
5. Admin elige "Inmediatamente"
6. Sistema:
   - Actualiza precio en catálogo
   - Sincroniza a todos los terminales
   - Registra cambio en auditoría
7. Próximas órdenes usan nuevo precio

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO A6: Admin Marca Producto Agotado

```
SITUACIÓN:
- Se acabó la Chicha Morada
- No habrá más hoy

FLUJO ESPERADO:
1. Admin abre Panel → Productos → Agotados
2. Busca "Chicha Morada"
3. Presiona "Marcar Agotado"
4. Sistema:
   - Actualiza estado del producto
   - Notifica a todos los terminales
   - Meseros ven producto tachado
   - Caja no puede agregarlo
5. Mañana, Admin puede reactivar

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO A7: Admin Crea Promoción

```
SITUACIÓN:
- Viernes, quieren Happy Hour
- 20% en bebidas de 6-9 PM

FLUJO ESPERADO:
1. Admin abre Panel → Promociones → Nueva
2. Configura:
   - Nombre: "Happy Hour Viernes"
   - Tipo: Porcentaje
   - Valor: 20%
   - Aplica a: Categoría "Bebidas"
   - Días: Viernes
   - Horario: 18:00 - 21:00
   - Vigencia: Todos los viernes
3. Sistema guarda promoción
4. Viernes a las 6 PM:
   - Promoción se activa automáticamente
   - Bebidas tienen 20% descuento
   - UI muestra "🍺 Happy Hour"

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO A8: Contador Exporta Datos Fiscales

```
SITUACIÓN:
- Fin de mes
- Contador necesita datos para declaración

FLUJO ESPERADO:
1. Contador accede con su usuario
2. Solo ve módulo "Fiscal"
3. Selecciona mes: Enero 2026
4. Ve resumen:
   - Boletas: 2,850 (S/ 102,500)
   - Facturas: 120 (S/ 15,800)
   - NC: 10 (S/ 500)
   - IGV total: S/ 21,204
5. Presiona "Exportar Excel"
6. Descarga archivo con detalle
7. Importa a su sistema contable

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO A9: Admin Investiga Descuadre

```
SITUACIÓN:
- Cajero cerró turno con -S/ 50
- Admin debe investigar

FLUJO ESPERADO:
1. Admin abre Panel → Auditoría
2. Filtra por:
   - Usuario: María
   - Fecha: Hoy
   - Tipo: Pagos y cambios
3. Ve timeline de eventos:
   - 14:32 - Pago efectivo S/ 50, cambio S/ 8
   - 14:45 - Pago efectivo S/ 100, cambio S/ 32
   - 15:10 - Pago Yape S/ 45 (sin cambio)
   - ...
4. Detecta: A las 16:20, cambio de S/ 50 no registrado
5. Habla con María para aclarar

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO A10: Admin Configura Nuevo Local

```
SITUACIÓN:
- Abren segundo local
- Mismo dueño, diferente dirección

FLUJO ESPERADO:
1. Dueño accede como OWNER
2. Panel → Configuración → Locales → Nuevo
3. Configura:
   - Nombre: "Pollería El Sabrosón - Surco"
   - Dirección: Av. Surco 456
   - RUC: (mismo)
   - Serie de boletas: B002
4. Sistema crea nuevo tenant
5. Dueño puede:
   - Copiar catálogo del local 1
   - Crear usuarios nuevos
   - Registrar terminales
6. Dashboard muestra ambos locales

ESTADO ACTUAL: ❌ NO EXISTE (Multi-tenant básico)
```


---

## DISEÑO DE UI

### Layout Principal

```
┌─────────────────────────────────────────────────────────────────┐
│  🍗 PARK POS                              Admin: Carlos    [👤] │
├────────────┬────────────────────────────────────────────────────┤
│            │                                                    │
│  📊 Dashboard                                                   │
│            │  ┌─────────────────────────────────────────────┐  │
│  💰 Ventas │  │                                             │  │
│            │  │              CONTENIDO                      │  │
│  📦 Productos  │              PRINCIPAL                      │  │
│            │  │                                             │  │
│  🎁 Promociones │                                             │  │
│            │  │                                             │  │
│  👥 Usuarios│  │                                             │  │
│            │  │                                             │  │
│  📱 Terminales │                                             │  │
│            │  └─────────────────────────────────────────────┘  │
│  ⚡ Operaciones                                                 │
│            │                                                    │
│  📄 Fiscal │                                                    │
│            │                                                    │
│  ⚙️ Config │                                                    │
│            │                                                    │
│  📋 Auditoría                                                   │
│            │                                                    │
└────────────┴────────────────────────────────────────────────────┘
```

### Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 DASHBOARD                                    Hoy: 05/01/26  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────┐│
│  │ VENTAS HOY   │ │ ÓRDENES      │ │ TICKET PROM  │ │ MESAS   ││
│  │              │ │              │ │              │ │         ││
│  │  S/ 4,850    │ │     98       │ │   S/ 49.49   │ │  32/50  ││
│  │  ↑ 12%       │ │   ↑ 8%       │ │   ↑ 3%       │ │ ocupadas││
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────┘│
│                                                                 │
│  ┌─────────────────────────────────┐ ┌─────────────────────────┐│
│  │ VENTAS POR HORA                 │ │ TOP PRODUCTOS           ││
│  │                                 │ │                         ││
│  │     ▄▄                          │ │ 1. 1/2 Pollo    S/1,440 ││
│  │    ▄██▄    ▄▄                   │ │ 2. Pollo entero S/  696 ││
│  │   ▄████▄  ▄██▄                  │ │ 3. 1/4 Pollo    S/  684 ││
│  │  ▄██████▄▄████▄                 │ │ 4. Gaseosa 1.5L S/  416 ││
│  │ ▄████████████████               │ │ 5. Chicha       S/  175 ││
│  │ 11 12 13 14 15 16 17 18 19 20   │ │                         ││
│  └─────────────────────────────────┘ └─────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────┐ ┌─────────────────────────┐│
│  │ 🔔 ALERTAS                      │ │ MÉTODOS DE PAGO         ││
│  │                                 │ │                         ││
│  │ ⚠️ Descuadre Caja 1: -S/ 5     │ │ Efectivo  ████████ 55%  ││
│  │ ⚠️ Terminal MESA-02 offline    │ │ Yape      ████     25%  ││
│  │ ⚠️ Chicha Morada agotada       │ │ Plin      ██       10%  ││
│  │                                 │ │ Tarjeta   ██       10%  ││
│  └─────────────────────────────────┘ └─────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Gestión de Usuarios

```
┌─────────────────────────────────────────────────────────────────┐
│  👥 USUARIOS                                    [+ Nuevo Usuario]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔍 Buscar...                    Filtrar: [Todos ▼] [Activos ▼] │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Nombre          │ Rol        │ Zona    │ Estado  │ Acciones ││
│  ├─────────────────┼────────────┼─────────┼─────────┼──────────┤│
│  │ Carlos Admin    │ ADMIN      │ -       │ 🟢 Activo│ [✏️][🗑️]││
│  │ María García    │ CASHIER    │ Caja 1  │ 🟢 Activo│ [✏️][🗑️]││
│  │ Pedro López     │ CASHIER    │ Caja 2  │ 🟢 Activo│ [✏️][🗑️]││
│  │ Juan Pérez      │ WAITER     │ Zona A  │ 🟢 Activo│ [✏️][🗑️]││
│  │ Ana Torres      │ WAITER     │ Zona B  │ 🟢 Activo│ [✏️][🗑️]││
│  │ Luis Rojas      │ COOK       │ Parrilla│ 🟢 Activo│ [✏️][🗑️]││
│  │ Rosa Mendoza    │ COOK       │ Bar     │ 🟢 Activo│ [✏️][🗑️]││
│  │ Ex-empleado     │ WAITER     │ -       │ 🔴 Inact │ [✏️][🗑️]││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Mostrando 8 de 15 usuarios                    [< 1 2 >]        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Modal Nuevo Usuario

```
┌─────────────────────────────────────────────────────────────────┐
│  NUEVO USUARIO                                            [X]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Nombre completo *                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Email (opcional)                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Rol *                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Seleccionar...                                        ▼ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Zona (solo meseros)                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Seleccionar...                                        ▼ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  PIN de acceso *                                                │
│  ┌──────────┐  ┌──────────┐                                    │
│  │ ****     │  │ ****     │  (Confirmar)                       │
│  └──────────┘  └──────────┘                                    │
│                                                                 │
│                              [Cancelar]  [Crear Usuario]        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Gestión de Terminales

```
┌─────────────────────────────────────────────────────────────────┐
│  📱 TERMINALES                              [+ Registrar Terminal]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Terminal     │ Tipo   │ Rango      │ Último uso   │ Estado  ││
│  ├──────────────┼────────┼────────────┼──────────────┼─────────┤│
│  │ CAJA-01      │ POS    │ 1-999      │ Hace 2 min   │ 🟢 Online││
│  │ CAJA-02      │ POS    │ 1000-1999  │ Hace 5 min   │ 🟢 Online││
│  │ KDS-COCINA   │ KDS    │ -          │ Hace 1 min   │ 🟢 Online││
│  │ KDS-BAR      │ KDS    │ -          │ Hace 3 min   │ 🟢 Online││
│  │ MESA-01      │ WAITER │ 5000-5999  │ Hace 10 min  │ 🟡 Idle  ││
│  │ MESA-02      │ WAITER │ 6000-6999  │ Hace 2 días  │ 🔴 Offline││
│  │ MESA-03      │ WAITER │ 7000-7999  │ -            │ ⚫ Inactivo││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  CÓDIGOS DE ACTIVACIÓN PENDIENTES:                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Código          │ Para        │ Expira       │ Acción       ││
│  ├─────────────────┼─────────────┼──────────────┼──────────────┤│
│  │ A1B2-C3D4-E5F6  │ MESA-04     │ En 23 horas  │ [Cancelar]   ││
│  │ X9Y8-Z7W6-V5U4  │ KDS-FREIDORA│ En 12 horas  │ [Cancelar]   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Operaciones Pendientes

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚡ OPERACIONES PENDIENTES                          🔔 3 nuevas │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Descuentos (2)] [Devoluciones (1)] [Anulaciones (0)]          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🏷️ DESCUENTO - Hace 5 minutos                               ││
│  │                                                             ││
│  │ Orden: #067          Mesa: 12           Total: S/ 120.00    ││
│  │ Descuento: 30%       Monto: S/ 36.00                        ││
│  │ Solicitado por: María (Cajera)                              ││
│  │ Motivo: "Cliente frecuente - Don Carlos"                    ││
│  │                                                             ││
│  │                           [❌ Rechazar]  [✅ Aprobar]        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🏷️ DESCUENTO - Hace 12 minutos                              ││
│  │                                                             ││
│  │ Orden: #065          Mesa: 8            Total: S/ 85.00     ││
│  │ Descuento: 25%       Monto: S/ 21.25                        ││
│  │ Solicitado por: Pedro (Cajero)                              ││
│  │ Motivo: "Demora en atención"                                ││
│  │                                                             ││
│  │                           [❌ Rechazar]  [✅ Aprobar]        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## IMPLEMENTACIÓN

### Estructura de Archivos

```
src/app/admin/
├── layout.tsx                 # Layout con sidebar
├── page.tsx                   # Redirect a dashboard
├── dashboard/
│   └── page.tsx              # Dashboard principal
├── ventas/
│   ├── page.tsx              # Lista de reportes
│   ├── diario/page.tsx
│   ├── semanal/page.tsx
│   └── mensual/page.tsx
├── productos/
│   ├── page.tsx              # Lista de productos
│   ├── [id]/page.tsx         # Editar producto
│   └── nuevo/page.tsx        # Crear producto
├── usuarios/
│   ├── page.tsx              # Lista de usuarios
│   ├── [id]/page.tsx         # Editar usuario
│   └── nuevo/page.tsx        # Crear usuario
├── terminales/
│   ├── page.tsx              # Lista de terminales
│   └── registrar/page.tsx    # Registrar nuevo
├── operaciones/
│   └── page.tsx              # Pendientes de autorización
├── fiscal/
│   ├── page.tsx              # Resumen fiscal
│   ├── boletas/page.tsx
│   └── facturas/page.tsx
├── configuracion/
│   ├── page.tsx              # Config general
│   ├── negocio/page.tsx
│   └── fiscal/page.tsx
├── auditoria/
│   └── page.tsx              # Logs de auditoría
└── components/
    ├── AdminSidebar.tsx
    ├── AdminHeader.tsx
    ├── StatsCard.tsx
    ├── DataTable.tsx
    └── ...
```

### APIs Necesarias

```typescript
// Usuarios
GET    /api/admin/users
POST   /api/admin/users
GET    /api/admin/users/:id
PUT    /api/admin/users/:id
DELETE /api/admin/users/:id
POST   /api/admin/users/:id/reset-pin

// Terminales
GET    /api/admin/terminals
POST   /api/admin/terminals/activate
PUT    /api/admin/terminals/:id
DELETE /api/admin/terminals/:id
POST   /api/admin/terminals/:id/deactivate

// Productos
GET    /api/admin/products
POST   /api/admin/products
PUT    /api/admin/products/:id
POST   /api/admin/products/:id/out-of-stock

// Operaciones
GET    /api/admin/operations/pending
POST   /api/admin/operations/:id/approve
POST   /api/admin/operations/:id/reject

// Reportes
GET    /api/admin/reports/daily
GET    /api/admin/reports/weekly
GET    /api/admin/reports/monthly
GET    /api/admin/reports/fiscal

// Dashboard
GET    /api/admin/dashboard/stats
GET    /api/admin/dashboard/realtime

// Auditoría
GET    /api/admin/audit/logs
GET    /api/admin/audit/events
```

### Fases de Implementación

```
FASE 1: Estructura Base (8h)
- Layout con sidebar
- Autenticación admin
- Dashboard básico (stats estáticas)

FASE 2: Gestión de Usuarios (8h)
- CRUD de usuarios
- Asignación de roles
- Reset de PIN

FASE 3: Gestión de Terminales (6h)
- Lista de terminales
- Códigos de activación
- Desactivación

FASE 4: Dashboard en Tiempo Real (8h)
- Métricas en vivo
- Gráficos
- Alertas

FASE 5: Operaciones Pendientes (6h)
- Lista de pendientes
- Aprobar/rechazar
- Notificaciones

FASE 6: Reportes (12h)
- Reportes de ventas
- Reportes fiscales
- Exportación

FASE 7: Catálogo (8h)
- CRUD de productos
- Gestión de precios
- Productos agotados

FASE 8: Auditoría (6h)
- Logs de eventos
- Filtros
- Exportación
```

---

## PRIORIDADES

| # | Feature | Impacto | Esfuerzo | Prioridad |
|---|---------|---------|----------|-----------|
| 1 | Layout + Auth admin | Alto | 4h | 🔴 P0 |
| 2 | Dashboard básico | Alto | 4h | 🔴 P0 |
| 3 | Gestión usuarios | Alto | 8h | 🔴 P0 |
| 4 | Gestión terminales | Alto | 6h | 🔴 P0 |
| 5 | Operaciones pendientes | Alto | 6h | 🟡 P1 |
| 6 | Dashboard tiempo real | Medio | 8h | 🟡 P1 |
| 7 | Reportes de ventas | Medio | 8h | 🟡 P1 |
| 8 | Gestión catálogo | Medio | 8h | 🟡 P1 |
| 9 | Reportes fiscales | Alto | 8h | 🟡 P1 |
| 10 | Auditoría | Bajo | 6h | 🟢 P2 |
| 11 | Configuración avanzada | Bajo | 8h | 🟢 P2 |

---

**Documento creado:** Enero 2026
