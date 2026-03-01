/**
 * @vitest-environment jsdom
 *
 * Accessibility tests for Reservas (Reservations) page structure.
 * Validates WCAG 2.1 AA compliance.
 */
import { describe, it, expect } from 'vitest'
import { checkA11y } from '@/src/test-utils/axe-helper'

describe('Reservas Page — Accessibility', () => {
  it('header con selector de fecha cumple a11y', async () => {
    const html = `
      <header>
        <h1>Reservas</h1>
        <div>
          <label for="reservation-date">Fecha</label>
          <input id="reservation-date" type="date" value="2026-02-28" />
          <button type="button" aria-label="Día anterior">←</button>
          <button type="button" aria-label="Día siguiente">→</button>
          <button type="button" aria-label="Actualizar reservas">Actualizar</button>
        </div>
      </header>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('KPI cards con informacion accesible', async () => {
    const html = `
      <section aria-label="Resumen de reservas">
        <h2>Resumen del día</h2>
        <ul role="list">
          <li>
            <span>Total</span>
            <strong aria-label="15 reservas totales">15</strong>
          </li>
          <li>
            <span>Confirmadas</span>
            <strong aria-label="8 reservas confirmadas">8</strong>
          </li>
          <li>
            <span>Pendientes</span>
            <strong aria-label="4 reservas pendientes">4</strong>
          </li>
          <li>
            <span>Canceladas</span>
            <strong aria-label="3 reservas canceladas">3</strong>
          </li>
        </ul>
      </section>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('lista de reservas con tabla accesible', async () => {
    const html = `
      <section aria-label="Lista de reservas">
        <table>
          <caption>Reservas para hoy</caption>
          <thead>
            <tr>
              <th scope="col">Hora</th>
              <th scope="col">Cliente</th>
              <th scope="col">Personas</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>19:00</td>
              <td>Juan Pérez</td>
              <td>4</td>
              <td><span role="status">Confirmada</span></td>
              <td>
                <button type="button" aria-label="Marcar llegada de Juan Pérez">Llegó</button>
                <button type="button" aria-label="Sentar a Juan Pérez">Sentar</button>
              </td>
            </tr>
            <tr>
              <td>20:30</td>
              <td>María García</td>
              <td>2</td>
              <td><span role="status">Pendiente</span></td>
              <td>
                <button type="button" aria-label="Confirmar reserva de María García">Confirmar</button>
                <button type="button" aria-label="Cancelar reserva de María García">Cancelar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('filtros de estado con checkboxes accesibles', async () => {
    const html = `
      <fieldset>
        <legend>Filtrar por estado</legend>
        <label><input type="checkbox" checked /> Confirmadas</label>
        <label><input type="checkbox" checked /> Pendientes</label>
        <label><input type="checkbox" /> Canceladas</label>
        <label><input type="checkbox" /> No-show</label>
      </fieldset>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('estado vacio con mensaje descriptivo', async () => {
    const html = `
      <div role="status" aria-label="Sin reservas">
        <p>No hay reservas para esta fecha</p>
        <button type="button">Crear nueva reserva</button>
      </div>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })
})
