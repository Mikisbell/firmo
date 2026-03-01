/**
 * @vitest-environment jsdom
 *
 * Accessibility tests for Cocina KDS (Kitchen Display System) page.
 * Validates WCAG 2.1 AA compliance.
 */
import { describe, it, expect } from 'vitest'
import { checkA11y } from '@/src/test-utils/axe-helper'

describe('Cocina KDS Page — Accessibility', () => {
  it('header con titulo y contadores cumple a11y', async () => {
    const html = `
      <header role="banner">
        <h1>Cocina</h1>
        <div aria-label="Contadores de estado">
          <span>Pendientes: <strong>5</strong></span>
          <span>Preparando: <strong>3</strong></span>
        </div>
        <time datetime="2026-02-28T19:30:00">19:30</time>
      </header>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('ticket KDS con estructura accesible', async () => {
    const html = `
      <article aria-label="Orden #045 - Mesa 3">
        <header>
          <h2>Orden #045</h2>
          <span>Mesa 3</span>
          <time datetime="2026-02-28T19:15:00">hace 15 min</time>
        </header>
        <ul role="list" aria-label="Ítems de la orden">
          <li>
            <span>2x Pollo a la Brasa</span>
            <span role="status">Pendiente</span>
          </li>
          <li>
            <span>1x Papas Fritas</span>
            <span role="status">Preparando</span>
          </li>
        </ul>
        <footer>
          <button type="button" aria-label="Marcar orden 045 como preparando">Preparar</button>
          <button type="button" aria-label="Marcar orden 045 como lista">Lista</button>
        </footer>
      </article>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('grid de tickets usa landmarks correctos', async () => {
    const html = `
      <main>
        <h1>Kitchen Display System</h1>
        <section aria-label="Tickets pendientes">
          <h2>Pendientes</h2>
          <ul role="list">
            <li aria-label="Orden #043">
              <h3>Orden #043 — Mesa 1</h3>
              <p>3 ítems</p>
            </li>
            <li aria-label="Orden #044">
              <h3>Orden #044 — Mesa 7</h3>
              <p>2 ítems</p>
            </li>
          </ul>
        </section>
        <section aria-label="Tickets en preparación">
          <h2>Preparando</h2>
          <ul role="list">
            <li aria-label="Orden #042">
              <h3>Orden #042 — Mesa 5</h3>
              <p>1 ítem</p>
            </li>
          </ul>
        </section>
      </main>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('alerta de tiempo excedido es accesible', async () => {
    const html = `
      <div role="alert" aria-live="assertive">
        <span aria-hidden="true">🔴</span>
        <span>Orden #040 lleva más de 20 minutos — Atención requerida</span>
      </div>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('estado vacio muestra mensaje accesible', async () => {
    const html = `
      <div role="status" aria-label="Sin órdenes pendientes">
        <p>No hay órdenes pendientes en cocina</p>
      </div>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('barra de cursos con progreso accesible', async () => {
    const html = `
      <section aria-label="Progreso de cursos">
        <h3>Cursos — Orden #045</h3>
        <ol>
          <li>
            <span>Entrada</span>
            <progress value="100" max="100" aria-label="Entrada completa">100%</progress>
          </li>
          <li>
            <span>Plato principal</span>
            <progress value="50" max="100" aria-label="Plato principal en progreso">50%</progress>
          </li>
        </ol>
      </section>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })
})
