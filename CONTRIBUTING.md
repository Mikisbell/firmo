# 🤝 Guía de Contribución - PARK POS

> Gracias por tu interés en contribuir a PARK POS. Esta guía te ayudará a empezar.

---

## 📋 Tabla de Contenidos

1. [Código de Conducta](#código-de-conducta)
2. [Cómo Contribuir](#cómo-contribuir)
3. [Configuración del Entorno](#configuración-del-entorno)
4. [Estándares de Código](#estándares-de-código)
5. [Proceso de Pull Request](#proceso-de-pull-request)
6. [Guía de Testing](#guía-de-testing)
7. [Convenciones de Commits](#convenciones-de-commits)
8. [Reportar Bugs](#reportar-bugs)

---

## 📜 Código de Conducta

### Nuestro Compromiso

Nos comprometemos a hacer de la participación en este proyecto una experiencia libre de acoso para todos, independientemente de edad, tamaño corporal, discapacidad, etnia, identidad de género, nivel de experiencia, nacionalidad, apariencia personal, raza, religión o identidad y orientación sexual.

### Comportamiento Esperado

- Usar lenguaje acogedor e inclusivo
- Respetar diferentes puntos de vista y experiencias
- Aceptar críticas constructivas con gracia
- Enfocarse en lo mejor para la comunidad
- Mostrar empatía hacia otros miembros

### Comportamiento Inaceptable

- Uso de lenguaje o imágenes sexualizadas
- Trolling, comentarios insultantes o ataques personales
- Acoso público o privado
- Publicar información privada de otros sin permiso
- Conducta que razonablemente se considere inapropiada

---

## 🚀 Cómo Contribuir

### Tipos de Contribuciones

Aceptamos varios tipos de contribuciones:

1. **Reportar Bugs** - Encontraste un error? Repórtalo!
2. **Sugerir Features** - Tienes una idea? Compártela!
3. **Mejorar Documentación** - Ayuda a otros a entender mejor
4. **Escribir Código** - Implementa features o arregla bugs
5. **Revisar PRs** - Ayuda a revisar código de otros

### Proceso General

1. **Fork** el repositorio
2. **Crea** una rama para tu feature (`git checkout -b feature/mi-feature`)
3. **Desarrolla** tu cambio
4. **Escribe** tests
5. **Commit** tus cambios (siguiendo convenciones)
6. **Push** a tu fork (`git push origin feature/mi-feature`)
7. **Abre** un Pull Request

---

## 🛠️ Configuración del Entorno

### Requisitos Previos

- Node.js 20.x LTS
- PostgreSQL 15.x
- Git 2.x
- Editor de código (recomendamos VS Code)

### Instalación

```bash
# 1. Fork y clonar
git clone https://github.com/tu-usuario/park.git
cd park

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus valores

# 4. Configurar base de datos
npx prisma migrate dev
npx prisma db seed

# 5. Iniciar servidor de desarrollo
npm run dev
```

### Extensiones de VS Code Recomendadas

```json
{
  "recommendations": [
    "prisma.prisma",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-playwright.playwright"
  ]
}
```

---

## 📝 Estándares de Código

### Idioma

**CRÍTICO:** Todo el código, comentarios y documentación DEBE estar en ESPAÑOL.

```typescript
// ✅ CORRECTO
/**
 * Servicio para gestionar órdenes
 * Implementa lógica de negocio para crear, actualizar y cerrar órdenes
 */
export class OrderService {
  /**
   * Crear nueva orden
   * @param data - Datos de la orden
   * @returns Orden creada
   */
  async createOrder(data: CreateOrderInput): Promise<Order> {
    // Validar datos de entrada
    const validated = orderSchema.parse(data);
    
    // Crear orden en base de datos
    return await prisma.order.create({ data: validated });
  }
}

// ❌ INCORRECTO
/**
 * Service to manage orders
 * Implements business logic for creating, updating and closing orders
 */
export class OrderService {
  /**
   * Create new order
   * @param data - Order data
   * @returns Created order
   */
  async createOrder(data: CreateOrderInput): Promise<Order> {
    // Validate input data
    const validated = orderSchema.parse(data);
    
    // Create order in database
    return await prisma.order.create({ data: validated });
  }
}
```

### TypeScript

- **Siempre** usar TypeScript, nunca JavaScript puro
- **Evitar** `any`, usar tipos específicos
- **Preferir** interfaces sobre types para objetos
- **Usar** tipos branded para valores críticos (Centavos, OrderId, etc.)

```typescript
// ✅ CORRECTO
interface CreateOrderInput {
  orderType: OrderType;
  items: OrderItem[];
  totalCents: Centavos;
}

// ❌ INCORRECTO
type CreateOrderInput = {
  orderType: any;
  items: any[];
  totalCents: number;
}
```

### Naming Conventions

```typescript
// Clases: PascalCase
class OrderService {}

// Funciones/Variables: camelCase
const calculateTotal = () => {};
const orderItems = [];

// Constantes: UPPER_SNAKE_CASE
const MAX_ITEMS_PER_ORDER = 50;

// Interfaces: PascalCase con prefijo I (opcional)
interface IOrderRepository {}

// Types: PascalCase
type OrderStatus = 'OPEN' | 'CLOSED';

// Archivos: kebab-case
// order-service.ts
// create-order.dto.ts
```

### Estructura de Archivos

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   ├── (auth)/            # Rutas de autenticación
│   └── admin/             # Panel de administración
├── components/            # Componentes React
│   ├── shared/           # Componentes compartidos
│   └── features/         # Componentes por feature
├── core/                  # Lógica de negocio
│   ├── domain/           # Modelos de dominio
│   ├── services/         # Servicios
│   └── repositories/     # Repositorios
├── lib/                   # Utilidades
└── types/                 # Tipos TypeScript
```

### Formateo

Usamos Prettier y ESLint:

```bash
# Formatear código
npm run lint

# Verificar tipos
npm run typecheck
```

**Configuración automática:**
- Prettier formatea al guardar (VS Code)
- ESLint valida en tiempo real
- Pre-commit hooks ejecutan validaciones

---

## 🔄 Proceso de Pull Request

### Antes de Crear el PR

1. **Actualiza** tu rama con main:
   ```bash
   git checkout main
   git pull upstream main
   git checkout feature/mi-feature
   git rebase main
   ```

2. **Ejecuta** todos los tests:
   ```bash
   npm test
   npm run test:e2e
   npm run typecheck
   ```

3. **Verifica** el build:
   ```bash
   npm run build
   ```

### Crear el PR

1. **Push** tu rama a tu fork
2. **Abre** PR en GitHub
3. **Completa** la plantilla de PR:

```markdown
## Descripción
Breve descripción de los cambios

## Tipo de Cambio
- [ ] Bug fix
- [ ] Nueva feature
- [ ] Breaking change
- [ ] Documentación

## Checklist
- [ ] Tests agregados/actualizados
- [ ] Documentación actualizada
- [ ] Build pasa localmente
- [ ] Código en español
- [ ] Commits siguen convenciones

## Screenshots (si aplica)
```

### Revisión de Código

Tu PR será revisado por al menos 1 maintainer. Esperamos:

- **Código limpio** y legible
- **Tests** que cubran los cambios
- **Documentación** actualizada
- **Sin conflictos** con main
- **Build exitoso** en CI

### Después de la Aprobación

1. **Squash** commits si es necesario
2. **Merge** será hecho por un maintainer
3. **Elimina** tu rama después del merge

---

## 🧪 Guía de Testing

### Tipos de Tests

#### 1. Tests Unitarios (Vitest)

```typescript
// src/core/services/__tests__/order.service.test.ts
import { describe, it, expect } from 'vitest';
import { OrderService } from '../order.service';

describe('OrderService', () => {
  describe('calculateTotal', () => {
    it('debe calcular el total correctamente', () => {
      const service = new OrderService();
      const items = [
        { priceCents: 2500, qty: 2 },
        { priceCents: 1500, qty: 1 }
      ];
      
      const total = service.calculateTotal(items);
      
      expect(total).toBe(6500);
    });
    
    it('debe manejar lista vacía', () => {
      const service = new OrderService();
      const total = service.calculateTotal([]);
      
      expect(total).toBe(0);
    });
  });
});
```

#### 2. Property-Based Tests (fast-check)

```typescript
// src/core/services/__tests__/order.service.property.test.ts
import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { OrderService } from '../order.service';

describe('OrderService - Property Tests', () => {
  it('el total nunca debe ser negativo', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          priceCents: fc.nat(),
          qty: fc.nat()
        })),
        (items) => {
          const service = new OrderService();
          const total = service.calculateTotal(items);
          return total >= 0;
        }
      )
    );
  });
});
```

#### 3. Tests E2E (Playwright)

```typescript
// e2e/order-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Flujo de Orden', () => {
  test('debe crear orden completa', async ({ page }) => {
    // Login
    await page.goto('/');
    await page.fill('[data-testid="pin-input"]', '1234');
    await page.click('[data-testid="login-button"]');
    
    // Crear orden
    await page.click('[data-testid="new-order"]');
    await page.click('[data-testid="product-pollo-1-4"]');
    await page.click('[data-testid="add-to-order"]');
    
    // Verificar
    await expect(page.locator('[data-testid="order-total"]'))
      .toHaveText('S/ 25.00');
  });
});
```

### Ejecutar Tests

```bash
# Todos los tests unitarios
npm test

