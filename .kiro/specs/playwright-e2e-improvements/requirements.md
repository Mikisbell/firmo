# Requirements Document

## Introduction

Este documento define los requisitos para mejorar la arquitectura de tests E2E con Playwright en PARK POS. El sistema actualmente tiene 21 archivos de tests E2E que presentan problemas de contexto compartido, performance, mantenibilidad y confiabilidad. Esta mejora busca establecer una arquitectura robusta, escalable y mantenible para los tests E2E.

## Glossary

- **POM (Page Object Model)**: Patrón de diseño que encapsula la lógica de interacción con páginas web en clases reutilizables
- **Fixture**: Mecanismo de Playwright para configurar y limpiar estado antes/después de tests
- **Context**: Instancia de navegador aislada con su propio estado (cookies, localStorage, sesión)
- **Selector Hierarchy**: Estrategia de priorización de selectores (data-testid → role → aria-label → css)
- **Flaky Test**: Test que falla intermitentemente sin cambios en el código
- **Worker**: Proceso paralelo que ejecuta tests de forma independiente
- **Retry Logic**: Mecanismo para reintentar operaciones que fallan por razones transitorias
- **Network Idle**: Estado donde no hay requests de red pendientes por 500ms
- **Trace**: Grabación detallada de la ejecución de un test para debugging
- **Test Isolation**: Principio donde cada test es completamente independiente de otros

## Requirements

### Requirement 1: Aislamiento de Contexto

**User Story:** Como desarrollador de tests, quiero que cada test tenga su propio contexto aislado, para evitar interferencias entre tests y mejorar confiabilidad.

#### Acceptance Criteria

1. WHEN un test inicia THEN el sistema SHALL crear un nuevo contexto de navegador limpio
2. WHEN un test finaliza THEN el sistema SHALL limpiar cookies, localStorage y sessionStorage del contexto
3. WHEN múltiples tests se ejecutan THEN el estado de autenticación SHALL NOT persistir entre tests
4. WHEN tests se ejecutan en cualquier orden THEN los resultados SHALL ser consistentes
5. WHEN se usan fixtures THEN el sistema SHALL manejar setup y teardown automáticamente sin intervención manual

### Requirement 2: Performance Optimizada

**User Story:** Como desarrollador de tests, quiero reducir el tiempo de ejecución de tests en 50%, para obtener feedback más rápido en CI/CD.

#### Acceptance Criteria

1. WHEN un test espera por carga de página THEN el sistema SHALL usar esperas específicas en lugar de networkidle
2. WHEN múltiples tests se ejecutan THEN el sistema SHALL ejecutarlos en paralelo usando workers
3. WHEN un test requiere autenticación THEN el sistema SHALL reutilizar el estado de autenticación cuando sea seguro
4. WHEN un test busca elementos THEN el sistema SHALL usar selectores optimizados que reduzcan tiempo de búsqueda
5. WHEN un test espera por operaciones THEN el sistema SHALL usar timeouts inteligentes basados en el tipo de operación

### Requirement 3: Page Object Models

**User Story:** Como desarrollador de tests, quiero usar POMs para abstraer lógica de UI, para mejorar mantenibilidad y reutilización.

#### Acceptance Criteria

1. WHEN se crea un POM THEN el sistema SHALL encapsular todos los selectores de esa página
2. WHEN se crea un POM THEN el sistema SHALL incluir métodos para todas las acciones de usuario
3. WHEN se usa un POM THEN el sistema SHALL incluir validaciones integradas para verificar estado
4. WHEN múltiples tests usan un POM THEN el código SHALL ser reutilizable sin duplicación
5. WHEN se diseña un POM THEN el sistema SHALL seguir principios SOLID (Single Responsibility, Open/Closed, etc.)

### Requirement 4: Selectores Robustos

**User Story:** Como desarrollador de tests, quiero una jerarquía de selectores con fallbacks, para reducir tests flaky por cambios en UI.

#### Acceptance Criteria

1. WHEN el sistema busca un elemento THEN el sistema SHALL intentar data-testid primero, luego role, luego aria-label, finalmente css
2. WHEN se busca un elemento THEN el sistema SHALL usar helper getByTestIdOrFallback() que implementa la jerarquía
3. WHEN se agregan componentes nuevos THEN el sistema SHALL incluir data-testid en componentes críticos
4. WHEN se nombran testids THEN el sistema SHALL seguir convención kebab-case descriptiva
5. WHEN se valida un selector THEN el sistema SHALL verificar que el selector es único en la página

### Requirement 5: Fixtures Personalizados

**User Story:** Como desarrollador de tests, quiero fixtures de Playwright para setup/teardown, para simplificar código de tests y mejorar DRY.

#### Acceptance Criteria

1. WHEN un test requiere autenticación THEN el fixture authenticatedPage SHALL proporcionar una página autenticada automáticamente
2. WHEN un test requiere un tenant específico THEN el fixture tenantContext SHALL configurar el tenant automáticamente
3. WHEN un test requiere base de datos limpia THEN el fixture cleanDatabase SHALL limpiar datos antes del test
4. WHEN se combinan fixtures THEN el sistema SHALL permitir composición de fixtures (ej: authenticatedPage + tenantContext)
5. WHEN un fixture falla THEN el sistema SHALL manejar errores gracefully y proporcionar mensajes descriptivos

