# ADR-004: Dinero en centavos (enteros) + redondeo determinístico

## Estado
Aceptado

## Contexto
Flotantes generan bugs de centavos, causando descuadres de caja y mismatches en sync.

## Decisión
Todo dinero se maneja en centavos (int).
Impuestos y descuentos se calculan de forma determinística (preferible por línea), y se registran totales finales al confirmar.

## Consecuencias

### Positivas
- Elimina errores de coma flotante.
- Totales reproducibles.

### Negativas
- Se requiere disciplina: no usar float en ningún punto.

## Fecha
2025-12-30
