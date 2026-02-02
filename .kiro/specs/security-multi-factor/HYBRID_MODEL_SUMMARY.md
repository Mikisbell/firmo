# Hybrid MAC Detection Model - Executive Summary

**Decision:** Opción 3 - Modelo Híbrido  
**Date:** February 2, 2026  
**Impact:** Escalable a todas las terminales existentes y futuras

---

## El Problema Que Resuelve

En una pollería con **15 terminales + 1 caja + KDS**, los empleados **rotan entre terminales**:

```
Escenario Real:
- Mesero Juan trabaja en Terminal 1 (MAC: AA:BB:CC:DD:EE:01)
- Mañana siguiente, Juan trabaja en Terminal 2 (MAC: AA:BB:CC:DD:EE:02)
- Mismo empleado, diferente MAC → ¿Requiere confirmación cada día?
```

**Respuesta del Modelo Híbrido:** NO. Permite rotación sin fricción.

---

## Cómo Funciona

### Dos Niveles de Seguridad

**Nivel 1: Dispositivo (MAC por Empleado)**
- Detecta si alguien roba el dispositivo del empleado
- Si MAC pertenece a otro empleado → BLOQUEADO

**Nivel 2: Terminal (MAC por Terminal)**
- Detecta si alguien intenta usar terminal ajena
- Si MAC nunca ha accedido a esta terminal → ALERTA (pero permite)
- Registra auditoría de qué MACs accedieron a qué terminales

### Ejemplo Visual

```
┌─────────────────────────────────────────────────────────┐
│ Empleado: Juan                                          │
│ MAC: AA:BB:CC:DD:EE:01                                  │
├─────────────────────────────────────────────────────────┤
│ Terminal 1 (CAJA_01)  → Registrada ✅                   │
│ Terminal 2 (CAJA_02)  → Primera vez ⚠️ (permite)        │
│ Terminal 3 (CAJA_03)  → Primera vez ⚠️ (permite)        │
│ Terminal 4 (CAJA_04)  → Primera vez ⚠️ (permite)        │
└─────────────────────────────────────────────────────────┘

Resultado: Juan puede rotar entre terminales SIN confirmación diaria
```

---

## Comparación de Modelos

### Modelo 1: MAC por Empleado (Simple)
```
✅ Detecta: Dispositivos robados
❌ No detecta: Acceso no autorizado a terminales
⚠️ Fricción: ALTA (confirmación cada terminal nueva)
```

### Modelo 2: MAC por Terminal (Alternativo)
```
✅ Detecta: Acceso no autorizado a terminales
❌ No detecta: Dispositivos robados
⚠️ Fricción: MEDIA (empleados pueden rotar)
```

### Modelo 3: Híbrido (ELEGIDO) ✅
```
✅ Detecta: Dispositivos robados + acceso no autorizado
✅ Permite: Rotación entre terminales sin fricción
✅ Escalable: A todas las terminales futuras
⚠️ Fricción: BAJA (solo confirmación para dispositivos nuevos)
```

---

## Escenarios Reales

### Escenario 1: Empleado Conocido, Terminal Conocida ✅

```
Juan intenta login en CAJA_01 (donde siempre trabaja)
MAC: AA:BB:CC:DD:EE:01 (registrada para Juan)

Validación:
1. ¿MAC conocida? SÍ ✅
2. ¿Pertenece a Juan? SÍ ✅
3. ¿Está bloqueada? NO ✅
4. ¿Terminal correcta? SÍ ✅

Resultado: ACCESO INMEDIATO (sin fricción)
```

### Escenario 2: Empleado Conocido, Terminal Nueva ⚠️

```
Juan intenta login en CAJA_02 (primera vez)
MAC: AA:BB:CC:DD:EE:01 (registrada para Juan)

Validación:
1. ¿MAC conocida? SÍ ✅
2. ¿Pertenece a Juan? SÍ ✅
3. ¿Está bloqueada? NO ✅
4. ¿Terminal correcta? NO (primera vez) ⚠️

Resultado: ACCESO PERMITIDO (con warning)
- Registra acceso en terminal_mac_registry
- Crea alerta de "DIFFERENT_TERMINAL"
- Admin puede revisar si es legítimo
- Juan NO necesita confirmación
```

### Escenario 3: MAC Desconocida ❌

```
Juan intenta login con dispositivo nuevo
MAC: XX:YY:ZZ:AA:BB:CC (desconocida)

Validación:
1. ¿MAC conocida? NO ❌

Resultado: REQUIERE CONFIRMACIÓN
- Genera código de confirmación
- Envía por email/SMS
- Juan confirma
- MAC se registra como TRUSTED
- Acceso permitido
```

### Escenario 4: MAC de Otro Empleado ❌

```
Juan intenta login con dispositivo de María
MAC: AA:BB:CC:DD:EE:02 (registrada para María)

Validación:
1. ¿MAC conocida? SÍ ✅
2. ¿Pertenece a Juan? NO ❌

Resultado: ACCESO DENEGADO
- Crea alerta de "DEVICE_MISMATCH"
- Admin investiga
- Posible robo de dispositivo
```

