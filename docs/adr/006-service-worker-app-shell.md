# ADR-006: Service Worker para app shell offline (no transacciones)

## Estado
Aceptado

## Contexto
La app debe abrir y funcionar sin internet.

## Decisión
Service Worker cachea recursos (app shell) para cargar offline.
Los datos transaccionales (ventas/eventos) siguen en IndexedDB.

## Consecuencias

### Positivas
- La UI abre offline.

### Negativas
- No usar Cache API para datos críticos; riesgo de inconsistencia.

## Fecha
2025-12-30
