// src/core/config/dev-identity.ts
/**
 * AUTORIDAD UNICA de identidad de DESARROLLO.
 *
 * En produccion la identidad sale del apareo de dispositivo (terminal_devices +
 * activation_codes) + login de empleado por PIN (sesion JWT). En DEV no nos logueamos,
 * pero TODO debe estar DEFINIDO y COHERENTE: cada estacion abre con su dispositivo, su
 * empleado real y su rol — igual que el seed (tenant a1b2c3d4 "Polleria El Sabroson").
 *
 * Esta es la fuente unica que ESPEJA el seed. Antes la identidad de dev estaba partida en
 * 6 mecanismos que se contradecian (AuthProvider, useRequireTerminal, mozo/mesa, KDS,
 * inventario, admin) -> tenants fantasma, empleado != rol, CHANNEL_ERROR de Realtime.
 * Todos los puntos de entrada de dev deben resolver desde aqui.
 *
 * Es la semilla del dispatcher de produccion: misma estructura (estacion -> terminal_role +
 * empleado), pero en prod viene de terminal_devices.role + el empleado logueado.
 *
 * @module core/config/dev-identity
 */
import type { TerminalConfig } from '@/src/core/auth/types';
import type { TerminalRole as ConfigTerminalRole } from '@/src/core/constants/roles';
import type {
  SecureSession,
  EmployeeRole,
  TerminalRole as SessionTerminalRole,
} from '@/src/core/auth/session-v2';
import { getTenantId } from './tenant';
import { DEFAULT_LOCATION_ID } from './location';
import { DEFAULT_EMPLOYEE_IDS, DEFAULT_EMPLOYEES } from './employees';

/** Estaciones de dev. Cada una mapea a un dispositivo + empleado real del seed. */
export type DevStationKey =
  | 'CAJA'
  | 'MOZO'
  | 'COCINA'
  | 'HORNO'
  | 'EMPAQUE'
  | 'BAR'
  | 'DISPLAY'
  | 'DRIVER'
  | 'INVENTARIO'
  | 'EMPLOYEE'
  | 'ADMIN';

interface DevStation {
  /** terminal_id del dispositivo (coincide con prisma/seed.ts). */
  terminal_id: string;
  /** Empleado real del seed que opera la estacion (actor_id de los eventos). */
  employeeId: string;
  /** terminal_role en el vocabulario legacy de la sesion (DB terminal_devices.role). */
  sessionTerminalRole: SessionTerminalRole;
}

/**
 * Registro canonico estacion -> dispositivo + empleado. Los IDs coinciden con el seed
 * (DEFAULT_EMPLOYEE_IDS / prisma/seed.ts), de modo que los eventos tengan un actor valido
 * y el tenant/location sean los reales del tenant demo.
 */
const STATIONS: Record<DevStationKey, DevStation> = {
  CAJA: { terminal_id: 'CAJA_01', employeeId: DEFAULT_EMPLOYEE_IDS.CASHIER_MARIA, sessionTerminalRole: 'CAJA' },
  MOZO: { terminal_id: 'MOZO_01', employeeId: DEFAULT_EMPLOYEE_IDS.WAITER_CARLOS, sessionTerminalRole: 'MOZO' },
  COCINA: { terminal_id: 'SPC_COCINA', employeeId: DEFAULT_EMPLOYEE_IDS.KITCHEN_LUIS, sessionTerminalRole: 'KDS_COCINA' },
  HORNO: { terminal_id: 'SPC_HORNO', employeeId: DEFAULT_EMPLOYEE_IDS.PARRILLA_PEDRO, sessionTerminalRole: 'KDS_HORNO' },
  EMPAQUE: { terminal_id: 'SPC_EMPAQUE', employeeId: DEFAULT_EMPLOYEE_IDS.KITCHEN_LUIS, sessionTerminalRole: 'KDS_COCINA' },
  BAR: { terminal_id: 'SPC_BAR', employeeId: DEFAULT_EMPLOYEE_IDS.BAR_JORGE, sessionTerminalRole: 'KDS_BAR' },
  // Display/KDS de solo lectura: contexto de caja, sin escribir eventos.
  DISPLAY: { terminal_id: 'CAJA_01', employeeId: DEFAULT_EMPLOYEE_IDS.CASHIER_MARIA, sessionTerminalRole: 'CAJA' },
  // Driver y back-office no tienen un terminal_role legacy propio; usan CAJA como neutro
  // (en dev el RoleGuard esta abierto; el rol real vive en employee_role).
  DRIVER: { terminal_id: 'MOZO_02', employeeId: DEFAULT_EMPLOYEE_IDS.DELIVERY_MIGUEL, sessionTerminalRole: 'CAJA' },
  INVENTARIO: { terminal_id: 'CAJA_01', employeeId: DEFAULT_EMPLOYEE_IDS.MANAGER_ROSA, sessionTerminalRole: 'CAJA' },
  EMPLOYEE: { terminal_id: 'CAJA_01', employeeId: DEFAULT_EMPLOYEE_IDS.CASHIER_MARIA, sessionTerminalRole: 'CAJA' },
  ADMIN: { terminal_id: 'CAJA_01', employeeId: DEFAULT_EMPLOYEE_IDS.ADMIN, sessionTerminalRole: 'CAJA' },
};