# Tests en modo watch
npm run test:watch

# Tests de propiedades
npm run test:property

# Tests E2E
npm run test:e2e

# Tests E2E con UI
npm run test:e2e:headed

# Coverage
npm test -- --coverage
```

### Cobertura Mínima

- **Líneas:** 80%
- **Funciones:** 80%
- **Branches:** 75%
- **Statements:** 80%

---

## 📝 Convenciones de Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/).

### Formato

```
<tipo>(<scope>): <descripción>

[cuerpo opcional]

[footer opcional]
```

### Tipos

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| `feat` | Nueva funcionalidad | `feat(orders): agregar split bill` |
| `fix` | Corrección de bug | `fix(auth): corregir validación de PIN` |
| `docs` | Solo documentación | `docs(api): actualizar endpoints` |
| `style` | Formato (no afecta código) | `style: formatear con prettier` |
| `refactor` | Refactorización | `refactor(services): simplificar lógica` |
| `perf` | Mejora de performance | `perf(db): optimizar query de órdenes` |
| `test` | Agregar/modificar tests | `test(orders): agregar tests unitarios` |
| `chore` | Tareas de mantenimiento | `chore: actualizar dependencias` |

### Ejemplos

```bash
# Feature nueva
git commit -m "feat(delivery): agregar tracking en tiempo real"

