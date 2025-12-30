# ADR-001: Device-SoT + Event Log local append-only

## Estado
Aceptado

## Contexto
PARK operará con 1 sola caja (sin multi-terminal). La operación debe ser ultra rápida y tolerar internet intermitente.
Necesitamos trazabilidad (cierre explicable) y recuperación tras fallos.

## Decisión
El dispositivo de caja será la fuente de verdad operacional (Device-SoT).
Se persistirá un Event Log append-only en IndexedDB (Dexie), con `terminal_sequence` monótono y `event_id` UUID global.
Las pantallas leen de proyecciones (read models) derivadas por reducers determinísticos.

## Alternativas Consideradas
- **CRUD directo a nube (Vercel) en tiempo real:** no cumple offline y agrega latencia.
- **Soft-Hub local:** innecesario para 1 caja (costo/operación extra).
- **CRDT general:** complejidad innecesaria sin multi-caja.

## Consecuencias

### Positivas
- Venta puede confirmarse sin red.
- Auditoría y explicabilidad por eventos.
- Rebuild de proyecciones posible.

### Negativas
- Riesgo: pérdida/borrado del storage local.

### Mitigación
- Storage persistente + backup cifrado + sync agresivo.

## Fecha
2025-12-30
