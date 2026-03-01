/**
 * @vitest-environment jsdom
 *
 * Accessibility testing helper using axe-core.
 * Validates HTML fragments against WCAG 2.1 AA rules.
 */
import { axe } from 'vitest-axe'

export { axe }

/**
 * Creates a DOM container with the given HTML and runs axe on it.
 * Returns the axe results for assertion.
 */
export async function checkA11y(html: string) {
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: false },
        region: { enabled: false },
      },
    })
    return results
  } finally {
    document.body.removeChild(container)
  }
}

/**
 * Asserts that the given HTML has no accessibility violations.
 */
export async function expectNoA11yViolations(html: string) {
  const results = await checkA11y(html)
  if (results.violations.length > 0) {
    const violations = results.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.length,
      help: v.help,
    }))
    throw new Error(
      `Accessibility violations found:\n${JSON.stringify(violations, null, 2)}`
    )
  }
}
