## Error Handling

### Estrategia General

El sistema usa un enfoque de "fail-fast" con manejo graceful de errores:

1. **Validación Temprana**: Validar inputs con Zod antes de procesamiento
2. **Errores Tipados**: Usar clases de error específicas para cada tipo de fallo
3. **Logging Completo**: Loggear todos los errores con contexto completo
4. **Mensajes Descriptivos**: Retornar mensajes de error útiles al usuario
5. **Códigos HTTP Apropiados**: Usar códigos HTTP estándar (400, 404, 500, 503)

### Tipos de Errores

#### 1. Errores de Validación (400 Bad Request)

```typescript
class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Ejemplo de uso
if (price < 0) {
  throw new ValidationError(
    'Precio no puede ser negativo',
    'price',
    price
  );
}
```

**Manejo en API:**
```typescript
try {
  const validated = ProfitabilityQuerySchema.parse(req.query);
} catch (error) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parámetros inválidos',
          details: error.errors
        }
      },
      { status: 400 }
    );
  }
}
```

#### 2. Errores de Recurso No Encontrado (404 Not Found)

```typescript
class NotFoundError extends Error {
  constructor(
    public resourceType: string,
    public resourceId: string
  ) {
    super(`${resourceType} no encontrado: ${resourceId}`);
    this.name = 'NotFoundError';
  }
}

// Ejemplo de uso
const product = await prisma.product.findUnique({ where: { id: productId } });
if (!product) {
  throw new NotFoundError('Producto', productId);
}
```

**Manejo en API:**
```typescript
try {
  const analysis = await getProductAnalysis(productId, period);
  return NextResponse.json({ success: true, data: analysis });
} catch (error) {
  if (error instanceof NotFoundError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message
        }
      },
      { status: 404 }
    );
  }
}
```

#### 3. Errores de Cálculo (500 Internal Server Error)

```typescript
class CalculationError extends Error {
  constructor(
    message: string,
    public operation: string,
    public context: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CalculationError';
  }
}

// Ejemplo de uso
try {
  const cogs = await calculateCOGS(productId);
} catch (error) {
  throw new CalculationError(
    'Fallo al calcular COGS',
    'calculateCOGS',
    { productId, error: error.message }
  );
}
```

**Manejo en API:**
```typescript
try {
  const report = await getProfitabilityReport(filters);
  return NextResponse.json({ success: true, data: report });
} catch (error) {
  if (error instanceof CalculationError) {
    logger.error('Calculation error', {
      operation: error.operation,
      context: error.context,
      stack: error.stack
    });
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CALCULATION_ERROR',
          message: 'Error al calcular rentabilidad',
          details: error.message
        }
      },
      { status: 500 }
    );
  }
}
```

#### 4. Errores de Infraestructura (503 Service Unavailable)

```typescript
class InfrastructureError extends Error {
  constructor(
    message: string,
    public service: string,
    public retryable: boolean = true
  ) {
    super(message);
    this.name = 'InfrastructureError';
  }
}

// Ejemplo de uso
try {
  await prisma.product.findMany();
} catch (error) {
  throw new InfrastructureError(
    'Fallo de conexión a base de datos',
    'PostgreSQL',
    true
  );
}
```

**Manejo en API:**
```typescript
try {
  const report = await getProfitabilityReport(filters);
  return NextResponse.json({ success: true, data: report });
} catch (error) {
  if (error instanceof InfrastructureError) {
    logger.error('Infrastructure error', {
      service: error.service,
      retryable: error.retryable,
      stack: error.stack
    });
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: `Servicio temporalmente no disponible: ${error.service}`,
          retryable: error.retryable
        }
      },
      { status: 503 }
    );
  }
}
```

### Casos Especiales

#### Producto Sin Receta

Este NO es un error. El sistema debe retornar COGS = 0 sin lanzar excepción:

```typescript
async function calculateCOGS(productId: string): Promise<COGS> {
  const recipe = await prisma.recipe.findUnique({
    where: { product_id: productId }
  });
  
  if (!recipe) {
    // No es error, simplemente no hay receta
    return toCOGS(0);
  }
  
  // Calcular COGS desde receta...
}
```

#### División por Cero en Margen

Este NO es un error. El sistema debe retornar margen = 0:

```typescript
function calculateMargin(profit: Profit, price: Centavos): Margin {
  if (price === 0) {
    // No es error, retornar 0
    return toMargin(0);
  }
  
  return toMargin((profit / price) * 100);
}
```

### Logging de Errores

Todos los errores deben loggearse con contexto completo:

```typescript
function logError(
  error: Error,
  context: Record<string, unknown>,
  logger: Logger
): void {
  logger.error({
    errorType: error.name,
    message: error.message,
    stack: error.stack,
    ...context,
    timestamp: new Date().toISOString()
  });
}

// Ejemplo de uso
try {
  const cogs = await calculateCOGS(productId);
} catch (error) {
  logError(error, {
    operation: 'calculateCOGS',
    productId,
    tenantId
  }, logger);
  
  throw error;
}
```

