/**
 * Onboarding Steps — Single Source of Truth
 *
 * Defines the 6 onboarding steps for new tenants.
 * Used by both provisioning (atomic creation) and onboarding service (CRUD).
 *
 * Requirements: F1.1 — Single source of truth for onboarding steps
 */

/**
 * Unified onboarding steps constant.
 * All titles and descriptions in Spanish.
 * Steps: CONFIGURE_BASIC_INFO, CREATE_EMPLOYEE, CREATE_PRODUCT,
 *         CONFIGURE_STATIONS, ACTIVATE_TERMINAL, CONFIGURE_PAYMENT_METHODS
 */
export const ONBOARDING_STEPS = [
  {
    step_number: 1,
    step_key: 'CONFIGURE_BASIC_INFO',
    title: 'Configurar Información del Negocio',
    description: 'Completa los datos de tu restaurante (nombre, RUC, dirección)',
    is_required: true,
    route: '/admin/configuracion',
  },
  {
    step_number: 2,
    step_key: 'CREATE_EMPLOYEE',
    title: 'Crear Empleados',
    description: 'Agrega al menos un empleado además del administrador',
    is_required: true,
    route: '/admin/empleados',
  },
  {
    step_number: 3,
    step_key: 'CREATE_PRODUCT',
    title: 'Crear Productos',
    description: 'Agrega los productos que venderás (pollos, bebidas, etc.)',
    is_required: true,
    route: '/admin/productos',
  },
  {
    step_number: 4,
    step_key: 'CONFIGURE_STATIONS',
    title: 'Configurar Estaciones',
    description: 'Configura las estaciones de cocina (parrilla, cocina, bar)',
    is_required: false,
    route: '/admin/estaciones',
  },
  {
    step_number: 5,
    step_key: 'ACTIVATE_TERMINAL',
    title: 'Activar Terminal',
    description: 'Activa tu terminal POS con el código de activación',
    is_required: true,
    route: '/admin/terminales',
  },
  {
    step_number: 6,
    step_key: 'CONFIGURE_PAYMENT_METHODS',
    title: 'Configurar Métodos de Pago',
    description: 'Configura los métodos de pago que acepta tu restaurante',
    is_required: false,
    route: '/admin/configuracion',
  },
] as const;

/**
 * Type derived from the ONBOARDING_STEPS constant.
 * Valid step keys: CONFIGURE_BASIC_INFO | CREATE_EMPLOYEE | CREATE_PRODUCT | etc.
 */
export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number]['step_key'];
