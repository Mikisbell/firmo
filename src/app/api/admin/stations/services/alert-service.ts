/**
 * Alert Generation Service for KDS Stations
 * 
 * Checks station metrics against thresholds and generates alerts
 * with appropriate severity levels.
 * 
 * Requirements: 2.3.1, 2.3.2, 2.3.3, 2.3.4
 */

import prisma from '@/src/core/db/prisma';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type MetricType = 'AVG_TIME' | 'LOAD' | 'EFFICIENCY';

export interface StationMetrics {
  activeOrders: number;
  avgTime: number; // in minutes
  efficiency: number; // percentage 0-100
  load: number; // percentage 0-100
}

export interface AlertRule {
  metricType: MetricType;
  severity: AlertSeverity;
  threshold: number;
  operator: '>' | '<';
  message: (stationName: string, value: number, threshold: number) => string;
}

export interface GeneratedAlert {
  stationId: string;
  message: string;
  severity: AlertSeverity;
  metricType: MetricType;
  metricValue: number;
  threshold: number;
}

/**
 * Alert rules ordered by severity (HIGH -> MEDIUM -> LOW)
 * First matching rule wins
 */
const ALERT_RULES: AlertRule[] = [
  // HIGH SEVERITY RULES
  {
    metricType: 'AVG_TIME',
    severity: 'HIGH',
    threshold: 1.5, // 1.5x estimated time
    operator: '>',
    message: (name, value, threshold) =>
      `🔴 ${name}: Tiempo promedio crítico (${value.toFixed(1)} min, ${(threshold * 100).toFixed(0)}% sobre estimado)`,
  },
  {
    metricType: 'LOAD',
    severity: 'HIGH',
    threshold: 90, // 90% capacity
    operator: '>',
    message: (name, value) =>
      `🔴 ${name}: Carga crítica (${value.toFixed(0)}% de capacidad)`,
  },
  {
    metricType: 'EFFICIENCY',
    severity: 'HIGH',
    threshold: 60, // < 60% efficiency
    operator: '<',
    message: (name, value) =>
      `🔴 ${name}: Eficiencia crítica (${value.toFixed(0)}%)`,
  },

  // MEDIUM SEVERITY RULES
  {
    metricType: 'AVG_TIME',
    severity: 'MEDIUM',
    threshold: 1.2, // 1.2x estimated time
    operator: '>',
    message: (name, value, threshold) =>
      `🟡 ${name}: Tiempo promedio elevado (${value.toFixed(1)} min, ${(threshold * 100).toFixed(0)}% sobre estimado)`,
  },
  {
    metricType: 'LOAD',
    severity: 'MEDIUM',
    threshold: 80, // 80% capacity
    operator: '>',
    message: (name, value) =>
      `🟡 ${name}: Carga alta (${value.toFixed(0)}% de capacidad)`,
  },
  {
    metricType: 'EFFICIENCY',
    severity: 'MEDIUM',
    threshold: 70, // < 70% efficiency
    operator: '<',
    message: (name, value) =>
      `🟡 ${name}: Eficiencia baja (${value.toFixed(0)}%)`,
  },

  // LOW SEVERITY RULES
  {
    metricType: 'AVG_TIME',
    severity: 'LOW',
    threshold: 1.0, // 1.0x estimated time
    operator: '>',
    message: (name, value) =>
      `ℹ️ ${name}: Tiempo promedio sobre estimado (${value.toFixed(1)} min)`,
  },
  {
    metricType: 'LOAD',
    severity: 'LOW',
    threshold: 60, // 60% capacity
    operator: '>',
    message: (name, value) =>
      `ℹ️ ${name}: Carga moderada (${value.toFixed(0)}% de capacidad)`,
  },
  {
    metricType: 'EFFICIENCY',
    severity: 'LOW',
    threshold: 85, // < 85% efficiency
    operator: '<',
    message: (name, value) =>
      `ℹ️ ${name}: Eficiencia mejorable (${value.toFixed(0)}%)`,
  },
];

/**
 * Check if a metric value triggers an alert rule
 */
function checkRule(rule: AlertRule, value: number, estimatedTime: number): boolean {
  const threshold = rule.metricType === 'AVG_TIME' 
    ? rule.threshold * estimatedTime 
    : rule.threshold;

  if (rule.operator === '>') {
    return value > threshold;
  } else {
    return value < threshold;
  }
}