## Testing Strategy

### Enfoque Dual: Unit Tests + Property-Based Tests

El sistema usa un enfoque dual de testing:

1. **Unit Tests**: Verifican ejemplos específicos, edge cases y casos de error
2. **Property-Based Tests**: Verifican propiedades universales con 100+ iteraciones

Ambos son complementarios y necesarios para cobertura completa.

### Unit Tests

**Propósito:**
- Verificar ejemplos específicos conocidos
- Verificar edge cases (precio = 0, sin receta, etc.)
- Verificar manejo de errores
- Verificar integración entre componentes

**Herramientas:**
- Vitest para test runner
- Jest mocks para dependencias
- Prisma mock para base de datos

**Ejemplo de Unit Test:**

```typescript
// src/core/services/__tests__/profitability.service.unit.test.ts

describe('ProfitabilityService', () => {
  describe('calculateProfit', () => {
    it('debe calcular ganancia correctamente para caso conocido', () => {
      // Pollo a la Brasa: S/ 35.00 - S/ 20.50 = S/ 14.50
      const price = 3500 as Centavos;
      const cogs = toCOGS(2050);
      
      const profit = calculateProfit(price, cogs);
      
      expect(profit).toBe(1450);
    });
    
    it('debe manejar ganancia negativa (pérdida)', () => {
      const price = 1000 as Centavos;
      const cogs = toCOGS(1500);
      
      const profit = calculateProfit(price, cogs);
      
      expect(profit).toBe(-500);
    });
  });
  
  describe('calculateMargin', () => {
    it('debe calcular margen correctamente para caso conocido', () => {
      // Ganancia S/ 14.50 / Precio S/ 35.00 = 41.43%
      const profit = toProfit(1450);
      const price = 3500 as Centavos;
      
      const margin = calculateMargin(profit, price);
      
      expect(margin).toBeCloseTo(41.43, 2);
    });
    
    it('debe retornar 0 cuando precio es 0 (edge case)', () => {
      const profit = toProfit(1000);
      const price = 0 as Centavos;
      
      const margin = calculateMargin(profit, price);
      
      expect(margin).toBe(0);
    });
  });
  
  describe('calculateCOGS', () => {
    it('debe retornar 0 cuando producto no tiene receta (edge case)', async () => {
      // Mock Prisma
      prismaMock.recipe.findUnique.mockResolvedValue(null);
      
      const cogs = await calculateCOGS('product-without-recipe');
      
      expect(cogs).toBe(0);
    });
    
    it('debe calcular COGS desde receta correctamente', async () => {
      // Mock receta de Pollo a la Brasa
      prismaMock.recipe.findUnique.mockResolvedValue({
        id: 'recipe1',
        product_id: 'product1',
        ingredients: [
          { inventory_item_id: 'ing1', quantity: 1.5 }, // 1.5 kg pollo
          { inventory_item_id: 'ing2', quantity: 0.5 }, // 0.5 kg papa
          { inventory_item_id: 'ing3', quantity: 0.1 }  // 0.1 L aceite
        ]
      });
      
      // Mock costos de ingredientes
      prismaMock.inventoryTransaction.findMany
        .mockResolvedValueOnce([{ cost_cents: 1200, quantity: 1 }]) // pollo: 1200/kg
        .mockResolvedValueOnce([{ cost_cents: 200, quantity: 1 }])  // papa: 200/kg
        .mockResolvedValueOnce([{ cost_cents: 1500, quantity: 1 }]); // aceite: 1500/L
      
      const cogs = await calculateCOGS('product1');
      
      // 1.5*1200 + 0.5*200 + 0.1*1500 = 1800 + 100 + 150 = 2050
      expect(cogs).toBe(2050);
    });
  });
});
```

### Property-Based Tests

**Propósito:**
- Verificar propiedades universales que deben mantenerse siempre
- Generar casos de prueba aleatorios (100+ iteraciones)
- Detectar edge cases no considerados
- Verificar corrección matemática de fórmulas

**Herramientas:**
- fast-check para generación de datos aleatorios
- Vitest para test runner

**Configuración:**
- Mínimo 100 iteraciones por property test
- Cada test debe referenciar su property del design document

**Ejemplo de Property-Based Test:**