### Requirement 6: Paralelización Segura

**User Story:** Como desarrollador de tests, quiero ejecutar tests en paralelo de forma segura, para reducir tiempo total de ejecución.

#### Acceptance Criteria

1. WHEN tests se ejecutan en paralelo THEN cada test SHALL ser completamente independiente de otros
2. WHEN se usa paralelización THEN cada worker SHALL tener su propio tenant de prueba aislado
3. WHEN múltiples workers acceden recursos compartidos THEN el sistema SHALL implementar locking para prevenir conflictos
4. WHEN se configura paralelización THEN el sistema SHALL usar número óptimo de workers basado en CPU disponible
5. WHEN tests multi-tenant se ejecutan THEN el sistema SHALL ejecutarlos secuencialmente para evitar conflictos de RLS

### Requirement 7: Retry Logic Inteligente

**User Story:** Como desarrollador de tests, quiero retry automático para fallos transitorios, para reducir falsos negativos.

#### Acceptance Criteria

1. WHEN un test falla por error de red THEN el sistema SHALL reintentar automáticamente hasta 3 veces
2. WHEN se reintenta un test THEN el sistema SHALL usar backoff exponencial (1s, 2s, 4s)
3. WHEN un test falla por assertion THEN el sistema SHALL NOT reintentar (fallo legítimo)
4. WHEN se reintenta un test THEN el sistema SHALL loggear cada intento con timestamp y razón
5. WHEN se configura retry THEN el sistema SHALL permitir configuración diferente por tipo de test (unit, integration, e2e)

### Requirement 8: Reporting Mejorado

**User Story:** Como desarrollador de tests, quiero reportes detallados con screenshots y traces, para facilitar debugging de fallos.

#### Acceptance Criteria

1. WHEN un test falla THEN el sistema SHALL capturar screenshot automáticamente del estado final
2. WHEN un test falla THEN el sistema SHALL generar trace completo con timeline de acciones
3. WHEN se ejecutan tests THEN el sistema SHALL grabar video opcional para tests críticos
4. WHEN tests finalizan THEN el sistema SHALL generar reporte HTML con métricas de performance (tiempo, memoria, requests)
5. WHEN tests se ejecutan en CI/CD THEN el sistema SHALL integrar reportes con pipeline para visualización

### Requirement 9: Estrategias de Espera Inteligentes

**User Story:** Como desarrollador de tests, quiero estrategias de espera inteligentes, para reducir timeouts y mejorar confiabilidad.

#### Acceptance Criteria

1. WHEN un test espera por elemento THEN el sistema SHALL usar polling inteligente con intervalos crecientes
2. WHEN un test espera por API THEN el sistema SHALL esperar por request específico en lugar de networkidle
3. WHEN un test espera por animación THEN el sistema SHALL usar timeouts configurables basados en duración de animación
4. WHEN una espera falla THEN el sistema SHALL proporcionar fallback automático a estrategia alternativa
5. WHEN se configura espera THEN el sistema SHALL permitir timeouts diferentes por tipo de operación (click: 5s, API: 30s, navigation: 60s)

### Requirement 10: Helpers y Utilidades Compartidas

**User Story:** Como desarrollador de tests, quiero helpers y utilidades compartidas, para reducir código duplicado y mejorar consistencia.

#### Acceptance Criteria

1. WHEN se autentica un usuario THEN el helper login() SHALL manejar todo el flujo de autenticación
2. WHEN se navega a una página THEN el helper navigateAndWait() SHALL navegar y esperar por carga completa
3. WHEN se valida contenido THEN el helper assertTextContent() SHALL proporcionar mensajes de error descriptivos
4. WHEN se generan datos de prueba THEN el helper generateTestData() SHALL crear datos válidos y consistentes
5. WHEN se limpian datos THEN el helper cleanupTestData() SHALL eliminar todos los datos creados durante el test

### Requirement 11: Configuración Centralizada

**User Story:** Como desarrollador de tests, quiero configuración centralizada, para facilitar mantenimiento y consistencia.

#### Acceptance Criteria

1. WHEN se configuran tests THEN el sistema SHALL usar archivo playwright.config.ts centralizado
2. WHEN se definen timeouts THEN el sistema SHALL usar constantes centralizadas en config/constants.ts
3. WHEN se configuran URLs THEN el sistema SHALL usar variables de entorno con fallbacks sensatos
4. WHEN se configuran workers THEN el sistema SHALL calcular número óptimo basado en CPU disponible
5. WHEN se configura retry THEN el sistema SHALL permitir override por test usando anotaciones

### Requirement 12: Documentación y Guías

**User Story:** Como desarrollador de tests, quiero documentación completa y guías, para facilitar adopción y mantenimiento.

#### Acceptance Criteria

1. WHEN un desarrollador nuevo llega THEN el sistema SHALL proporcionar guía de inicio rápido
2. WHEN se crean POMs THEN el sistema SHALL proporcionar template y ejemplos
3. WHEN se escriben tests THEN el sistema SHALL proporcionar guía de mejores prácticas
4. WHEN se migran tests existentes THEN el sistema SHALL proporcionar guía de migración paso a paso
5. WHEN se debuggean tests THEN el sistema SHALL proporcionar guía de troubleshooting con casos comunes
