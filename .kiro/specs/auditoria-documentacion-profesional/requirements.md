# Requirements Document - Auditoría y Organización Profesional de Documentación PARK POS 2026

## Introducción

Este documento define los requisitos para un sistema completo de auditoría y organización profesional de la documentación del proyecto PARK POS. El sistema analizará exhaustivamente todo el código fuente, documentación existente, specs y tests para generar una visión consolidada, precisa y navegable del estado real del proyecto.

### Contexto del Proyecto

PARK POS es un sistema POS offline-first para pollerías peruanas con:
- 33 specs en `.kiro/specs/`
- Documentación extensa en `docs/` con múltiples flujos
- Código TypeScript/Next.js con Event Sourcing
- 214 tests unitarios + 10 stress + 52 E2E
- Arquitectura: Event Sourcing + Device-SoT + IndexedDB/PostgreSQL
- Stack: Next.js 15 + Prisma + Dexie + Supabase + Tailwind
- Fases: P0 (100%), P1 (100%), P2 (35%), P3 (0%)

### Problema a Resolver

Actualmente existe:
- Documentación dispersa en múltiples ubicaciones
- Posibles inconsistencias entre código y documentación
- Falta de visibilidad del estado real de implementación
- Dificultad para navegar entre specs, código y tests
- Ausencia de matriz de trazabilidad requirement-to-code
- Roadmap que puede no reflejar el estado actual preciso

## Glossary

- **Auditoría_de_Código**: Análisis exhaustivo de todos los archivos en `src/` para identificar funcionalidades implementadas
- **Auditoría_de_Documentación**: Análisis exhaustivo de todos los archivos en `docs/` y `.kiro/specs/` para identificar gaps e inconsistencias
- **Matriz_de_Trazabilidad**: Tabla que mapea Requirements → Design → Code → Tests para cada funcionalidad
- **Roadmap_Consolidado**: Documento maestro que organiza todas las funcionalidades por fases (P0, P1, P2, P3) con estado real
- **Índice_Maestro**: Documento navegable con links a código, documentación, specs y tests
- **Gap_Analysis**: Identificación de funcionalidades sin documentar, documentación sin implementar, y código sin tests
- **Sistema_de_Auditoría**: Conjunto de herramientas y procesos para analizar código y documentación
- **Spec**: Documento en `.kiro/specs/` que contiene requirements.md, design.md y tasks.md
- **Funcionalidad**: Característica implementada del sistema (ej: Split Bill, KDS, Multi-tenant)
- **Fase**: Agrupación de funcionalidades por prioridad (P0=MVP, P1=Multi-Terminal, P2=Growth, P3=Future)

## Requirements

### Requirement 1: Auditoría Exhaustiva de Código Fuente

**User Story:** Como arquitecto de software, quiero auditar exhaustivamente todo el código fuente, para que pueda identificar todas las funcionalidades implementadas y su estado real.

#### Acceptance Criteria

1. WHEN el Sistema_de_Auditoría analiza el directorio `src/`, THEN el sistema SHALL leer recursivamente todos los archivos TypeScript (.ts, .tsx)
2. WHEN el Sistema_de_Auditoría procesa un archivo de código, THEN el sistema SHALL extraer funciones exportadas, clases, componentes React, hooks, servicios y APIs
3. WHEN el Sistema_de_Auditoría identifica una funcionalidad, THEN el sistema SHALL clasificarla por tipo (UI Component, Service, API Route, Hook, Utility, Test)
4. WHEN el Sistema_de_Auditoría encuentra un archivo de servicio, THEN el sistema SHALL identificar las operaciones CRUD y lógica de negocio implementada
5. WHEN el Sistema_de_Auditoría encuentra un API route, THEN el sistema SHALL extraer métodos HTTP (GET, POST, PUT, DELETE), parámetros y respuestas
6. WHEN el Sistema_de_Auditoría encuentra un componente React, THEN el sistema SHALL identificar props, hooks utilizados y dependencias
7. WHEN el Sistema_de_Auditoría completa el análisis, THEN el sistema SHALL generar un inventario completo de funcionalidades con ubicación de archivos
8. WHEN el Sistema_de_Auditoría detecta código sin documentar, THEN el sistema SHALL marcarlo como gap en el análisis
9. WHEN el Sistema_de_Auditoría encuentra tests asociados, THEN el sistema SHALL vincular tests con código fuente correspondiente
10. WHEN el Sistema_de_Auditoría finaliza, THEN el sistema SHALL generar métricas de cobertura (líneas de código, archivos, funcionalidades)

