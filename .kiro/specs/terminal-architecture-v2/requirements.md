# Requirements Document

## Introduction

Este documento define los requisitos para mejorar la arquitectura de registro y autenticación de terminales en PARK POS, basándose en las mejores prácticas de la industria POS 2025-2026 (Square, Toast, Clover) y estándares de seguridad modernos.

El sistema actual tiene inconsistencias en el flujo de navegación, fingerprinting básico, y carece de validación server-side robusta. Esta mejora implementará un sistema de provisioning empresarial con device binding, códigos de activación, y autenticación multi-factor adaptativa.

## Glossary

- **Terminal_Registry**: Servicio central que gestiona el registro y estado de todos los terminales
- **Device_Fingerprint**: Identificador único generado a partir de características del dispositivo (canvas, WebGL, hardware)
- **Activation_Code**: Código temporal de 6 dígitos para vincular un dispositivo físico con una configuración de terminal
- **Device_Binding**: Proceso de vincular permanentemente un dispositivo físico a un terminal_id específico
- **Step_Up_Auth**: Autenticación adicional requerida cuando se detectan anomalías en el fingerprint
- **Session_Manager**: Componente que gestiona sesiones de usuario con timeout y validación continua
- **Fingerprint_Drift**: Cambio gradual en el fingerprint debido a actualizaciones de browser/OS
- **Risk_Score**: Puntuación 0-100 que indica el nivel de riesgo de un intento de autenticación

## Requirements

### Requirement 1: Device Fingerprinting Mejorado

**User Story:** Como administrador del sistema, quiero que cada terminal tenga un fingerprint robusto y difícil de falsificar, para prevenir el uso no autorizado de terminales.

#### Acceptance Criteria

1. WHEN a device generates a fingerprint, THE Device_Fingerprint service SHALL collect at least 12 signals distintos (canvas, WebGL, audio, fonts, hardware)
2. WHEN storing fingerprints, THE Terminal_Registry SHALL hash the fingerprint using SHA-256 with a tenant-specific salt
3. WHEN a fingerprint changes more than 30% from the stored value, THE System SHALL flag it as potential device change
4. IF a fingerprint cannot be generated (browser restrictions), THEN THE System SHALL fall back to a reduced-entropy identifier and require Step_Up_Auth
5. WHEN comparing fingerprints, THE System SHALL calculate a similarity score (0-100) instead of exact match

### Requirement 2: Código de Activación para Device Binding

**User Story:** Como administrador, quiero poder vincular dispositivos físicos a terminales usando códigos de activación temporales, para tener control sobre qué dispositivos pueden operar como terminales.

#### Acceptance Criteria

1. WHEN an admin creates a new terminal, THE Terminal_Registry SHALL generate a 6-digit Activation_Code valid for 15 minutes
2. WHEN a device enters a valid Activation_Code, THE System SHALL bind the device fingerprint to that terminal_id permanently
3. WHEN an Activation_Code expires, THE System SHALL invalidate it and require generation of a new code
4. WHEN a device is already bound to a terminal, THE System SHALL reject attempts to bind it to another terminal
5. IF an Activation_Code is entered incorrectly 3 times, THEN THE System SHALL invalidate the code and log a security event
6. WHEN displaying Activation_Codes, THE Admin_Panel SHALL show them in format XXX-XXX for readability

### Requirement 3: Validación Server-Side de Terminales

**User Story:** Como arquitecto de seguridad, quiero que todas las validaciones de terminal se realicen en el servidor, para prevenir bypass de seguridad en el cliente.

#### Acceptance Criteria

1. WHEN a terminal attempts to authenticate, THE Server SHALL validate the terminal_id exists and is active
2. WHEN a terminal sends events, THE Server SHALL verify the device fingerprint matches the bound device (within drift tolerance)
3. IF a terminal is marked as disabled, THEN THE Server SHALL reject all requests from that terminal
4. WHEN fingerprint drift exceeds 50%, THE Server SHALL require re-activation with a new Activation_Code
5. WHEN a terminal authenticates from a new IP range, THE Server SHALL log a security event and optionally require Step_Up_Auth