```typescript
// src/core/services/__tests__/profitability.service.property.test.ts

import * as fc from 'fast-check';

describe('ProfitabilityService - Property Tests', () => {
  describe('Property 1: Fórmula Fundamental de Ganancia', () => {
    it('profit = price - cogs (siempre)', () => {
      /**
       * Feature: profitability-report
       * Property 1: Para cualquier precio y COGS, ganancia = precio - COGS
       * Validates: Requirements 2.1, 14.1
       */
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000 }), // price
          fc.integer({ min: 0, max: 1000000 }), // cogs
          (price, cogs) => {
            const profit = calculateProfit(price as Centavos, toCOGS(cogs));
            return profit === price - cogs;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Property 2: Fórmula Fundamental de Margen', () => {
    it('margin = (profit / price) × 100 (siempre)', () => {
      /**
       * Feature: profitability-report
       * Property 2: Para cualquier ganancia y precio > 0, margen = (ganancia/precio) × 100
       * Validates: Requirements 2.2, 14.2
       */
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000000 }), // price > 0
          fc.integer({ min: -1000000, max: 1000000 }), // profit
          (price, profit) => {
            const margin = calculateMargin(toProfit(profit), price as Centavos);
            const expected = Math.round(((profit / price) * 100) * 100) / 100;
            return Math.abs(margin - expected) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Property 7: COGS Nunca es Negativo', () => {
    it('cogs >= 0 (siempre)', () => {
      /**
       * Feature: profitability-report
       * Property 7: Para cualquier producto, COGS >= 0
       * Validates: Requirements 14.3
       */
      fc.assert(
        fc.property(
          fc.option(
            fc.array(
              fc.record({
                quantity: fc.float({ min: 0, max: 100 }),
                costPerUnit: fc.integer({ min: 0, max: 10000 })
              }),
              { minLength: 0, maxLength: 20 }
            ),
            { nil: null }
          ),
          (recipe) => {
            const cogs = recipe 
              ? calculateCOGSFromIngredients(recipe)
              : toCOGS(0);
            return cogs >= 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
```

### Integration Tests

**Propósito:**
- Verificar integración entre capas (API → Service → Database)
- Verificar flujos end-to-end
- Verificar caché y Redis

**Ejemplo:**

```typescript
// src/app/api/admin/reports/__tests__/profitability.integration.test.ts

describe('GET /api/admin/reports/profitability', () => {
  it('debe retornar reporte completo con datos reales', async () => {
    // Setup: Crear productos y ventas en DB de test
    await prisma.product.createMany({
      data: [
        { id: 'p1', name: 'Pollo Entero', price_cents: 3500, category_id: 'cat1' },
        { id: 'p2', name: 'Medio Pollo', price_cents: 2000, category_id: 'cat1' }
      ]
    });
    
    await prisma.orderItem.createMany({
      data: [
        { product_id: 'p1', quantity: 10, price_cents: 3500 },
        { product_id: 'p2', quantity: 20, price_cents: 2000 }
      ]
    });
    
    // Execute: Llamar API
    const response = await fetch('/api/admin/reports/profitability?startDate=2026-01-01&endDate=2026-12-31');
    const data = await response.json();
    
    // Assert: Verificar respuesta
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.products).toHaveLength(2);
    expect(data.data.summary.totalRevenueCents).toBe(3500 * 10 + 2000 * 20);
  });
});
```

### Stress Tests

**Propósito:**
- Verificar performance con cargas grandes (1000+ productos)
- Verificar que el sistema no falla bajo carga
- Verificar tiempos de respuesta

**Ejemplo:**

```typescript
// src/core/services/__tests__/profitability.service.stress.test.ts

describe('ProfitabilityService - Stress Tests', () => {
  it('debe manejar 1000+ productos sin errores', async () => {
    /**
     * Feature: profitability-report
     * Property 19: Sistema debe manejar 1000+ productos
     * Validates: Requirements 14.5
     */
    
    // Generar 1000 productos
    const products = Array.from({ length: 1000 }, (_, i) => ({
      id: `product-${i}`,
      name: `Product ${i}`,
      price_cents: Math.floor(Math.random() * 10000) + 1000,
      category_id: `cat-${i % 10}`
    }));
    
    const startTime = Date.now();
    
    const report = await getProfitabilityReport({
      tenantId: 'tenant1',
      products
    });
    
    const duration = Date.now() - startTime;
    
    expect(report).toBeDefined();
    expect(report.products).toHaveLength(1000);
    expect(duration).toBeLessThan(5000); // < 5 segundos
  });
});
```

### Cobertura de Tests

**Objetivo:** 80%+ de cobertura de código

**Métricas:**
- Unit tests: 60% de cobertura
- Property tests: 30% de cobertura adicional
- Integration tests: 10% de cobertura adicional

**Comandos:**

```bash
# Ejecutar todos los tests
npm test

# Ejecutar solo unit tests
npm test -- --grep "unit.test"

# Ejecutar solo property tests
npm test -- --grep "property.test"

# Ejecutar con cobertura
npm test -- --coverage

# Ejecutar stress tests
npm test -- --grep "stress.test"
```

### CI/CD Integration

Los tests se ejecutan automáticamente en CI/CD:

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test -- --coverage
      - run: npm run test:stress
```