### Requirement 2: Auditoría Exhaustiva de Documentación

**User Story:** Como arquitecto de software, quiero auditar exhaustivamente toda la documentación existente, para que pueda identificar gaps, inconsistencias y documentación obsoleta.

#### Acceptance Criteria

1. WHEN el Sistema_de_Auditoría analiza el directorio `docs/`, THEN el sistema SHALL leer recursivamente todos los archivos Markdown (.md)
2. WHEN el Sistema_de_Auditoría analiza el directorio `.kiro/specs/`, THEN el sistema SHALL leer todos los specs (requirements.md, design.md, tasks.md)
3. WHEN el Sistema_de_Auditoría procesa un documento, THEN el sistema SHALL extraer títulos, secciones, referencias a código y links
4. WHEN el Sistema_de_Auditoría encuentra una referencia a código, THEN el sistema SHALL verificar si el archivo/función existe
5. WHEN el Sistema_de_Auditoría encuentra un link roto, THEN el sistema SHALL marcarlo como inconsistencia
6. WHEN el Sistema_de_Auditoría compara documentación con código, THEN el sistema SHALL identificar funcionalidades documentadas pero no implementadas
7. WHEN el Sistema_de_Auditoría compara código con documentación, THEN el sistema SHALL identificar funcionalidades implementadas pero no documentadas
8. WHEN el Sistema_de_Auditoría encuentra specs, THEN el sistema SHALL verificar si las tareas están completadas en el código
9. WHEN el Sistema_de_Auditoría detecta documentación obsoleta, THEN el sistema SHALL marcarla con fecha de última actualización del código relacionado
10. WHEN el Sistema_de_Auditoría finaliza, THEN el sistema SHALL generar un reporte de gaps de documentación

### Requirement 3: Generación de Matriz de Trazabilidad

**User Story:** Como arquitecto de software, quiero una matriz de trazabilidad completa, para que pueda rastrear cada requirement desde su diseño hasta su implementación y tests.

#### Acceptance Criteria

1. WHEN el Sistema_de_Auditoría genera la Matriz_de_Trazabilidad, THEN el sistema SHALL crear una tabla con columnas: Requirement ID, Requirement Text, Design Reference, Code Files, Test Files, Status
2. WHEN el Sistema_de_Auditoría procesa un spec, THEN el sistema SHALL extraer todos los requirements del archivo requirements.md
3. WHEN el Sistema_de_Auditoría procesa un design, THEN el sistema SHALL vincular correctness properties con requirements
4. WHEN el Sistema_de_Auditoría busca implementación, THEN el sistema SHALL identificar archivos de código que implementan cada requirement
5. WHEN el Sistema_de_Auditoría busca tests, THEN el sistema SHALL identificar tests unitarios, property-based y E2E que validan cada requirement
6. WHEN el Sistema_de_Auditoría calcula el status, THEN el sistema SHALL marcar como "Completo" si existe requirement + design + code + tests
7. WHEN el Sistema_de_Auditoría calcula el status, THEN el sistema SHALL marcar como "Parcial" si falta algún componente
8. WHEN el Sistema_de_Auditoría calcula el status, THEN el sistema SHALL marcar como "No Iniciado" si solo existe requirement
9. WHEN el Sistema_de_Auditoría genera la matriz, THEN el sistema SHALL incluir porcentaje de completitud por spec
10. WHEN el Sistema_de_Auditoría genera la matriz, THEN el sistema SHALL incluir métricas globales de trazabilidad del proyecto

### Requirement 4: Generación de Roadmap Consolidado Profesional

