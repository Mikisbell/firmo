# Requirements Document

## Introduction

Este documento define los requisitos para la optimización completa del sistema de tests E2E con Playwright en PARK POS. El sistema actual presenta problemas críticos de aislamiento de contexto, performance y mantenibilidad que impiden la ejecución confiable de tests multi-tenant y generan falsos positivos/negativos.

## Glossary

- **Test_Context**: Contexto de navegador de Playwright que incluye cookies, localStorage, sessionStorage y estado de autenticación
- **Test_Isolation**: Separación completa entre tests para evitar contaminación de datos y estado
- **POM (Page_Object_Model)**: Patrón de diseño que encapsula la lógica de interacción con páginas en clases reutilizables
- **Fixture**: Mecanismo de Playwright para setup/teardown y provisión de recursos a tests
- **Selector_Strategy**: Jerarquía de selectores CSS/DOM para localizar elementos de forma robusta
- **Parallel_Execution**: Ejecución simultánea de tests en múltiples workers
- **Test_Data_Provisioning**: Sistema de creación y limpieza de datos de prueba aislados por tenant
- **Network_Wait**: Estrategia de espera para operaciones de red (networkidle, waitForSelector, etc.)
- **Test_Worker**: Proceso independiente que ejecuta tests en paralelo
- **Storage_State**: Estado de autenticación serializado (cookies, localStorage) que puede reutilizarse

## Requirements

### Requirement 1: Aislamiento Completo de Contexto

**User Story:** Como desarrollador de tests, quiero que cada test tenga un contexto de navegador completamente aislado, para que no haya contaminación de datos entre tests y los resultados sean reproducibles.

#### Acceptance Criteria

1. WHEN un test inicia, THE Test_Context SHALL ser creado desde cero sin reutilizar contexto previo
2. WHEN un test finaliza, THE Test_Context SHALL ser destruido completamente incluyendo cookies y localStorage
3. WHEN múltiples tests se ejecutan en paralelo, THE Test_Context de cada test SHALL ser independiente
4. IF un test modifica cookies o localStorage, THEN THE cambios SHALL NOT afectar otros tests
5. WHEN un test requiere autenticación, THE Test_Context SHALL usar un Fixture personalizado para login aislado

### Requirement 2: Performance Optimizada

**User Story:** Como desarrollador de tests, quiero que los tests se ejecuten rápidamente y sin timeouts, para que el feedback sea inmediato y la CI/CD sea eficiente.

#### Acceptance Criteria

1. WHEN un test espera por elementos, THE Test_System SHALL usar waitForSelector con timeouts específicos en lugar de networkidle
2. WHEN múltiples tests se ejecutan, THE Test_System SHALL ejecutarlos en paralelo usando múltiples Test_Workers
3. WHEN un test requiere autenticación, THE Test_System SHALL cachear el Storage_State para reutilizarlo cuando sea seguro
4. WHEN un test hace requests a APIs, THE Test_System SHALL optimizar las queries de base de datos con índices apropiados
5. THE Test_System SHALL reducir el tiempo total de ejecución en al menos 50% comparado con el baseline actual

### Requirement 3: Mantenibilidad con Page Object Models

**User Story:** Como desarrollador de tests, quiero usar Page Object Models consistentes, para que los tests sean fáciles de mantener y cambios en UI no rompan múltiples tests.

#### Acceptance Criteria

1. WHEN se crea un test para una página, THE Test_System SHALL usar un POM que encapsule toda la lógica de interacción
2. WHEN la UI de una página cambia, THE Test_System SHALL requerir cambios solo en el POM correspondiente
3. THE POM SHALL exponer métodos de alto nivel que oculten detalles de implementación de selectores
4. THE POM SHALL incluir métodos de verificación (assertions) específicos del dominio
5. WHEN múltiples tests usan la misma página, THE Test_System SHALL reutilizar el mismo POM

### Requirement 4: Estrategia de Selectores Robusta

**User Story:** Como desarrollador de tests, quiero una estrategia de selectores jerárquica y robusta, para que los tests no fallen por cambios menores en clases CSS o estructura DOM.

#### Acceptance Criteria

1. WHEN se localiza un elemento, THE Selector_Strategy SHALL priorizar data-testid sobre otros selectores
2. IF data-testid no está disponible, THEN THE Selector_Strategy SHALL usar role-based selectors
3. IF role-based selectors no están disponibles, THEN THE Selector_Strategy SHALL usar text content como último recurso
4. THE Selector_Strategy SHALL evitar selectores basados en clases CSS que puedan cambiar
5. WHEN se agregan nuevos componentes, THE Test_System SHALL requerir data-testid attributes

