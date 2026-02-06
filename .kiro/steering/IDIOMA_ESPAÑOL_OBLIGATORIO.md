---
inclusion: always
---

# 🇪🇸 REGLA CRÍTICA: TODO EN ESPAÑOL

## Regla Obligatoria

**TODOS los documentos, comentarios, mensajes, descripciones y contenido generado DEBEN estar en ESPAÑOL.**

## Alcance

Esta regla aplica a:

### ✅ Documentación
- Archivos `.md` (Markdown)
- Comentarios JSDoc en código
- Archivos README
- Guías de implementación
- Resúmenes ejecutivos
- Documentación de tareas

### ✅ Código
- Comentarios en código TypeScript/JavaScript
- Comentarios en tests
- Mensajes de commit
- Nombres de variables (cuando sea apropiado)
- Strings de usuario

### ✅ Comunicación
- Mensajes al usuario
- Descripciones de tareas
- Reportes de progreso
- Mensajes de error para usuarios
- Logs de usuario

### ❌ Excepciones (Mantener en Inglés)
- Nombres de funciones y métodos (convención de código)
- Nombres de variables técnicas
- Palabras clave del lenguaje (if, else, function, etc.)
- Nombres de librerías y frameworks
- URLs y rutas de API
- Mensajes de error técnicos internos

## Ejemplos

### ✅ CORRECTO

```typescript
/**
 * Servicio de verificación de salud del sistema
 * 
 * Implementa verificaciones completas de:
 * - Conectividad de base de datos
 * - Conectividad de Redis
 * - Salud del event sourcing
 * 
 * @module core/health/health-check
 */
export class HealthCheckService {
  /**
   * Realizar verificación completa de salud
   * Retorna el estado de salud de todos los componentes
   */
  async check(): Promise<HealthCheckResult> {
    // Ejecutar todas las verificaciones en paralelo
    const [database, redis, eventSourcing] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkEventSourcing(),
    ]);
    
    // Calcular estado general del sistema
    const status = this.calculateSystemStatus(database, redis, eventSourcing);
    
    return {
      status,
      timestamp: new Date().toISOString(),
      components: { database, redis, eventSourcing },
    };
  }
}
```

### ❌ INCORRECTO

```typescript
/**
 * Health Check Service
 * 
 * Implements comprehensive health checking with:
 * - Database connectivity check
 * - Redis connectivity check
 * - Event sourcing health check
 * 
 * @module core/health/health-check
 */
export class HealthCheckService {
  /**
   * Perform complete health check
   * Returns health status for all components
   */
  async check(): Promise<HealthCheckResult> {
    // Run all health checks in parallel
    const [database, redis, eventSourcing] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkEventSourcing(),
    ]);
    
    // Calculate overall system status
    const status = this.calculateSystemStatus(database, redis, eventSourcing);
    
    return {
      status,
      timestamp: new Date().toISOString(),
      components: { database, redis, eventSourcing },
    };
  }
}
```

## Documentación Markdown

### ✅ CORRECTO

```markdown
# Tarea 13: Sistema de Verificación de Salud - Implementación Completa ✅

## Resumen Ejecutivo

Se implementó exitosamente un sistema completo de verificación de salud para PARK POS con capacidades de monitoreo de grado de producción.

**Estado:** ✅ **COMPLETO** - Todas las 5 sub-tareas implementadas y probadas

### Lo Que Se Construyó

1. **Servicio de Verificación de Salud** (`src/core/health/health-check.ts`)
   - Verificación completa de salud para todos los componentes del sistema
   - Verificación de conectividad de base de datos vía Prisma
   - Verificación de conectividad de Redis vía servicio de caché
```

### ❌ INCORRECTO

```markdown
# Task 13: Health Check System - Implementation Complete ✅

## Executive Summary

Successfully implemented a comprehensive health check system for PARK POS with production-grade monitoring capabilities.

**Status:** ✅ **COMPLETE** - All 5 sub-tasks implemented and tested

### What Was Built

1. **Health Check Service** (`src/core/health/health-check.ts`)
   - Comprehensive health checking for all system components
   - Database connectivity check via Prisma
   - Redis connectivity check via cache service
```

## Mensajes al Usuario

### ✅ CORRECTO

```typescript
console.log('Verificación de salud completada exitosamente');
logger.info('Sistema saludable - todos los componentes operativos');
throw new Error('Error al conectar con la base de datos');
```

### ❌ INCORRECTO

```typescript
console.log('Health check completed successfully');
logger.info('System healthy - all components operational');
throw new Error('Failed to connect to database');
```

## Implementación Inmediata

A partir de ahora, TODOS los nuevos archivos, comentarios y documentación deben seguir esta regla.

## Archivos Existentes

Los archivos existentes en inglés pueden permanecer así por compatibilidad, pero:
- Nuevos comentarios: en español
- Nueva documentación: en español
- Actualizaciones mayores: considerar traducir

## Verificación

Antes de completar cualquier tarea, verificar:
- [ ] ¿Los comentarios están en español?
- [ ] ¿La documentación está en español?
- [ ] ¿Los mensajes al usuario están en español?
- [ ] ¿Los archivos `.md` están en español?

---

**Última actualización:** 6 Febrero 2026  
**Razón:** Requisito del proyecto - todo el contenido debe estar en español  
**Prioridad:** 🔴 CRÍTICA - Aplicar inmediatamente