**User Story:** Como product manager, quiero un roadmap consolidado profesional, para que pueda visualizar el estado real de todas las funcionalidades organizadas por fases.

#### Acceptance Criteria

1. WHEN el Sistema_de_Auditoría genera el Roadmap_Consolidado, THEN el sistema SHALL organizar funcionalidades en 4 fases: P0 (MVP), P1 (Multi-Terminal), P2 (Growth), P3 (Future)
2. WHEN el Sistema_de_Auditoría clasifica una funcionalidad, THEN el sistema SHALL determinar su fase basándose en specs existentes y prioridad
3. WHEN el Sistema_de_Auditoría lista una funcionalidad, THEN el sistema SHALL incluir: nombre, descripción, spec asociado, estado (Completo/En Progreso/Pendiente), porcentaje de completitud
4. WHEN el Sistema_de_Auditoría calcula el estado de una fase, THEN el sistema SHALL calcular porcentaje de completitud basado en funcionalidades completadas
5. WHEN el Sistema_de_Auditoría genera métricas, THEN el sistema SHALL incluir: total de funcionalidades, funcionalidades por fase, líneas de código, archivos, tests
6. WHEN el Sistema_de_Auditoría identifica dependencias, THEN el sistema SHALL marcar funcionalidades que dependen de otras
7. WHEN el Sistema_de_Auditoría genera el roadmap, THEN el sistema SHALL incluir timeline estimado basado en tareas pendientes
8. WHEN el Sistema_de_Auditoría actualiza el roadmap, THEN el sistema SHALL preservar información histórica de versiones anteriores
9. WHEN el Sistema_de_Auditoría genera el roadmap, THEN el sistema SHALL incluir links a specs, código y documentación relacionada
10. WHEN el Sistema_de_Auditoría finaliza el roadmap, THEN el sistema SHALL generar visualización en formato Markdown con tablas y diagramas Mermaid

### Requirement 5: Generación de Índice Maestro Navegable

**User Story:** Como desarrollador, quiero un índice maestro navegable, para que pueda encontrar rápidamente cualquier funcionalidad y acceder a su código, documentación y tests.

#### Acceptance Criteria

1. WHEN el Sistema_de_Auditoría genera el Índice_Maestro, THEN el sistema SHALL crear una tabla de contenidos jerárquica con todas las funcionalidades
2. WHEN el Sistema_de_Auditoría lista una funcionalidad, THEN el sistema SHALL incluir links directos a: código fuente, documentación, spec, tests
3. WHEN el Sistema_de_Auditoría organiza el índice, THEN el sistema SHALL agrupar funcionalidades por módulo (Auth, Orders, Inventory, Admin, etc.)
4. WHEN el Sistema_de_Auditoría genera links, THEN el sistema SHALL usar rutas relativas desde la raíz del proyecto
5. WHEN el Sistema_de_Auditoría encuentra múltiples archivos relacionados, THEN el sistema SHALL listarlos todos con descripción breve
6. WHEN el Sistema_de_Auditoría genera el índice, THEN el sistema SHALL incluir sección de "Referencias Rápidas" con archivos más importantes
7. WHEN el Sistema_de_Auditoría genera el índice, THEN el sistema SHALL incluir sección de "Specs por Fase" con links a cada spec
8. WHEN el Sistema_de_Auditoría genera el índice, THEN el sistema SHALL incluir sección de "APIs" con todos los endpoints organizados por ruta
9. WHEN el Sistema_de_Auditoría genera el índice, THEN el sistema SHALL incluir sección de "Componentes UI" con todos los componentes React
10. WHEN el Sistema_de_Auditoría genera el índice, THEN el sistema SHALL ser navegable desde cualquier editor Markdown con soporte de links

### Requirement 6: Análisis de Gaps Completo

**User Story:** Como arquitecto de software, quiero un análisis completo de gaps, para que pueda identificar qué falta implementar, documentar o testear.

#### Acceptance Criteria

