/**
 * Business Date Utilities
 * 
 * Maneja la conversión de fechas UTC a fechas de negocio
 * considerando la zona horaria del tenant (America/Lima por defecto).
 * 
 * Regla: El día de negocio termina a las 6:00 AM del día siguiente.
 * Venta a las 2:00 AM del 6 de enero → business_date = 5 de enero
 */

// Hora de corte del día de negocio (6 AM)
const BUSINESS_DAY_CUTOFF_HOUR = 6;

// Timezone por defecto para Perú
const DEFAULT_TIMEZONE = "America/Lima";

/**
 * Convierte una fecha UTC a la zona horaria especificada
 */
export function toZonedTime(date: Date | string, timezone: string = DEFAULT_TIMEZONE): Date {
    const d = typeof date === 'string' ? new Date(date) : date;
    
    // Usar Intl.DateTimeFormat para obtener los componentes en la zona horaria
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });

    const parts = formatter.formatToParts(d);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '0';

    return new Date(
        parseInt(get('year')),
        parseInt(get('month')) - 1,
        parseInt(get('day')),
        parseInt(get('hour')),
        parseInt(get('minute')),
        parseInt(get('second'))
    );
}

/**
 * Obtiene la fecha de negocio para un evento
 * 
 * Si la hora es antes de las 6 AM, pertenece al día anterior.
 * Esto permite que ventas de madrugada se contabilicen en el día correcto.
 * 
 * @param occurredAt - Fecha/hora del evento (UTC o con timezone)
 * @param timezone - Zona horaria del tenant (default: America/Lima)
 * @returns Fecha de negocio en formato YYYY-MM-DD
 */
export function getBusinessDate(
    occurredAt: Date | string,
    timezone: string = DEFAULT_TIMEZONE
): string {
    const zonedDate = toZonedTime(occurredAt, timezone);
    const hour = zonedDate.getHours();

    // Si es antes de las 6 AM, pertenece al día anterior
    if (hour < BUSINESS_DAY_CUTOFF_HOUR) {
        zonedDate.setDate(zonedDate.getDate() - 1);
    }

    // Formatear como YYYY-MM-DD
    const year = zonedDate.getFullYear();
    const month = String(zonedDate.getMonth() + 1).padStart(2, '0');
    const day = String(zonedDate.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * Obtiene la fecha de negocio actual
 */
export function getCurrentBusinessDate(timezone: string = DEFAULT_TIMEZONE): string {
    return getBusinessDate(new Date(), timezone);
}

/**
 * Verifica si una fecha/hora está dentro del día de negocio actual
 */
export function isCurrentBusinessDay(
    occurredAt: Date | string,
    timezone: string = DEFAULT_TIMEZONE
): boolean {
    const eventBusinessDate = getBusinessDate(occurredAt, timezone);
    const currentBusinessDate = getCurrentBusinessDate(timezone);
    return eventBusinessDate === currentBusinessDate;
}

/**
 * Obtiene el inicio del día de negocio (6 AM del día)
 */
export function getBusinessDayStart(
    businessDate: string,
    _timezone: string = DEFAULT_TIMEZONE
): Date {
    const [year, month, day] = businessDate.split('-').map(Number);
    
    // El día de negocio empieza a las 6 AM
    const start = new Date(year, month - 1, day, BUSINESS_DAY_CUTOFF_HOUR, 0, 0);
    
    return start;
}

/**
 * Obtiene el fin del día de negocio (5:59:59 AM del día siguiente)
 */
export function getBusinessDayEnd(
    businessDate: string,
    _timezone: string = DEFAULT_TIMEZONE
): Date {
    const [year, month, day] = businessDate.split('-').map(Number);
    
    // El día de negocio termina a las 5:59:59 AM del día siguiente
    const end = new Date(year, month - 1, day + 1, BUSINESS_DAY_CUTOFF_HOUR - 1, 59, 59);
    
    return end;
}

/**
 * Formatea una fecha para mostrar en la UI
 */
export function formatDisplayDate(
    date: Date | string,
    timezone: string = DEFAULT_TIMEZONE,
    options?: Intl.DateTimeFormatOptions
): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        ...options,
    };

    return new Intl.DateTimeFormat('es-PE', defaultOptions).format(d);
}

/**
 * Formatea una hora para mostrar en la UI
 */
export function formatDisplayTime(
    date: Date | string,
    timezone: string = DEFAULT_TIMEZONE
): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    
    return new Intl.DateTimeFormat('es-PE', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    }).format(d);
}