### Requirement 4: Autenticación Multi-Factor Adaptativa

**User Story:** Como usuario del sistema, quiero que la autenticación sea rápida en condiciones normales pero más segura cuando se detectan anomalías, para balancear seguridad y usabilidad.

#### Acceptance Criteria

1. WHEN a user logs in from a known device with matching fingerprint, THE System SHALL require only PIN authentication
2. WHEN a user logs in from a device with fingerprint drift > 30%, THE System SHALL require PIN + confirmation de manager
3. WHEN a user logs in from an unbound device, THE System SHALL require Activation_Code + PIN + manager approval
4. WHEN calculating Risk_Score, THE System SHALL consider: fingerprint match, IP location, time of day, failed attempts
5. IF Risk_Score exceeds 70, THEN THE System SHALL require Step_Up_Auth regardless of other factors

### Requirement 5: Gestión de Sesiones Mejorada

**User Story:** Como operador de terminal, quiero que mi sesión se mantenga activa mientras trabajo pero se cierre automáticamente por inactividad, para proteger el sistema sin interrumpir mi trabajo.

#### Acceptance Criteria

1. WHEN a session is created, THE Session_Manager SHALL store it with encrypted token in sessionStorage
2. WHEN user activity is detected, THE Session_Manager SHALL update the last_activity timestamp
3. WHEN a session has been inactive for 15 minutes, THE Session_Manager SHALL automatically logout the user
4. WHEN a session is active, THE Session_Manager SHALL validate the fingerprint every 5 minutes
5. IF fingerprint validation fails during session, THEN THE Session_Manager SHALL require re-authentication
6. WHEN multiple sessions are detected for the same employee, THE System SHALL allow only the most recent session

### Requirement 6: Registro y Auditoría de Seguridad

**User Story:** Como administrador de seguridad, quiero tener un registro completo de todos los eventos de autenticación y cambios de terminal, para poder auditar y detectar anomalías.

#### Acceptance Criteria

1. WHEN any authentication event occurs, THE System SHALL log: timestamp, terminal_id, employee_id, result, risk_score, fingerprint_match
2. WHEN a terminal configuration changes, THE System SHALL log: who, what, when, previous_value, new_value
3. WHEN a security anomaly is detected, THE System SHALL create an alert visible in the Admin_Panel
4. WHEN querying audit logs, THE Admin_Panel SHALL support filtering by date, terminal, employee, event_type
5. THE System SHALL retain audit logs for minimum 90 days

### Requirement 7: Navegación y UX de Terminal Setup

**User Story:** Como usuario nuevo, quiero un flujo de configuración de terminal claro y sin errores de navegación, para poder empezar a trabajar rápidamente.

#### Acceptance Criteria

1. WHEN the app loads without terminal config, THE System SHALL show the Terminal_Setup screen directly on the root route (/)
2. WHEN a terminal is selected, THE System SHALL navigate directly to the role-specific route without intermediate screens
3. WHEN a terminal config exists, THE System SHALL show options to "Continue" or "Change Terminal" on the root route
4. WHEN navigating between routes, THE System SHALL use hard navigation (window.location) to avoid Next.js caching issues
5. IF navigation fails, THEN THE System SHALL show a clear error message with retry option
6. WHEN the user is on a protected route without auth, THE System SHALL redirect to root (/) not to a separate /setup route

### Requirement 8: Offline-First Terminal Authentication

**User Story:** Como operador en un ambiente con conectividad intermitente, quiero poder autenticarme y trabajar incluso sin conexión a internet, para no interrumpir las operaciones.

#### Acceptance Criteria

1. WHEN a terminal has been previously authenticated online, THE System SHALL cache credentials for offline use
2. WHEN authenticating offline, THE System SHALL validate PIN against locally cached hash
3. WHEN connection is restored, THE System SHALL sync any offline authentication events to the server
4. WHEN offline for more than 24 hours, THE System SHALL require online re-authentication
5. IF cached credentials are tampered with, THEN THE System SHALL require full online re-authentication
