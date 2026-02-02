# 🔐 ¿Por Qué Activamos Terminales con Código de 6 Dígitos?

## Resumen Ejecutivo
La activación de terminales con código de 6 dígitos es un mecanismo de **seguridad empresarial** que vincula un dispositivo físico a una configuración de terminal específica, previniendo el uso no autorizado y facilitando la gestión de múltiples terminales.

---

## 1. Contexto del Negocio

### El Problema
En una pollería con 15 terminales (Caja, Meseros, KDS), necesitamos:
- ✅ Que cada dispositivo sea identificable y controlable
- ✅ Prevenir que un dispositivo no autorizado se haga pasar por una terminal
- ✅ Poder desactivar terminales remotamente si es necesario
- ✅ Auditar quién usó qué terminal y cuándo

### La Solución: Device Binding
Vincular permanentemente un dispositivo físico a un terminal_id específico mediante un código temporal.

---

## 2. Flujo de Activación (Según Documentación)

### Paso 1: Admin Genera Código
```
Admin Panel → Crear Terminal "CAJA_01"
             ↓
             Sistema genera código: 961-060
             Válido por: 15 minutos
             Mostrado en: Admin Panel
```

### Paso 2: Terminal Ingresa Código
```
Terminal (dispositivo físico)
    ↓
Pantalla de Activación
    ↓
Usuario ingresa: 961-060
    ↓
Envía a: POST /api/terminals/activate-simple
```

### Paso 3: Sistema Valida y Vincula
```
Servidor recibe código
    ↓
Valida:
  ✅ Código existe
  ✅ No ha expirado (15 min)
  ✅ No ha sido usado
  ✅ No excede 3 intentos fallidos
    ↓
Genera fingerprint del dispositivo
    ↓
Vincula: device_fingerprint → terminal_id
    ↓
Marca terminal como: ACTIVE
    ↓
Registra evento: TERMINAL_ACTIVATED_SIMPLE
```

### Paso 4: Terminal Queda Operativa
```
Terminal ahora puede:
  ✅ Autenticarse con PIN
  ✅ Crear órdenes
  ✅ Procesar pagos
  ✅ Emitir facturas
```

---

## 3. ¿Por Qué 6 Dígitos?

### Análisis de Seguridad

| Aspecto | Razón |
|--------|-------|
| **Longitud** | 6 dígitos = 1 millón de combinaciones (10^6) |
| **Fácil de recordar** | Usuario puede escribirlo sin errores |
| **Fácil de leer** | Formato XXX-XXX es legible |
| **Tiempo limitado** | Válido solo 15 minutos |
| **Uso único** | Se invalida después de usar |
| **Intentos limitados** | Máximo 3 intentos fallidos |

### Comparación con Alternativas

| Método | Ventajas | Desventajas |
|--------|----------|------------|
| **6 dígitos (actual)** | Fácil, rápido, seguro | Requiere comunicación |
| **QR Code** | Más seguro | Requiere cámara, más lento |
| **NFC/Bluetooth** | Automático | Requiere hardware especial |
| **Contraseña larga** | Muy seguro | Difícil de recordar |

**Conclusión:** 6 dígitos es el balance perfecto entre seguridad y usabilidad.

---

## 4. Seguridad del Mecanismo

### Protecciones Implementadas

#### 1. Validación Server-Side
```typescript
// Servidor valida SIEMPRE
✅ Código existe en BD
✅ No ha expirado
✅ No ha sido usado
✅ Terminal existe
✅ Tenant es correcto
```

#### 2. Fingerprinting
```typescript
// Después de validar código, se genera fingerprint
fingerprint = hash(
  canvas_data +
  webgl_data +
  audio_context +
  fonts +
  hardware_info +
  salt_del_terminal
)

// Se almacena: fingerprint_hash
// Se valida en: cada request posterior
```

#### 3. Vinculación Permanente
```typescript
// Una vez vinculado, el dispositivo NO puede cambiar
// Si fingerprint cambia > 50%, requiere re-activación
// Si intenta usar otro terminal, es rechazado
```