/**
 * Check all alert rules for a station and generate alerts
 * 
 * @param stationId - Station ID
 * @param stationName - Station name for messages
 * @param metrics - Current station metrics
 * @param estimatedTime - Station's estimated time in minutes
 * @returns Array of generated alerts
 */
export function checkAlertRules(
  stationId: string,
  stationName: string,
  metrics: StationMetrics,
  estimatedTime: number
): GeneratedAlert[] {
  const alerts: GeneratedAlert[] = [];

  // Check each metric type (only generate one alert per metric type - highest severity)
  const metricTypes: MetricType[] = ['AVG_TIME', 'LOAD', 'EFFICIENCY'];
  
  for (const metricType of metricTypes) {
    const metricValue = 
      metricType === 'AVG_TIME' ? metrics.avgTime :
      metricType === 'LOAD' ? metrics.load :
      metrics.efficiency;

    // Find first matching rule for this metric type
    const matchingRule = ALERT_RULES.find(
      rule => rule.metricType === metricType && checkRule(rule, metricValue, estimatedTime)
    );

    if (matchingRule) {
      const threshold = matchingRule.metricType === 'AVG_TIME'
        ? matchingRule.threshold * estimatedTime
        : matchingRule.threshold;

      alerts.push({
        stationId,
        message: matchingRule.message(stationName, metricValue, matchingRule.threshold),
        severity: matchingRule.severity,
        metricType: matchingRule.metricType,
        metricValue,
        threshold,
      });
    }
  }

  return alerts;
}

/**
 * Generate and persist alerts for a station
 * 
 * @param tenantId - Tenant ID
 * @param stationId - Station ID
 * @param metrics - Current station metrics
 * @returns Array of created alert records
 */
export async function generateAlertsForStation(
  tenantId: string,
  stationId: string,
  metrics: StationMetrics
): Promise<any[]> {
  // Get station info
  const station = await prisma.stations.findUnique({
    where: { id: stationId },
    select: { name: true, estimated_time: true },
  });

  if (!station) {
    throw new Error(`Station ${stationId} not found`);
  }

  // Check alert rules
  const generatedAlerts = checkAlertRules(
    stationId,
    station.name,
    metrics,
    station.estimated_time
  );

  if (generatedAlerts.length === 0) {
    return [];
  }

  // Check for existing non-dismissed alerts of the same type
  const existingAlerts = await prisma.station_alerts.findMany({
    where: {
      station_id: stationId,
      is_dismissed: false,
      metric_type: {
        in: generatedAlerts.map(a => a.metricType),
      },
    },
    select: { metric_type: true },
  });

  const existingMetricTypes = new Set(existingAlerts.map((a: any) => a.metric_type));

  // Only create alerts for metric types that don't have existing non-dismissed alerts
  const alertsToCreate = generatedAlerts.filter(
    alert => !existingMetricTypes.has(alert.metricType)
  );

  if (alertsToCreate.length === 0) {
    return [];
  }

  // Create alerts in database
  const createdAlerts = await Promise.all(
    alertsToCreate.map(alert =>
      prisma.station_alerts.create({
        data: {
          tenant_id: tenantId,
          station_id: alert.stationId,
          message: alert.message,
          severity: alert.severity,
          metric_type: alert.metricType,
          metric_value: alert.metricValue,
          threshold_value: alert.threshold,
          is_dismissed: false,
        },
      })
    )
  );

  return createdAlerts;
}

/**
 * Check and generate alerts for all active stations
 * 
 * @param tenantId - Tenant ID
 * @returns Total number of alerts generated
 */
export async function generateAlertsForAllStations(tenantId: string): Promise<number> {
  // This would typically be called by a background job
  // For now, it's a placeholder for future implementation
  
  const stations = await prisma.stations.findMany({
    where: {
      tenant_id: tenantId,
      is_active: true,
    },
    select: { id: true },
  });

  let totalAlerts = 0;

  for (const station of stations) {
    // Would need to calculate metrics for each station
    // and call generateAlertsForStation
    // This is left as a future enhancement
  }

  return totalAlerts;
}
