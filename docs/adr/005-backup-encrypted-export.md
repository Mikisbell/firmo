# ADR-005: Backup/restore cifrado del event log con dedupe

## Estado
Aceptado

## Contexto
Device-SoT implica riesgo de pérdida si el usuario borra datos o el equipo falla antes de sincronizar.

## Decisión
Implementar export cifrado (AES-GCM via WebCrypto) del event log (rango de secuencias) a archivo.
Restore: importar eventos dedupeando por `event_id` y reconstruir proyecciones.

## Alternativas Consideradas
- **Confiar solo en sync:** no cubre fallas antes de reconectar.
- **Backup sin cifrar:** riesgo operacional.

## Consecuencias

### Positivas
- Mitiga pérdida del dispositivo.
- Proceso operativo simple para tienda.

### Negativas
- Requiere UX clara (cuando recomendar backup).

## Fecha
2025-12-30
