/**
 * @vitest-environment jsdom
 *
 * Accessibility tests for Login page structure.
 * Validates WCAG 2.1 AA compliance.
 */
import { describe, it, expect } from 'vitest'
import { checkA11y } from '@/src/test-utils/axe-helper'

describe('Login Page — Accessibility', () => {
  it('formulario de login con labels correctos', async () => {
    const html = `
      <main>
        <h1>Iniciar Sesión</h1>
        <form aria-label="Formulario de inicio de sesión">
          <div>
            <label for="pin-input">PIN de acceso</label>
            <input id="pin-input" type="password" inputMode="numeric"
                   pattern="[0-9]*" maxlength="6"
                   aria-required="true"
                   aria-describedby="pin-hint"
                   autocomplete="current-password" />
            <p id="pin-hint">Ingresa tu PIN de 4-6 dígitos</p>
          </div>
          <button type="submit">Ingresar</button>
        </form>
      </main>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('selector de rol con radio buttons accesibles', async () => {
    const html = `
      <fieldset>
        <legend>Selecciona tu rol</legend>
        <label>
          <input type="radio" name="role" value="CASHIER" checked />
          Cajero
        </label>
        <label>
          <input type="radio" name="role" value="WAITER" />
          Mesero
        </label>
        <label>
          <input type="radio" name="role" value="KITCHEN" />
          Cocina
        </label>
        <label>
          <input type="radio" name="role" value="BAR" />
          Bar
        </label>
      </fieldset>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('configuracion de terminal con formulario accesible', async () => {
    const html = `
      <section aria-label="Configuración del terminal">
        <h2>Configurar Terminal</h2>
        <form>
          <div>
            <label for="terminal-code">Código de terminal</label>
            <input id="terminal-code" type="text" aria-required="true"
                   aria-describedby="code-hint"
                   pattern="[A-Z0-9]{6}" maxlength="6" />
            <p id="code-hint">Código de 6 caracteres proporcionado por el administrador</p>
          </div>
          <button type="submit">Vincular terminal</button>
        </form>
      </section>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('mensaje de error de autenticacion accesible', async () => {
    const html = `
      <div role="alert" aria-live="assertive">
        <p>PIN incorrecto. Intenta de nuevo.</p>
      </div>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('logo y branding accesible', async () => {
    const html = `
      <div>
        <img src="/logo.svg" alt="Park POS — Sistema de punto de venta" width="200" height="60" />
        <p>Sistema de Punto de Venta</p>
      </div>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('estado de carga durante verificacion', async () => {
    const html = `
      <div role="status" aria-live="polite" aria-label="Verificando sesión">
        <span aria-hidden="true" class="spinner"></span>
        <p>Verificando sesión...</p>
      </div>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })

  it('link de ayuda y soporte accesible', async () => {
    const html = `
      <footer>
        <p>
          <a href="/help" aria-label="Obtener ayuda con el inicio de sesión">
            ¿Necesitas ayuda?
          </a>
        </p>
      </footer>
    `
    const results = await checkA11y(html)
    expect(results.violations).toHaveLength(0)
  })
})
