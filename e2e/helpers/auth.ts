import { Page } from '@playwright/test';

/**
 * Autentica un empleado vía la API REAL (POST /api/auth/session) y deja la cookie
 * httpOnly `auth_token` en el storage context del browser.
 *
 * CLAVE (ver plan de rediseño E2E, Engram obs #2251): como `page.request` comparte el
 * storage context con la `page`, la cookie queda disponible para las navegaciones
 * siguientes. Esto es lo correcto — a diferencia de mockear `park_session` en
 * localStorage, que NO llega al servidor (solo las cookies sí) y por eso los endpoints
 * autenticados devolvían 401 en los E2E.
 *
 * @param page              Página Playwright.
 * @param opts.tenantId     Tenant del empleado (seed provision-e2e-test-tenants: 11111111-...).
 * @param opts.pin          PIN del empleado (admin del seed: 1111).
 * @param opts.allowedRoles Roles aceptados por el endpoint (p.ej. ['ADMIN','OWNER']).
 *
 * @example
 *   await loginViaPinAPI(page, { tenantId: TID, pin: '1111', allowedRoles: ['ADMIN'] });
 *   await page.goto('/pos'); // ya autenticado (cookie real)
 */
export async function loginViaPinAPI(
  page: Page,
  opts: { tenantId: string; pin: string; allowedRoles: string[] },
): Promise<void> {
  const response = await page.request.post('/api/auth/session', {
    data: {
      pin: opts.pin,
      allowedRoles: opts.allowedRoles,
      tenant_id: opts.tenantId,
    },
  });

  if (!response.ok()) {
    throw new Error(
      `loginViaPinAPI: autenticación falló (status ${response.status()}): ${await response.text()}`,
    );
  }
}