### Escenario 5: MAC Bloqueada ❌

```
Juan intenta login con dispositivo bloqueado
MAC: AA:BB:CC:DD:EE:01 (bloqueada por admin)

Validación:
1. ¿MAC conocida? SÍ ✅
2. ¿Pertenece a Juan? SÍ ✅
3. ¿Está bloqueada? SÍ ❌

Resultado: ACCESO DENEGADO
- Crea alerta de "BLOCKED_DEVICE"
- Admin debe desbloquear
```

---

## Beneficios del Modelo Híbrido

### Para Empleados
- ✅ **Sin fricción diaria** - Rotan entre terminales sin confirmación
- ✅ **Acceso rápido** - Login inmediato en terminales conocidas
- ✅ **Flexibilidad** - Pueden trabajar en cualquier terminal

### Para Administrador
- ✅ **Máxima seguridad** - Detecta dispositivos robados Y acceso no autorizado
- ✅ **Auditoría completa** - Sabe qué MAC accedió a qué terminal
- ✅ **Control granular** - Puede bloquear dispositivos específicos
- ✅ **Alertas inteligentes** - Solo alerta cuando es necesario

### Para el Negocio
- ✅ **Escalable** - Funciona con 15 terminales hoy, 100 mañana
- ✅ **Seguro** - Detecta fraude y robo de dispositivos
- ✅ **Eficiente** - Menos fricción = empleados más productivos
- ✅ **Profesional** - Alineado con estándares 2026

---

## Implementación

### Fase 1: Database (1 hora)
- Crear tabla `device_mac_addresses` (hybrid schema)
- Crear tabla `terminal_mac_registry` (auditoría)
- Crear índices

### Fase 2: Core Logic (2 horas)
- Implementar `validateMAC()` (hybrid check)
- Implementar `checkTerminalAuthorization()`
- Actualizar login endpoint

### Fase 3: Admin Panel (2 horas)
- Device management UI
- Terminal access audit view
- Block/unblock functionality

### Fase 4: Testing (1.5 horas)
- Unit tests para validación
- Integration tests para login
- E2E tests para todos los escenarios

**Total: ~6.5 horas** (vs 3 horas para modelo simple)

---

## Escalabilidad

### Hoy (15 terminales)
```
device_mac_addresses:
- 15 empleados × 1 MAC promedio = 15 registros
- Índices: (tenant_id, employee_id), (terminal_id), (trust_level)

terminal_mac_registry:
- 15 terminales × 15 empleados × 1 MAC = 225 registros
- Índices: (terminal_id, mac_address), (employee_id, terminal_id)
```

### Futuro (100 terminales)
```
device_mac_addresses:
- 100 empleados × 2 MACs promedio = 200 registros
- Mismo esquema, sin cambios

terminal_mac_registry:
- 100 terminales × 100 empleados × 2 MACs = 20,000 registros
- Índices siguen siendo eficientes
```

### Futuro Lejano (1000 terminales)
```
device_mac_addresses:
- 1000 empleados × 3 MACs promedio = 3,000 registros
- Mismo esquema, sin cambios

terminal_mac_registry:
- 1000 terminales × 1000 empleados × 3 MACs = 3,000,000 registros
- Índices siguen siendo eficientes (PostgreSQL maneja bien)
- Posible: Archivado de registros antiguos
```

---

## Decisión Final

**Modelo Elegido:** Híbrido (Opción 3)

**Razones:**
1. ✅ Detecta ambos escenarios de seguridad
2. ✅ Permite rotación sin fricción
3. ✅ Escalable a todas las terminales
4. ✅ Alineado con 2026 best practices
5. ✅ Profesional y robusto

**Próximo Paso:** Implementar Phase 1 (Database)

---

## Preguntas Frecuentes

### ¿Qué pasa si un empleado pierde su dispositivo?
Admin bloquea la MAC desde el panel. Empleado usa dispositivo nuevo y confirma.

### ¿Qué pasa si alguien roba un dispositivo?
Sistema detecta MAC de otro empleado → BLOQUEADO automáticamente.

### ¿Qué pasa si un empleado rota entre terminales?
Permitido sin confirmación. Sistema registra acceso en auditoría.

### ¿Qué pasa si alguien intenta usar terminal ajena?
Sistema registra acceso con warning. Admin puede revisar si es legítimo.

### ¿Qué pasa si hay múltiples empleados en una terminal?
Cada uno tiene su MAC. Sistema registra quién accedió cuándo.

### ¿Qué pasa si un dispositivo tiene múltiples MACs?
Posible en algunos casos (dual-boot, VM). Sistema registra todas.

---

**Status:** ✅ APROBADO - Listo para implementación  
**Modelo:** Híbrido (Opción 3)  
**Escalabilidad:** Todas las terminales existentes y futuras  
**Próximo:** Phase 1 Implementation
