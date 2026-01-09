// src/core/domain/stations.ts
// Centralización de estaciones de cocina

export const STATIONS = {
    PARRILLA: "PARRILLA",
    COCINA: "COCINA",
    FRIOS: "FRIOS",
    POSTRES: "POSTRES",
    FREIDORA: "FREIDORA",
    BAR: "BAR",
} as const;

export type StationCode = typeof STATIONS[keyof typeof STATIONS];

// Grupos de estaciones por pantalla KDS
export const STATION_GROUPS = {
    HORNO: [STATIONS.PARRILLA] as StationCode[],
    COCINA: [STATIONS.COCINA, STATIONS.FRIOS, STATIONS.POSTRES, STATIONS.FREIDORA] as StationCode[],
    BAR: [STATIONS.BAR] as StationCode[],
} as const;

export type StationGroup = keyof typeof STATION_GROUPS;

// Validar si una estación existe
export function isValidStation(station: string): station is StationCode {
    return Object.values(STATIONS).includes(station as StationCode);
}

// Obtener grupo de una estación
export function getStationGroup(station: StationCode): StationGroup | null {
    for (const [group, stations] of Object.entries(STATION_GROUPS)) {
        if ((stations as readonly string[]).includes(station)) {
            return group as StationGroup;
        }
    }
    return null;
}
