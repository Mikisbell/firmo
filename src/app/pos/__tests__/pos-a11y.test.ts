/**
 * @vitest-environment jsdom
 *
 * Accessibility tests for POS page structure.
 * Validates WCAG 2.1 AA compliance of the POS UI patterns.
 */
import { describe, it, expect } from 'vitest'
import { checkA11y } from '@/src/test-utils/axe-helper'

describe('POS Page — Accessibility', () => {
  it('header con logo y estado de conexion cumple a11y', async () => {
    const html = `
      <header role="banner">
        <div>
          <img src="/logo.svg" alt="Park POS Logo" width="120" height="40" />
          <span aria-label="Estado de conexión: en línea">En línea</span>
        </div>
        <nav aria-label="Acciones rápidas">
          <button type="button" aria-label="Abrir turno">Abrir Turno</button>
          <button type="button" aria-label="Perfil de empleado">Perfil</button>
        </nav>
      </header>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('catalogo de productos con grid accesible', async () => {
    const html = `
      <main>
        <h1>Catálogo</h1>
        <section aria-label="Categorías de productos">
          <button type="button" aria-pressed="true">Pollos</button>
          <button type="button" aria-pressed="false">Bebidas</button>
          <button type="button" aria-pressed="false">Guarniciones</button>
        </section>
        <ul role="list" aria-label="Lista de productos">
          <li>
            <button type="button" aria-label="Agregar Pollo a la Brasa - S/ 45.00">
              <span>Pollo a la Brasa</span>
              <span>S/ 45.00</span>
            </button>
          </li>
          <li>
            <button type="button" aria-label="Agregar 1/4 Pollo - S/ 18.00">
              <span>1/4 Pollo</span>
              <span>S/ 18.00</span>
            </button>
          </li>
        </ul>
      </main>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('detalle de cuenta con tabla accesible', async () => {
    const html = `
      <aside aria-label="Detalle de la cuenta">
        <h2>Cuenta #001</h2>
        <table>
          <caption>Ítems de la orden</caption>
          <thead>
            <tr>
              <th scope="col">Producto</th>
              <th scope="col">Cant.</th>
              <th scope="col">Precio</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Pollo a la Brasa</td>
              <td>1</td>
              <td>S/ 45.00</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colspan="2">Total</th>
              <td>S/ 45.00</td>
            </tr>
          </tfoot>
        </table>
        <button type="button">Enviar a cocina</button>
        <button type="button">Cobrar</button>
      </aside>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('modal de turno con formulario accesible', async () => {
    const html = `
      <div role="dialog" aria-modal="true" aria-labelledby="shift-title">
        <h2 id="shift-title">Abrir Turno</h2>
        <form>
          <label for="initial-cash">Monto inicial de caja</label>
          <input id="initial-cash" type="number" min="0" step="0.01" aria-required="true" />
          <button type="submit">Confirmar apertura</button>
          <button type="button">Cancelar</button>
        </form>
      </div>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('estado offline con alerta accesible', async () => {
    const html = `
      <div role="alert" aria-live="polite">
        <span aria-hidden="true">⚠</span>
        <span>Sin conexión — Los pedidos se guardarán localmente</span>
      </div>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('botones de pago con roles correctos', async () => {
    const html = `
      <section aria-label="Métodos de pago">
        <h3>Seleccionar método de pago</h3>
        <div role="group" aria-label="Opciones de pago">
          <button type="button" aria-pressed="true">Efectivo</button>
          <button type="button" aria-pressed="false">Yape</button>
          <button type="button" aria-pressed="false">Tarjeta</button>
        </div>
        <label for="amount-received">Monto recibido</label>
        <input id="amount-received" type="number" min="0" step="0.01" />
        <output aria-label="Vuelto">Vuelto: S/ 5.00</output>
      </section>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })
})