# Bug fix
git commit -m "fix(payments): corregir cálculo de cambio"

# Documentación
git commit -m "docs(setup): actualizar guía de instalación"

# Breaking change
git commit -m "feat(api)!: cambiar formato de respuesta de órdenes

BREAKING CHANGE: El campo 'total' ahora se llama 'totalCents'"
```

### Reglas

1. **Usar** imperativo ("agregar" no "agregado")
2. **No** capitalizar primera letra
3. **No** punto final
4. **Máximo** 72 caracteres en primera línea
5. **Incluir** scope cuando sea relevante
6. **Usar** `!` o `BREAKING CHANGE:` para cambios breaking

---

## 🐛 Reportar Bugs

### Antes de Reportar

1. **Busca** en issues existentes
2. **Verifica** que estás en la última versión
3. **Reproduce** el bug en ambiente limpio

### Template de Bug Report

```markdown
**Descripción del Bug**
Descripción clara y concisa del bug.

**Pasos para Reproducir**
1. Ir a '...'
2. Click en '...'
3. Scroll hasta '...'
4. Ver error

**Comportamiento Esperado**
Qué esperabas que sucediera.

**Comportamiento Actual**
Qué sucedió realmente.

**Screenshots**
Si aplica, agregar screenshots.

**Entorno**
- OS: [ej. Windows 11]
- Browser: [ej. Chrome 120]
- Versión: [ej. 2.0.0]

**Contexto Adicional**
Cualquier otra información relevante.
```

---

## 💡 Sugerencias de Features

### Template de Feature Request

```markdown
**¿Tu feature está relacionada a un problema?**
Descripción clara del problema. Ej: "Siempre me frustra cuando..."

**Describe la solución que te gustaría**
Descripción clara de lo que quieres que suceda.

**Describe alternativas que consideraste**
Otras soluciones o features que consideraste.

**Contexto Adicional**
Screenshots, mockups, o cualquier contexto adicional.
```

---

## 📚 Recursos Adicionales

- [Documentación Completa](./docs/README.md)
- [Guía de Arquitectura](./docs/02-architecture/ARCHITECTURE.md)
- [API Reference](./API.md)
- [Setup Guide](./SETUP.md)

---

## 🙏 Agradecimientos

Gracias por contribuir a PARK POS! Tu ayuda hace que este proyecto sea mejor para todos.

---

**Última actualización:** 13 Febrero 2026  
**Versión:** 2.0.0