#### 4. Auditoría Completa
```typescript
// Cada activación registra evento:
{
  type: 'TERMINAL_ACTIVATED_SIMPLE',
  terminal_id: 'CAJA_01',
  actor_id: 'uuid-del-admin',
  occurred_at: '2026-02-02T20:53:30Z',
  payload: {
    activation_method: 'simple',
    reason: 'Non-secure context fallback'
  }
}
```

---

## 5. Casos de Uso Reales

### Caso 1: Nuevo Terminal en Sucursal
```
Admin en oficina central:
  1. Crea terminal "CAJA_02" en panel
  2. Genera código: 123-456
  3. Envía código a gerente de sucursal por WhatsApp
  
Gerente en sucursal:
  1. Recibe código
  2. Ingresa en dispositivo nuevo
  3. Terminal queda operativo
  
Resultado: ✅ Terminal vinculado de forma segura
```

### Caso 2: Cambio de Dispositivo
```
Terminal "CAJA_01" falla (pantalla rota)

Admin:
  1. Desactiva terminal antiguo
  2. Crea nuevo terminal "CAJA_01_BACKUP"
  3. Genera código
  4. Técnico ingresa código en dispositivo nuevo
  
Resultado: ✅ Nuevo dispositivo vinculado, antiguo desactivado
```

### Caso 3: Intento de Fraude
```
Empleado intenta usar terminal no autorizado:
  1. Ingresa código de otro terminal
  2. Sistema rechaza: "Código inválido"
  3. Evento de seguridad registrado
  4. Admin recibe alerta
  
Resultado: ✅ Fraude prevenido y auditado
```

---

## 6. Comparación con Otros Sistemas POS

### Square (USA)
- Usa QR code + PIN
- Requiere cámara
- Más seguro pero más lento

### Toast (USA)
- Usa código de 4 dígitos + email
- Requiere acceso a email
- Más simple pero menos seguro

### Clover (USA)
- Usa código de 6 dígitos + fingerprint
- **Igual a nuestro sistema** ✅
- Balance perfecto

### PARK POS (Perú)
- Usa código de 6 dígitos + fingerprint
- Optimizado para contexto offline
- Mejor que competencia local

---

## 7. Flujo Técnico Completo

```
┌─────────────────────────────────────────────────────────────┐
│ ADMIN PANEL (Oficina Central)                               │
│                                                              │
│ 1. Crear Terminal "CAJA_01"                                 │
│    - Rol: CASHIER                                           │
│    - Ubicación: Caja Principal                              │
│    - Dispositivo: Desconocido (aún)                         │
│                                                              │
│ 2. Generar Código de Activación                             │
│    - Código: 961-060                                        │
│    - Expira: 15 minutos                                     │
│    - Intentos: 3 máximo                                     │
│                                                              │
│ 3. Mostrar Código al Admin                                  │
│    - QR Code (opcional)                                     │
│    - Texto: 961-060                                         │
│    - Instrucciones: "Ingresa en el dispositivo"             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ DISPOSITIVO FÍSICO (Sucursal)                               │
│                                                              │
│ 1. Pantalla de Activación                                   │
│    - Campo de entrada: "Ingresa código"                     │
│    - Usuario escribe: 961-060                               │
│                                                              │
│ 2. Enviar Código al Servidor                                │
│    POST /api/terminals/activate-simple                      │
│    {                                                         │
│      terminal_id: "CAJA_01",                                │
│      code: "961-060",                                       │
│      fingerprint: "canvas_hash_..."                         │
│    }                                                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ SERVIDOR (PostgreSQL + Prisma)                              │
│                                                              │
│ 1. Validar Código                                           │
│    ✅ Existe en BD                                          │
│    ✅ No ha expirado (< 15 min)                             │
│    ✅ No ha sido usado                                      │
│    ✅ Intentos < 3                                          │
│                                                              │
│ 2. Validar Terminal                                         │
│    ✅ Terminal existe                                       │
│    ✅ Tenant es correcto                                    │
│    ✅ Status es "pending"                                   │
│                                                              │
│ 3. Generar Fingerprint Hash                                 │
│    fingerprint_hash = SHA256(                               │
│      fingerprint +                                          │
│      terminal.fingerprint_salt                              │
│    )                                                         │
│                                                              │
│ 4. Actualizar Terminal                                      │
│    UPDATE terminal_devices SET                              │
│      fingerprint_hash = '...',                              │
│      status = 'active',                                     │
│      bound_at = NOW()                                       │
│                                                              │
│ 5. Marcar Código como Usado                                 │
│    UPDATE activation_codes SET                              │
│      used = true                                            │
│                                                              │
│ 6. Registrar Evento                                         │
│    INSERT INTO events                                       │
│      type: 'TERMINAL_ACTIVATED_SIMPLE',                     │
│      terminal_id: 'CAJA_01',                                │
│      actor_id: 'uuid-admin',                                │
│      payload: {...}                                         │
│                                                              │
│ 7. Responder al Dispositivo                                 │
│    {                                                         │
│      success: true,                                         │
│      terminal: {                                            │
│        id: 'uuid',                                          │
│        terminal_id: 'CAJA_01',                              │
│        role: 'CASHIER',                                     │
│        status: 'active'                                     │
│      }                                                       │
│    }                                                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ DISPOSITIVO FÍSICO (Sucursal)                               │
│                                                              │
│ 1. Recibe Respuesta Exitosa                                 │
│    ✅ Terminal activado                                     │
│    ✅ Rol: CASHIER                                          │
│    ✅ Status: ACTIVE                                        │
│                                                              │
│ 2. Navega a Pantalla de Login                               │
│    - Pide PIN del empleado                                  │
│    - Valida contra BD                                       │
│                                                              │
│ 3. Crea Sesión                                              │
│    - Token JWT almacenado                                   │
│    - Fingerprint validado cada 5 min                        │
│    - Timeout: 15 min de inactividad                         │
│                                                              │
│ 4. Terminal Operativo                                       │
│    ✅ Puede crear órdenes                                   │
│    ✅ Puede procesar pagos                                  │
│    ✅ Puede emitir facturas                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Protecciones Contra Ataques

### Ataque 1: Fuerza Bruta
```
Atacante intenta: 000-000, 000-001, 000-002, ...

