/**
 * @vitest-environment jsdom
 *
 * Accessibility tests for Bar KDS page structure.
 * Validates WCAG 2.1 AA compliance.
 */
import { describe, it, expect } from 'vitest'
import { checkA11y } from '@/src/test-utils/axe-helper'

describe('Bar KDS Page — Accessibility', () => {
  it('header del bar con titulo y contadores', async () => {
    const html = `
      <header role="banner">
        <h1>BAR</h1>
        <p>Bebidas · Jugos · Chicha</p>
        <div aria-label="Contadores de pedidos">
          <span>Pendientes: <strong>3</strong></span>
          <span>Preparando: <strong>2</strong></span>
        </div>
        <time datetime="2026-02-28T20:15:00">20:15</time>
      </header>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('ticket de bar con items accesibles', async () => {
    const html = `
      <article aria-label="Pedido #012 - Mesa 8">
        <header>
          <h2>Pedido #012</h2>
          <span>Mesa 8</span>
          <time datetime="2026-02-28T20:10:00">hace 5 min</time>
        </header>
        <ul role="list" aria-label="Bebidas del pedido">
          <li>
            <span>2x Chicha Morada</span>
            <span role="status">Pendiente</span>
          </li>
          <li>
            <span>1x Inca Kola 500ml</span>
            <span role="status">Preparando</span>
          </li>
          <li>
            <span>3x Limonada</span>
            <span role="status">Pendiente</span>
          </li>
        </ul>
        <footer>
          <button type="button" aria-label="Marcar pedido 012 como preparando">Preparar</button>
          <button type="button" aria-label="Marcar pedido 012 como listo">Listo</button>
        </footer>
      </article>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('estado vacio del bar', async () => {
    const html = `
      <div role="status" aria-label="Sin pedidos de bebidas">
        <p>No hay pedidos de bebidas pendientes</p>
      </div>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('lista de tickets en grid accesible', async () => {
    const html = `
      <main>
        <h1>Bar — Kitchen Display</h1>
        <section aria-label="Pedidos de bebidas">
          <ul role="list" aria-label="Cola de pedidos">
            <li aria-label="Pedido #010 — Mesa 2">
              <h2>Pedido #010</h2>
              <p>Mesa 2 · 2 bebidas</p>
            </li>
            <li aria-label="Pedido #011 — Mesa 5">
              <h2>Pedido #011</h2>
              <p>Mesa 5 · 4 bebidas</p>
            </li>
          </ul>
        </section>
      </main>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })
})