1. WHEN el Sistema_de_Auditoría genera el Gap_Analysis, THEN el sistema SHALL identificar funcionalidades implementadas sin documentación
2. WHEN el Sistema_de_Auditoría genera el Gap_Analysis, THEN el sistema SHALL identificar funcionalidades documentadas sin implementación
3. WHEN el Sistema_de_Auditoría genera el Gap_Analysis, THEN el sistema SHALL identificar código sin tests unitarios
4. WHEN el Sistema_de_Auditoría genera el Gap_Analysis, THEN el sistema SHALL identificar código sin tests property-based
5. WHEN el Sistema_de_Auditoría genera el Gap_Analysis, THEN el sistema SHALL identificar flujos críticos sin tests E2E
6. WHEN el Sistema_de_Auditoría genera el Gap_Analysis, THEN el sistema SHALL identificar specs con tareas incompletas
7. WHEN el Sistema_de_Auditoría genera el Gap_Analysis, THEN el sistema SHALL identificar documentación con links rotos
8. WHEN el Sistema_de_Auditoría genera el Gap_Analysis, THEN el sistema SHALL identificar APIs sin documentación OpenAPI
9. WHEN el Sistema_de_Auditoría genera el Gap_Analysis, THEN el sistema SHALL priorizar gaps por criticidad (Alta, Media, Baja)
10. WHEN el Sistema_de_Auditoría genera el Gap_Analysis, THEN el sistema SHALL incluir recomendaciones de acción para cada gap

### Requirement 7: Validación de Arquitectura Real vs Documentada

**User Story:** Como arquitecto de software, quiero validar que la arquitectura real coincida con la documentada, para que pueda identificar desviaciones y mantener la documentación actualizada.

#### Acceptance Criteria

1. WHEN el Sistema_de_Auditoría valida arquitectura, THEN el sistema SHALL comparar estructura de directorios real con la documentada en ARCHITECTURE.md
2. WHEN el Sistema_de_Auditoría valida eventos, THEN el sistema SHALL comparar eventos en código (events.ts) con los documentados en EVENTS.md
3. WHEN el Sistema_de_Auditoría valida servicios, THEN el sistema SHALL verificar que todos los servicios documentados existen en `src/core/services/`
4. WHEN el Sistema_de_Auditoría valida APIs, THEN el sistema SHALL verificar que todos los endpoints documentados existen en `src/app/api/`
5. WHEN el Sistema_de_Auditoría valida componentes, THEN el sistema SHALL verificar que todos los componentes documentados existen en `src/components/` o `src/app/`
6. WHEN el Sistema_de_Auditoría encuentra desviación, THEN el sistema SHALL documentar la diferencia con ubicación exacta
7. WHEN el Sistema_de_Auditoría valida patrones, THEN el sistema SHALL verificar que el código sigue los patrones arquitectónicos documentados (Event Sourcing, Outbox, etc.)
8. WHEN el Sistema_de_Auditoría valida dependencias, THEN el sistema SHALL verificar que las dependencias entre módulos coinciden con el diseño
9. WHEN el Sistema_de_Auditoría genera el reporte, THEN el sistema SHALL incluir porcentaje de conformidad arquitectónica
10. WHEN el Sistema_de_Auditoría genera el reporte, THEN el sistema SHALL recomendar actualizaciones de documentación o refactorings de código

### Requirement 8: Generación de Métricas de Proyecto

**User Story:** Como product manager, quiero métricas completas del proyecto, para que pueda tomar decisiones informadas sobre priorización y recursos.

#### Acceptance Criteria