### Requirement 5: Ejecución Paralela Segura

**User Story:** Como desarrollador de tests, quiero ejecutar tests en paralelo de forma segura, para que la suite completa se ejecute rápidamente sin conflictos de datos.

#### Acceptance Criteria

1. WHEN tests se ejecutan en paralelo, THE Test_System SHALL asignar datos de prueba únicos a cada Test_Worker
2. WHEN múltiples Test_Workers acceden a la base de datos, THE Test_System SHALL prevenir conflictos de escritura
3. THE Test_System SHALL configurar al menos 4 Test_Workers para ejecución paralela
4. WHEN un test falla, THE Test_System SHALL NOT afectar la ejecución de otros tests en paralelo
5. WHEN tests multi-tenant se ejecutan en paralelo, THE Test_System SHALL asegurar aislamiento completo de datos por tenant

### Requirement 6: Provisión de Datos de Prueba Aislados

**User Story:** Como desarrollador de tests, quiero que cada test tenga sus propios datos de prueba aislados, para que los tests sean independientes y reproducibles.

#### Acceptance Criteria

1. WHEN un test inicia, THE Test_Data_Provisioning SHALL crear datos únicos para ese test
2. WHEN un test finaliza, THE Test_Data_Provisioning SHALL limpiar los datos creados
3. WHEN tests multi-tenant se ejecutan, THE Test_Data_Provisioning SHALL crear tenants separados con datos aislados
4. THE Test_Data_Provisioning SHALL verificar que los datos existen antes de ejecutar el test
5. IF la provisión de datos falla, THEN THE Test_System SHALL fallar el test con un mensaje descriptivo

### Requirement 7: Fixtures Personalizados para Setup/Teardown

**User Story:** Como desarrollador de tests, quiero fixtures personalizados que manejen setup y teardown automáticamente, para que los tests sean más limpios y consistentes.

#### Acceptance Criteria

1. THE Test_System SHALL proveer un Fixture de autenticación que maneje login/logout automáticamente
2. THE Test_System SHALL proveer un Fixture de contexto aislado que cree y destruya contextos de navegador
3. THE Test_System SHALL proveer un Fixture de datos de prueba que provisione y limpie datos automáticamente
4. WHEN un test usa múltiples Fixtures, THE Test_System SHALL ejecutarlos en el orden correcto
5. WHEN un Fixture falla durante setup, THE Test_System SHALL saltar el test y reportar el error claramente

### Requirement 8: Optimización de Network Waits

**User Story:** Como desarrollador de tests, quiero estrategias de espera optimizadas para operaciones de red, para que los tests no tengan timeouts innecesarios ni esperas excesivas.

#### Acceptance Criteria

1. THE Test_System SHALL evitar el uso de waitForLoadState('networkidle') excepto cuando sea absolutamente necesario
2. WHEN un test espera por datos de API, THE Test_System SHALL usar waitForResponse con URL específica
3. WHEN un test espera por elementos dinámicos, THE Test_System SHALL usar waitForSelector con timeout de 5 segundos
4. THE Test_System SHALL configurar timeout global de 30 segundos para tests (reducido de 180 segundos)
5. WHEN un test requiere espera personalizada, THE Test_System SHALL proveer helpers de espera reutilizables

### Requirement 9: Helpers y Utilidades Reutilizables

**User Story:** Como desarrollador de tests, quiero helpers y utilidades reutilizables, para que no tenga que duplicar código común entre tests.

#### Acceptance Criteria

1. THE Test_System SHALL proveer helpers para operaciones comunes de autenticación
2. THE Test_System SHALL proveer helpers para navegación y espera de elementos
3. THE Test_System SHALL proveer helpers para verificación de datos en tablas
4. THE Test_System SHALL proveer helpers para manejo de modales y diálogos
5. WHEN se identifica código duplicado, THE Test_System SHALL refactorizarlo en un helper reutilizable

### Requirement 10: Documentación y Patrones

**User Story:** Como desarrollador de tests, quiero documentación clara de estrategias y patrones, para que pueda escribir tests consistentes y de alta calidad.

#### Acceptance Criteria

1. THE Test_System SHALL documentar la estrategia de selectores con ejemplos
2. THE Test_System SHALL documentar el patrón POM con templates reutilizables
3. THE Test_System SHALL documentar el uso de fixtures personalizados
4. THE Test_System SHALL documentar la estrategia de datos de prueba
5. THE Test_System SHALL incluir ejemplos de tests bien escritos como referencia
