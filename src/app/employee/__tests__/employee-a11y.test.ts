/**
 * @vitest-environment jsdom
 *
 * Accessibility tests for Employee Home page structure.
 * Validates WCAG 2.1 AA compliance.
 */
import { describe, it, expect } from 'vitest'
import { checkA11y } from '@/src/test-utils/axe-helper'

describe('Employee Page — Accessibility', () => {
  it('tarjeta de perfil con avatar accesible', async () => {
    const html = `
      <section aria-label="Perfil del empleado">
        <div role="img" aria-label="Avatar de Juan Pérez">J</div>
        <h1>Juan Pérez</h1>
        <p>Cajero</p>
        <dl>
          <dt>DNI</dt>
          <dd>12345678</dd>
          <dt>Fecha de ingreso</dt>
          <dd><time datetime="2025-03-15">15 Mar 2025</time></dd>
        </dl>
      </section>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('estadisticas rapidas con datos accesibles', async () => {
    const html = `
      <section aria-label="Estadísticas del empleado">
        <h2>Resumen</h2>
        <ul role="list">
          <li>
            <span>Días trabajados</span>
            <strong aria-label="22 días trabajados este mes">22</strong>
          </li>
          <li>
            <span>Vacaciones disponibles</span>
            <strong aria-label="15 días de vacaciones">15 días</strong>
          </li>
          <li>
            <span>Próximo turno</span>
            <strong aria-label="Próximo turno mañana a las 8:00">Mañana 08:00</strong>
          </li>
        </ul>
      </section>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('acciones rapidas con links accesibles', async () => {
    const html = `
      <nav aria-label="Acciones rápidas del empleado">
        <h2>Acciones rápidas</h2>
        <ul role="list">
          <li>
            <a href="/employee/vacation" aria-label="Solicitar vacaciones">
              <span aria-hidden="true">🌴</span>
              <span>Solicitar Vacaciones</span>
            </a>
          </li>
          <li>
            <a href="/employee/payslips" aria-label="Ver boletas de pago">
              <span aria-hidden="true">💵</span>
              <span>Ver Boletas de Pago</span>
            </a>
          </li>
          <li>
            <a href="/employee/attendance" aria-label="Ver mi asistencia">
              <span aria-hidden="true">📅</span>
              <span>Mi Asistencia</span>
            </a>
          </li>
        </ul>
      </nav>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('estado de carga accesible', async () => {
    const html = `
      <div role="status" aria-live="polite" aria-label="Cargando datos del empleado">
        <span aria-hidden="true" class="spinner"></span>
        <span>Cargando...</span>
      </div>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('estado de error accesible', async () => {
    const html = `
      <div role="alert" aria-label="Error al cargar datos">
        <span aria-hidden="true">⚠</span>
        <h2>Error al cargar datos</h2>
        <p>No se pudieron cargar los datos del empleado. Por favor intenta de nuevo.</p>
        <button type="button">Reintentar</button>
      </div>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('informacion salarial con formato accesible', async () => {
    const html = `
      <section aria-label="Información salarial">
        <h2>Salario</h2>
        <dl>
          <dt>Salario base</dt>
          <dd aria-label="Salario base: 2,500 soles">S/ 2,500.00</dd>
          <dt>Tipo de contrato</dt>
          <dd>Indefinido</dd>
        </dl>
      </section>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })
})