1. WHEN el Sistema_de_Auditoría genera métricas, THEN el sistema SHALL calcular total de líneas de código por lenguaje (TypeScript, JavaScript, CSS)
2. WHEN el Sistema_de_Auditoría genera métricas, THEN el sistema SHALL calcular total de archivos por tipo (componentes, servicios, APIs, tests)
3. WHEN el Sistema_de_Auditoría genera métricas, THEN el sistema SHALL calcular cobertura de tests (unitarios, property-based, E2E)
4. WHEN el Sistema_de_Auditoría genera métricas, THEN el sistema SHALL calcular cobertura de documentación (funcionalidades documentadas vs implementadas)
5. WHEN el Sistema_de_Auditoría genera métricas, THEN el sistema SHALL calcular velocidad de desarrollo (commits por semana, funcionalidades por mes)
6. WHEN el Sistema_de_Auditoría genera métricas, THEN el sistema SHALL calcular deuda técnica (TODOs, FIXMEs, código duplicado)
7. WHEN el Sistema_de_Auditoría genera métricas, THEN el sistema SHALL calcular complejidad ciclomática promedio
8. WHEN el Sistema_de_Auditoría genera métricas, THEN el sistema SHALL calcular tamaño promedio de archivos y funciones
9. WHEN el Sistema_de_Auditoría genera métricas, THEN el sistema SHALL generar gráficos de tendencias (si hay datos históricos)
10. WHEN el Sistema_de_Auditoría genera métricas, THEN el sistema SHALL exportar métricas en formato JSON para integración con dashboards

### Requirement 9: Sistema de Actualización Incremental

**User Story:** Como desarrollador, quiero que el sistema de auditoría se actualice incrementalmente, para que no tenga que re-analizar todo el proyecto cada vez.

#### Acceptance Criteria

1. WHEN el Sistema_de_Auditoría detecta cambios en archivos, THEN el sistema SHALL re-analizar solo los archivos modificados
2. WHEN el Sistema_de_Auditoría re-analiza un archivo, THEN el sistema SHALL actualizar solo las secciones afectadas de los documentos generados
3. WHEN el Sistema_de_Auditoría detecta nuevo archivo, THEN el sistema SHALL integrarlo en el análisis existente
4. WHEN el Sistema_de_Auditoría detecta archivo eliminado, THEN el sistema SHALL removerlo del análisis y actualizar referencias
5. WHEN el Sistema_de_Auditoría actualiza documentos, THEN el sistema SHALL preservar secciones manuales (marcadas con comentarios especiales)
6. WHEN el Sistema_de_Auditoría genera documentos, THEN el sistema SHALL incluir timestamp de última actualización
7. WHEN el Sistema_de_Auditoría genera documentos, THEN el sistema SHALL incluir hash de archivos analizados para detectar cambios
8. WHEN el Sistema_de_Auditoría ejecuta actualización incremental, THEN el sistema SHALL completar en menos de 30 segundos para cambios menores
9. WHEN el Sistema_de_Auditoría ejecuta análisis completo, THEN el sistema SHALL completar en menos de 5 minutos para todo el proyecto
10. WHEN el Sistema_de_Auditoría falla, THEN el sistema SHALL preservar la versión anterior de documentos generados

### Requirement 10: Integración con Workflow de Desarrollo

**User Story:** Como desarrollador, quiero que el sistema de auditoría se integre con mi workflow, para que la documentación se mantenga actualizada automáticamente.

#### Acceptance Criteria

1. WHEN un desarrollador hace commit, THEN el sistema SHALL ofrecer ejecutar auditoría incremental
2. WHEN un desarrollador completa una tarea de spec, THEN el sistema SHALL actualizar automáticamente el roadmap y matriz de trazabilidad
3. WHEN un desarrollador crea un nuevo spec, THEN el sistema SHALL integrarlo automáticamente en el índice maestro
4. WHEN un desarrollador modifica código, THEN el sistema SHALL detectar si la documentación relacionada necesita actualización
5. WHEN el sistema detecta documentación desactualizada, THEN el sistema SHALL notificar al desarrollador con sugerencias de actualización
6. WHEN un desarrollador ejecuta tests, THEN el sistema SHALL actualizar métricas de cobertura en documentos
7. WHEN un desarrollador hace push, THEN el sistema SHALL validar que no hay links rotos en documentación modificada
8. WHEN un desarrollador solicita, THEN el sistema SHALL generar reporte de estado del proyecto en menos de 10 segundos
9. WHEN un desarrollador usa comando CLI, THEN el sistema SHALL ofrecer comandos para: auditar, actualizar, validar, generar reportes
10. WHEN el sistema se integra con CI/CD, THEN el sistema SHALL fallar el build si hay gaps críticos sin resolver
