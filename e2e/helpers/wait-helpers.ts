/**
 * Smart Wait Helpers para Playwright E2E Tests
 * 
 * Proporciona estrategias de espera optimizadas y reutilizables
 */

import { Page, Locator } from '@playwright/test';

/**
 * Espera a que los datos se carguen verificando que el contenido no sea placeholder
 * 
 * @param page - Página de Playwright
 * @param selector - Selector del elemento a verificar
 * @param timeout - Timeout en milisegundos (default: 15000)
 */
export async function waitForDataLoad(
  page: Page,
  selector: string,
  timeout: number = 15000
): Promise<void> {
  await page.waitForFunction(
    (sel) => {
      const element = document.querySelector(sel);
      return (
        element &&
        element.textContent &&
        element.textContent.trim() !== '...' &&
        element.textContent.trim() !== ''
      );
    },
    selector,
    { timeout }
  ).catch(() => {
    console.log(`⚠️ Data did not load for selector: ${selector}`);
  });
}

/**
 * Espera a que una respuesta de API específica se complete
 * 
 * @param page - Página de Playwright
 * @param urlPattern - Patrón de URL a esperar (regex o string)
 * @param timeout - Timeout en milisegundos (default: 10000)
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  timeout: number = 10000
): Promise<void> {
  await page.waitForResponse(
    (response) => {
      const url = response.url();
      const matches =
        typeof urlPattern === 'string'
          ? url.includes(urlPattern)
          : urlPattern.test(url);
      return matches && response.status() === 200;
    },
    { timeout }
  ).catch(() => {
    console.log(`⚠️ API response not received for pattern: ${urlPattern}`);
  });
}

/**
 * Espera a que un elemento esté visible con reintentos
 * 
 * @param page - Página de Playwright
 * @param selector - Selector del elemento
 * @param timeout - Timeout en milisegundos (default: 5000)
 * @param retries - Número de reintentos (default: 3)
 */
export async function waitForElementWithRetry(
  page: Page,
  selector: string,
  timeout: number = 5000,
  retries: number = 3
): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      await page.waitForSelector(selector, { timeout, state: 'visible' });
      return true;
    } catch (error) {
      if (i === retries - 1) {
        console.log(`⚠️ Element not found after ${retries} retries: ${selector}`);
        return false;
      }
      await page.waitForTimeout(500);
    }
  }
  return false;
}

/**
 * Espera a que un input tenga un valor no vacío
 * 
 * @param page - Página de Playwright
 * @param selector - Selector del input
 * @param timeout - Timeout en milisegundos (default: 10000)
 */
export async function waitForInputValue(
  page: Page,
  selector: string,
  timeout: number = 10000
): Promise<void> {
  await page.waitForFunction(
    (sel) => {
      const input = document.querySelector(sel) as HTMLInputElement;
      return input && input.value && input.value.trim() !== '';
    },
    selector,
    { timeout }
  ).catch(() => {
    console.log(`⚠️ Input value did not load for selector: ${selector}`);
  });
}

/**
 * Espera a que múltiples elementos estén visibles
 * 
 * @param page - Página de Playwright
 * @param selectors - Array de selectores
 * @param timeout - Timeout en milisegundos (default: 5000)
 */
export async function waitForMultipleElements(
  page: Page,
  selectors: string[],
  timeout: number = 5000
): Promise<void> {
  const promises = selectors.map((selector) =>
    page.waitForSelector(selector, { timeout, state: 'visible' }).catch(() => {
      console.log(`⚠️ Element not found: ${selector}`);
    })
  );
  await Promise.all(promises);
}

/**
 * Espera a que la navegación se complete con estrategia rápida
 * 
 * @param page - Página de Playwright
 * @param url - URL a navegar
 */
export async function navigateWithFastWait(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
}
