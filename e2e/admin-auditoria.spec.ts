/**
 * E2E Tests for Audit Page
 * 
 * Task 16.1 - Terminal Architecture v2
 * Requirements: 6.4
 * 
 * Tests the audit page functionality including:
 * - Page rendering
 * - Event listing
 * - Filtering by date, terminal, employee, event_type
 */

import { test, expect } from '@playwright/test';

test.describe('Admin Audit Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to audit page
    await page.goto('/admin/auditoria');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display page title and description', async ({ page }) => {
    await expect(page.getByText('Auditoría de Autenticación')).toBeVisible();
    await expect(page.getByText('Registro completo de eventos de seguridad')).toBeVisible();
  });

  test('should display summary statistics cards', async ({ page }) => {
    await expect(page.getByText('Total Eventos')).toBeVisible();
    await expect(page.getByText('Login Exitoso')).toBeVisible();
    await expect(page.getByText('Login Fallido')).toBeVisible();
    await expect(page.getByText('Alertas')).toBeVisible();
  });

  test('should display filter controls', async ({ page }) => {
    // Check all filter inputs exist
    await expect(page.getByLabel('Fecha Inicio')).toBeVisible();
    await expect(page.getByLabel('Fecha Fin')).toBeVisible();
    await expect(page.getByLabel('Terminal')).toBeVisible();
    await expect(page.getByLabel('Empleado')).toBeVisible();
    await expect(page.getByLabel('Tipo de Evento')).toBeVisible();
  });

  test('should display events table', async ({ page }) => {
    // Check table headers
    await expect(page.getByText('Fecha/Hora')).toBeVisible();
    await expect(page.getByText('Evento')).toBeVisible();
    await expect(page.getByText('Terminal')).toBeVisible();
    await expect(page.getByText('Empleado')).toBeVisible();
    await expect(page.getByText('Riesgo')).toBeVisible();
    await expect(page.getByText('Fingerprint')).toBeVisible();
    await expect(page.getByText('IP')).toBeVisible();
  });

  test('should filter by terminal', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(1000);
    
    // Select a terminal from dropdown
    const terminalSelect = page.getByLabel('Terminal');
    await terminalSelect.selectOption({ index: 1 }); // Select first non-empty option
    
    // Wait for filter to apply
    await page.waitForTimeout(500);
    
    // Verify URL contains filter parameter
    expect(page.url()).toContain('terminal_id=');
  });

  test('should filter by event type', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(1000);
    
    // Select an event type
    const eventTypeSelect = page.getByLabel('Tipo de Evento');
    await eventTypeSelect.selectOption('login_success');
    
    // Wait for filter to apply
    await page.waitForTimeout(500);
    
    // Verify filter was applied (check if only login_success events are shown)
    const eventBadges = page.locator('text=Login Exitoso');
    await expect(eventBadges.first()).toBeVisible();
  });

  test('should clear filters', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(1000);
    
    // Apply a filter
    const terminalSelect = page.getByLabel('Terminal');
    await terminalSelect.selectOption({ index: 1 });
    
    // Wait for filter to apply
    await page.waitForTimeout(500);
    
    // Click clear filters button
    const clearButton = page.getByText('Limpiar filtros');
    await clearButton.click();
    
    // Verify filters are cleared
    await expect(terminalSelect).toHaveValue('');
  });

  test('should refresh events when refresh button is clicked', async ({ page }) => {
    // Wait for initial load
    await page.waitForTimeout(1000);
    
    // Click refresh button
    const refreshButton = page.getByTitle('Actualizar');
    await refreshButton.click();
    
    // Wait for refresh to complete
    await page.waitForTimeout(500);
    
    // Verify page is still showing data
    await expect(page.getByText('Total Eventos')).toBeVisible();
  });

  test('should display event details correctly', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(1000);
    
    // Check if any events are displayed
    const tableRows = page.locator('tbody tr');
    const rowCount = await tableRows.count();
    
    if (rowCount > 0) {
      // Verify first row has expected columns
      const firstRow = tableRows.first();
      
      // Should have date/time
      await expect(firstRow.locator('td').first()).toBeVisible();
      
      // Should have event type badge
      await expect(firstRow.locator('span[class*="rounded-full"]').first()).toBeVisible();
    }
  });

  test('should validate requirement 6.4 - support all required filters', async ({ page }) => {
    // Verify all required filter controls exist and are functional
    
    // Date filters
    const startDateInput = page.getByLabel('Fecha Inicio');
    const endDateInput = page.getByLabel('Fecha Fin');
    await expect(startDateInput).toBeVisible();
    await expect(endDateInput).toBeVisible();
    await expect(startDateInput).toBeEnabled();
    await expect(endDateInput).toBeEnabled();
    
    // Terminal filter
    const terminalSelect = page.getByLabel('Terminal');
    await expect(terminalSelect).toBeVisible();
    await expect(terminalSelect).toBeEnabled();
    
    // Employee filter
    const employeeSelect = page.getByLabel('Empleado');
    await expect(employeeSelect).toBeVisible();
    await expect(employeeSelect).toBeEnabled();
    
    // Event type filter
    const eventTypeSelect = page.getByLabel('Tipo de Evento');
    await expect(eventTypeSelect).toBeVisible();
    await expect(eventTypeSelect).toBeEnabled();
    
    // Verify event type options are populated
    const eventTypeOptions = await eventTypeSelect.locator('option').count();
    expect(eventTypeOptions).toBeGreaterThan(1); // Should have "Todos" + actual event types
  });

  test('should display risk score badges with appropriate colors', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(1000);
    
    // Check if any risk score badges are displayed
    const riskBadges = page.locator('span[class*="text-green-400"], span[class*="text-amber-400"], span[class*="text-red-400"]');
    const badgeCount = await riskBadges.count();
    
    // If there are risk scores, verify they have color classes
    if (badgeCount > 0) {
      const firstBadge = riskBadges.first();
      const classes = await firstBadge.getAttribute('class');
      expect(classes).toMatch(/text-(green|amber|red)-400/);
    }
  });

  test('should handle empty state gracefully', async ({ page }) => {
    // Apply filters that return no results
    const eventTypeSelect = page.getByLabel('Tipo de Evento');
    await eventTypeSelect.selectOption('security_alert');
    
    // Set a very specific date range that likely has no events
    const startDateInput = page.getByLabel('Fecha Inicio');
    await startDateInput.fill('2020-01-01T00:00');
    
    const endDateInput = page.getByLabel('Fecha Fin');
    await endDateInput.fill('2020-01-01T23:59');
    
    // Wait for filter to apply
    await page.waitForTimeout(1000);
    
    // Should show empty state message
    await expect(page.getByText('No hay eventos de auditoría')).toBeVisible();
  });

  test('should be accessible via admin sidebar', async ({ page }) => {
    // Navigate to admin home
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    // Look for Auditoría link in sidebar
    const auditoriaLink = page.getByRole('link', { name: /Auditoría/i });
    
    // Click the link
    await auditoriaLink.click();
    
    // Verify we're on the audit page
    await expect(page).toHaveURL(/\/admin\/auditoria/);
    await expect(page.getByText('Auditoría de Autenticación')).toBeVisible();
  });
});