/** Empleado del seed por id (nombre + rol coherentes con la estacion). */
function getSeedEmployee(employeeId: string): { id: string; name: string; role: EmployeeRole } {
  const emp = DEFAULT_EMPLOYEES.find((e) => e.id === employeeId);
  if (!emp) {
    // Programacion: una estacion apunta a un empleado que no esta en el seed.
    throw new Error(`dev-identity: empleado ${employeeId} no existe en DEFAULT_EMPLOYEES`);
  }
  return { id: emp.id, name: emp.name, role: emp.role as EmployeeRole };
}

/** employee_role -> terminal_role canonico (ingles) de TerminalConfig.role. */
function toConfigTerminalRole(role: EmployeeRole): ConfigTerminalRole {
  switch (role) {
    case 'CASHIER':
      return 'CASHIER';
    case 'WAITER':
      return 'WAITER';
    case 'KITCHEN':
    case 'COOK':
    case 'PACKER':
      return 'KDS';
    case 'BAR':
      return 'BAR';
    default:
      // OWNER | ADMIN | MANAGER | SUPERVISOR | DRIVER -> back-office/neutro
      return 'ADMIN';
  }
}

/**
 * Normaliza un valor crudo de localStorage a una estacion. Acepta una DevStationKey directa
 * o, por compatibilidad, un rol de empleado (lo que el launcher guardaba antes en 'dev_role').
 */
export function resolveDevStation(raw: string | null | undefined): DevStationKey {
  if (!raw) return 'CAJA';
  const v = raw.toUpperCase();
  if (v in STATIONS) return v as DevStationKey;
  // Compatibilidad con 'dev_role' legacy (rol de empleado -> estacion por defecto).
  switch (v) {
    case 'CASHIER':
      return 'CAJA';
    case 'WAITER':
      return 'MOZO';
    case 'COOK':
    case 'KITCHEN':
      return 'HORNO';
    case 'PACKER':
      return 'EMPAQUE';
    case 'BAR':
      return 'BAR';
    case 'DRIVER':
      return 'DRIVER';
    case 'MANAGER':
    case 'SUPERVISOR':
      return 'INVENTARIO';
    case 'OWNER':
    case 'ADMIN':
      return 'ADMIN';
    default:
      return 'CAJA';
  }
}

/** Construye el TerminalConfig (identidad del DISPOSITIVO) de una estacion de dev. */
export function getDevTerminalConfig(station: DevStationKey): TerminalConfig {
  const s = STATIONS[station];
  const emp = getSeedEmployee(s.employeeId);
  return {
    terminal_id: s.terminal_id,
    tenant_id: getTenantId(),
    actor_id: emp.id,
    device_fingerprint: `dev-${station.toLowerCase()}-fingerprint`,
    device_name: `Dev ${station} Terminal`,
    role: toConfigTerminalRole(emp.role),
    location_id: DEFAULT_LOCATION_ID,
    is_allowed: true,
    registered_at: new Date().toISOString(),
  };
}

/** Construye la SecureSession (identidad del EMPLEADO) de una estacion de dev. */
export function getDevSession(station: DevStationKey): SecureSession {
  const s = STATIONS[station];
  const emp = getSeedEmployee(s.employeeId);
  const now = new Date();
  return {
    id: `dev-session-${station.toLowerCase()}`,
    terminal_id: s.terminal_id,
    employee_id: emp.id,
    employee_name: emp.name,
    employee_role: emp.role,
    terminal_role: s.sessionTerminalRole,
    fingerprint_at_login: `dev-${station.toLowerCase()}-fingerprint`,
    fingerprint_signals_at_login: JSON.stringify({ dev: true, station }),
    risk_score_at_login: 0,
    created_at: now,
    last_activity_at: now,
    last_fingerprint_check: now,
    expires_at: new Date(now.getTime() + 8 * 60 * 60 * 1000),
  };
}

/** Identidad de dev completa (dispositivo + sesion) coherente para una estacion. */
export function getDevIdentity(station: DevStationKey): {
  terminal: TerminalConfig;
  session: SecureSession;
} {
  return { terminal: getDevTerminalConfig(station), session: getDevSession(station) };
}
