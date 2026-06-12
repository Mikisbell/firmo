/**
 * @vitest-environment jsdom
 *
 * Accessibility tests for Mozo (Waiter) page structure.
 * Validates WCAG 2.1 AA compliance.
 */
import { describe, it, expect } from 'vitest'
import { checkA11y } from '@/src/test-utils/axe-helper'

describe('Mozo Page — Accessibility', () => {
  it('tabs de zonas con roles correctos', async () => {
    const html = `
      <div role="tablist" aria-label="Zonas del restaurante">
        <button role="tab" aria-selected="true" aria-controls="panel-salon" id="tab-salon">
          Salón
        </button>
        <button role="tab" aria-selected="false" aria-controls="panel-terraza" id="tab-terraza">
          Terraza
        </button>
        <button role="tab" aria-selected="false" aria-controls="panel-vip" id="tab-vip">
          VIP
        </button>
      </div>
      <div role="tabpanel" id="panel-salon" aria-labelledby="tab-salon">
        <h2>Zona Salón</h2>
      </div>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('grid de mesas con estados accesibles', async () => {
    const html = `
      <section aria-label="Mesas del salón">
        <h2>Salón</h2>
        <div role="grid" aria-label="Mapa de mesas">
          <div role="row">
            <button role="gridcell" aria-label="Mesa 1 — Libre">
              <span>Mesa 1</span>
              <span>Libre</span>
            </button>
            <button role="gridcell" aria-label="Mesa 2 — Ocupada, 25 minutos">
              <span>Mesa 2</span>
              <span>Ocupada</span>
              <time>25 min</time>
            </button>
            <button role="gridcell" aria-label="Mesa 3 — Cuenta solicitada, 45 minutos">
              <span>Mesa 3</span>
              <span>Cuenta solicitada</span>
              <time>45 min</time>
            </button>
          </div>
        </div>
      </section>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('indicador de tiempo con alertas semanticas', async () => {
    const html = `
      <div>
        <span aria-label="Tiempo normal: 10 minutos">10 min</span>
        <span aria-label="Tiempo de advertencia: 30 minutos" role="status">30 min</span>
        <span aria-label="Tiempo crítico: 60 minutos" role="alert">60 min</span>
      </div>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('header de mozo con estado de conexion', async () => {
    const html = `
      <header role="banner">
        <h1>Panel del Mozo</h1>
        <div aria-label="Estado de conexión">
          <span aria-label="Conectado">En línea</span>
        </div>
        <button type="button" aria-label="Ver notificaciones">
          <span aria-hidden="true">🔔</span>
          <span>Notificaciones</span>
        </button>
      </header>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('navegacion inferior movil cumple a11y', async () => {
    const html = `
      <nav aria-label="Navegación principal" role="navigation">
        <ul role="list">
          <li><a href="/mozo" aria-current="page">Mesas</a></li>
          <li><a href="/mozo/listos">Listos</a></li>
          <li><a href="/mozo/configuracion">Ajustes</a></li>
        </ul>
      </nav>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('panel de notificaciones accesible', async () => {
    const html = `
      <aside aria-label="Notificaciones">
        <h2>Notificaciones</h2>
        <ul role="list" aria-label="Lista de notificaciones">
          <li>
            <div role="status">
              <strong>Mesa 5</strong>
              <span>Orden lista para servir</span>
            </div>
            <time datetime="2026-02-28T19:25:00">hace 2 min</time>
          </li>
          <li>
            <div role="status">
              <strong>Mesa 3</strong>
              <span>Cliente solicita la cuenta</span>
            </div>
            <time datetime="2026-02-28T19:20:00">hace 7 min</time>
          </li>
        </ul>
      </aside>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })
})
