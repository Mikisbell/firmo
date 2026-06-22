// src/core/config/terminal.ts
// Adaptador delgado sobre la AUTORIDAD UNICA de identidad de dev (dev-identity.ts).
// Mantiene los terminal_id historicos que consumen las pantallas KDS, pero la identidad
// real (tenant, empleado, rol) la resuelve dev-identity para que NO existan dos tablas de
// estaciones que puedan driftear.

import type { TerminalConfig } from '@/src/core/auth/types';
import { getDevTerminalConfig, type DevStationKey } from './dev-identity';

// Tenant ID demo (coincide con el seed). Lo consumen rutas/paginas admin que aun no
// derivan el tenant de la sesion (inventario, diagnostics, login-secure, confirm-device).
export const DEFAULT_TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID
    || "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

/**
 * Mapeo terminal_id legacy -> estacion de la autoridad unica.
 * Solo los SPC_* los consumen hoy las pantallas KDS; el resto se mantiene por compatibilidad.
 */
const TERMINAL_TO_STATION = {
    CAJA_01: 'CAJA',
    MOZO_01: 'MOZO',
    MOZO_02: 'MOZO',
    SPC_COCINA: 'COCINA',
    SPC_HORNO: 'HORNO',
    SPC_BAR: 'BAR',
    SPC_EMPAQUE: 'EMPAQUE',
} as const satisfies Record<string, DevStationKey>;

export type TerminalId = keyof typeof TERMINAL_TO_STATION;

/**
 * Obtiene la configuración de un terminal, resuelta desde la autoridad unica de dev.
 * El terminal_id, tenant, empleado (actor) y rol quedan coherentes con el seed.
 */
export function getTerminalConfig(terminalId: TerminalId): TerminalConfig {
    return getDevTerminalConfig(TERMINAL_TO_STATION[terminalId]);
}
