# ADR-003: Catálogo versionado con pinning por venta y rollback

## Estado
Aceptado

## Contexto
Precios/impuestos pueden cambiar. Necesitamos totales determinísticos y reproducibles.

## Decisión
El catálogo se distribuye por versiones (`catalog_version`) con checksum.
Cada venta guarda (pin) la `catalog_version` en `sale_created`.
El cliente solo activa una versión si el checksum valida.
Rollback: el cloud puede marcar otra versión como activa; el cliente la descarga/activa sin romper ventas previas.

## Alternativas Consideradas
- **Catálogo "siempre último":** rompe totales históricos.
- **Recalcular ventas con catálogo nuevo:** no determinístico y riesgoso.

## Consecuencias

### Positivas
- Totales determinísticos y auditables.
- Deploy seguro de cambios.

### Negativas
- Se debe mantener compatibilidad de schemas de catálogo.

## Fecha
2025-12-30