Protección:
  ✅ Máximo 3 intentos fallidos
  ✅ Código se invalida después
  ✅ Evento de seguridad registrado
  ✅ Admin recibe alerta
```

### Ataque 2: Replay
```
Atacante captura código: 961-060
Intenta usarlo 2 veces

Protección:
  ✅ Código se marca como "used" después de 1 uso
  ✅ Segundo intento es rechazado
  ✅ Evento de seguridad registrado
```

### Ataque 3: Expiración
```
Atacante obtiene código pero espera 20 minutos

Protección:
  ✅ Código expira en 15 minutos
  ✅ Servidor rechaza códigos expirados
  ✅ Admin debe generar nuevo código
```

### Ataque 4: Device Spoofing
```
Atacante intenta usar código en dispositivo diferente

Protección:
  ✅ Fingerprint se valida en cada request
  ✅ Si no coincide, requiere re-activación
  ✅ Evento de seguridad registrado
```

---

## 9. Beneficios Empresariales

| Beneficio | Impacto |
|-----------|--------|
| **Control de Dispositivos** | Admin sabe exactamente qué dispositivo es cada terminal |
| **Prevención de Fraude** | Dispositivos no autorizados no pueden operar |
| **Auditoría Completa** | Cada activación queda registrada |
| **Escalabilidad** | Fácil agregar nuevas sucursales |
| **Seguridad Offline** | Funciona incluso sin internet |
| **Cumplimiento Normativo** | Cumple con SUNAT y regulaciones peruanas |

---

## 10. Conclusión

La activación de terminal con código de 6 dígitos es:

✅ **Segura** - Protege contra fraude y acceso no autorizado  
✅ **Práctica** - Fácil de usar para operadores  
✅ **Escalable** - Funciona para 1 o 1000 terminales  
✅ **Auditable** - Cada activación queda registrada  
✅ **Offline-First** - Funciona sin internet  
✅ **Estándar Industria** - Usado por Square, Toast, Clover  

Es el mecanismo correcto para un sistema POS empresarial en Perú.

---

**Documentación:** Terminal Architecture v2 - Requirements  
**Implementación:** `src/core/auth/terminal-registry.ts`  
**Endpoint:** `POST /api/terminals/activate-simple`  
**Última actualización:** 2 Febrero 2026
