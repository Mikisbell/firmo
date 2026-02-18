## Correctness Properties

*Una property es una característica o comportamiento que debe mantenerse verdadero en todas las ejecuciones válidas del sistema - esencialmente, una declaración formal sobre lo que el sistema debe hacer. Las properties sirven como puente entre especificaciones legibles por humanos y garantías de corrección verificables por máquina.*

### Property 1: Fórmula Fundamental de Ganancia

*Para cualquier* precio de venta y COGS, la ganancia calculada debe ser exactamente igual a (precio - COGS)

**Validates: Requirements 2.1, 14.1**

**Justificación:** Esta es la property más fundamental del sistema. La ganancia es por definición la diferencia entre precio y costo. Esta property debe mantenerse para cualquier par de valores válidos.

**Implementación:**
```typescript
// Property test con fast-check
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
```

### Property 2: Fórmula Fundamental de Margen

*Para cualquier* ganancia y precio de venta (precio > 0), el margen calculado debe ser exactamente igual a ((ganancia / precio) × 100) redondeado a 2 decimales

**Validates: Requirements 2.2, 14.2**

**Justificación:** El margen es por definición el porcentaje de ganancia sobre el precio. Esta fórmula debe mantenerse para cualquier par de valores válidos.

**Implementación:**
```typescript
fc.assert(
  fc.property(
    fc.integer({ min: 1, max: 1000000 }), // price (> 0)
    fc.integer({ min: -1000000, max: 1000000 }), // profit (puede ser negativo)
    (price, profit) => {
      const margin = calculateMargin(toProfit(profit), price as Centavos);
      const expected = Math.round(((profit / price) * 100) * 100) / 100;
      return Math.abs(margin - expected) < 0.01; // Tolerancia de redondeo
    }
  ),
  { numRuns: 100 }
);
```

### Property 3: Margen Cero Cuando Precio es Cero

*Para cualquier* ganancia, si el precio de venta es cero, el margen debe ser cero

**Validates: Requirements 2.3 (edge case)**

**Justificación:** Este es un edge case crítico para prevenir división por cero. El sistema debe manejar este caso gracefully.

**Implementación:**
```typescript
fc.assert(
  fc.property(
    fc.integer({ min: -1000000, max: 1000000 }), // profit
    (profit) => {
      const margin = calculateMargin(toProfit(profit), 0 as Centavos);
      return margin === 0;
    }
  ),
  { numRuns: 100 }
);
```

### Property 4: COGS es Suma de Costos de Ingredientes

*Para cualquier* receta con ingredientes, el COGS calculado debe ser exactamente igual a la suma de (cantidad × costo_unitario) de todos los ingredientes

**Validates: Requirements 1.1**

**Justificación:** El COGS es por definición la suma de los costos de los ingredientes. Esta property verifica la corrección del cálculo.

**Implementación:**
```typescript
fc.assert(
  fc.property(
    fc.array(
      fc.record({
        quantity: fc.float({ min: 0.1, max: 100 }),
        costPerUnit: fc.integer({ min: 1, max: 10000 })
      }),
      { minLength: 1, maxLength: 20 }
    ),
    (ingredients) => {
      const expectedCOGS = ingredients.reduce(
        (sum, ing) => sum + Math.round(ing.quantity * ing.costPerUnit),
        0
      );
      
      // Simular cálculo del sistema
      const calculatedCOGS = calculateCOGSFromIngredients(ingredients);
      
      return calculatedCOGS === expectedCOGS;
    }
  ),
  { numRuns: 100 }
);
```

### Property 5: Costo Promedio Ponderado es Correcto

*Para cualquier* conjunto de compras de un ingrediente, el costo promedio ponderado debe ser igual a (suma de costo × cantidad) / (suma de cantidades)

**Validates: Requirements 1.2**

**Justificación:** El costo promedio ponderado es una fórmula matemática estándar. Esta property verifica su correcta implementación.

**Implementación:**
```typescript
fc.assert(
  fc.property(
    fc.array(
      fc.record({
        quantity: fc.float({ min: 0.1, max: 1000 }),
        costCents: fc.integer({ min: 1, max: 100000 })
      }),
      { minLength: 1, maxLength: 10 }
    ),
    (purchases) => {
      const totalCost = purchases.reduce((sum, p) => sum + p.quantity * p.costCents, 0);
      const totalQuantity = purchases.reduce((sum, p) => sum + p.quantity, 0);
      const expected = totalCost / totalQuantity;
      
      const calculated = getWeightedAverageCost(purchases);
      
      return Math.abs(calculated - expected) < 0.01; // Tolerancia de redondeo
    }
  ),
  { numRuns: 100 }
);
```

### Property 6: Branded Types Mantienen Invariantes

*Para cualquier* valor monetario, los branded types deben garantizar que: (1) Centavos/COGS/Profit son integers, (2) Margin está en [-100, 100]

**Validates: Requirements 1.4, 2.4, 2.6, 8.1, 8.2, 8.3, 8.4, 8.5**

**Justificación:** Los branded types son el mecanismo de seguridad de tipos del sistema. Esta property verifica que las invariantes se mantienen.

**Implementación:**
```typescript
fc.assert(
  fc.property(
    fc.integer({ min: -1000000, max: 1000000 }),
    fc.float({ min: -200, max: 200 }),
    (cents, percentage) => {
      // Test Centavos
      if (cents >= 0 && Number.isInteger(cents)) {
        const centavos = toCentavos(cents);
        expect(Number.isInteger(centavos)).toBe(true);
      }
      
      // Test COGS
      if (cents >= 0 && Number.isInteger(cents)) {
        const cogs = toCOGS(cents);
        expect(Number.isInteger(cogs)).toBe(true);
        expect(cogs).toBeGreaterThanOrEqual(0);
      }
      
      // Test Profit
      if (Number.isInteger(cents)) {
        const profit = toProfit(cents);
        expect(Number.isInteger(profit)).toBe(true);
      }
      
      // Test Margin
      if (percentage >= -100 && percentage <= 100) {
        const margin = toMargin(percentage);
        expect(margin).toBeGreaterThanOrEqual(-100);
        expect(margin).toBeLessThanOrEqual(100);
      }
      
      return true;
    }
  ),
  { numRuns: 100 }
);
```

### Property 7: COGS Nunca es Negativo

*Para cualquier* producto con o sin receta, el COGS calculado debe ser siempre >= 0

**Validates: Requirements 14.3**

**Justificación:** Un costo negativo no tiene sentido en el dominio del negocio. Esta es una invariante fundamental.

**Implementación:**
```typescript
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
      const cogs = recipe ? calculateCOGSFromRecipe(recipe) : toCOGS(0);
      return cogs >= 0;
    }
  ),
  { numRuns: 100 }
);
```

### Property 8: Metamórfica - Precio Aumenta → Ganancia Aumenta

*Para cualquier* producto, si el precio aumenta y el COGS permanece constante, entonces la ganancia debe aumentar en la misma cantidad

**Validates: Requirements 14.4**

**Justificación:** Esta es una property metamórfica que verifica la relación entre variables. Es útil para detectar errores sutiles en la lógica.

**Implementación:**
```typescript
fc.assert(
  fc.property(
    fc.integer({ min: 1000, max: 100000 }), // price inicial
    fc.integer({ min: 100, max: 50000 }), // cogs
    fc.integer({ min: 1, max: 10000 }), // incremento de precio
    (initialPrice, cogs, priceIncrease) => {
      const profit1 = calculateProfit(initialPrice as Centavos, toCOGS(cogs));
      const profit2 = calculateProfit((initialPrice + priceIncrease) as Centavos, toCOGS(cogs));
      
      return profit2 - profit1 === priceIncrease;
    }
  ),
  { numRuns: 100 }
);
```

### Property 9: Agregación de Ventas es Correcta

*Para cualquier* conjunto de ventas en un período, la suma de ventas totales debe ser igual a la suma de (precio × cantidad) de cada venta

**Validates: Requirements 3.2, 4.4, 5.4**

**Justificación:** Las agregaciones son operaciones críticas en reportes financieros. Esta property verifica su corrección.

**Implementación:**
```typescript
fc.assert(
  fc.property(
    fc.array(
      fc.record({
        priceCents: fc.integer({ min: 100, max: 100000 }),
        quantity: fc.integer({ min: 1, max: 100 })
      }),
      { minLength: 1, maxLength: 1000 }
    ),
    (sales) => {
      const expectedTotal = sales.reduce(
        (sum, sale) => sum + sale.priceCents * sale.quantity,
        0
      );
      
      const calculatedTotal = aggregateSales(sales);
      
      return calculatedTotal === expectedTotal;
    }
  ),
  { numRuns: 100 }
);
```

### Property 10: Agregación de Ganancias es Correcta

*Para cualquier* conjunto de productos vendidos, la ganancia total debe ser igual a la suma de (ganancia_unitaria × cantidad) de cada producto

**Validates: Requirements 3.3, 4.2, 5.4**

**Justificación:** Similar a Property 9, pero para ganancias. Verifica que las agregaciones de ganancias son correctas.

**Implementación:**
```typescript
fc.assert(
  fc.property(
    fc.array(
      fc.record({
        priceCents: fc.integer({ min: 100, max: 100000 }),
        cogsCents: fc.integer({ min: 50, max: 50000 }),
        quantity: fc.integer({ min: 1, max: 100 })
      }),
      { minLength: 1, maxLength: 1000 }
    ),
    (sales) => {
      const expectedTotalProfit = sales.reduce((sum, sale) => {
        const profit = sale.priceCents - sale.cogsCents;
        return sum + profit * sale.quantity;
      }, 0);
      
      const calculatedTotalProfit = aggregateProfits(sales);
      
      return calculatedTotalProfit === expectedTotalProfit;
    }
  ),
  { numRuns: 100 }
);
```

### Property 11: Agrupación por Categoría Preserva Totales

*Para cualquier* conjunto de productos agrupados por categoría, la suma de totales de todas las categorías debe ser igual al total sin agrupar

**Validates: Requirements 4.1, 4.2, 4.4**

**Justificación:** El agrupamiento no debe cambiar los totales. Esta es una invariante fundamental de agregaciones.

**Implementación:**
```typescript
fc.assert(
  fc.property(
    fc.array(
      fc.record({
        categoryId: fc.constantFrom('cat1', 'cat2', 'cat3'),
        revenueCents: fc.integer({ min: 1000, max: 100000 }),
        profitCents: fc.integer({ min: -10000, max: 50000 })
      }),
      { minLength: 10, maxLength: 100 }
    ),
    (products) => {
      const totalRevenue = products.reduce((sum, p) => sum + p.revenueCents, 0);
      const totalProfit = products.reduce((sum, p) => sum + p.profitCents, 0);
      
      const grouped = groupByCategory(products);
      const groupedRevenue = grouped.reduce((sum, cat) => sum + cat.totalRevenueCents, 0);
      const groupedProfit = grouped.reduce((sum, cat) => sum + cat.totalProfitCents, 0);
      
      return totalRevenue === groupedRevenue && totalProfit === groupedProfit;
    }
  ),
  { numRuns: 100 }
);
```

### Property 12: Ordenamiento por Ganancia es Correcto

*Para cualquier* lista de categorías ordenadas por ganancia descendente, cada categoría debe tener ganancia >= a la siguiente

**Validates: Requirements 4.5**

**Justificación:** El ordenamiento es una operación común en reportes. Esta property verifica su corrección.

**Implementación:**
```typescript
fc.assert(
  fc.property(
    fc.array(
      fc.record({
        categoryId: fc.string(),
        totalProfitCents: fc.integer({ min: -100000, max: 1000000 })
      }),
      { minLength: 2, maxLength: 50 }
    ),
    (categories) => {
      const sorted = sortByProfitDescending(categories);
      
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].totalProfitCents < sorted[i + 1].totalProfitCents) {
          return false;
        }
      }
      
      return true;
    }
  ),
  { numRuns: 100 }
);
```

### Property 13: Filtrado por Período es Correcto

*Para cualquier* conjunto de ventas y rango de fechas, las ventas filtradas deben contener solo ventas dentro del rango

**Validates: Requirements 5.1**

**Justificación:** El filtrado por fecha es crítico para reportes de períodos. Esta property verifica su corrección.

**Implementación:**
```typescript
fc.assert(
  fc.property(
    fc.array(
      fc.record({
        date: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        revenueCents: fc.integer({ min: 100, max: 100000 })
      }),
      { minLength: 10, maxLength: 1000 }
    ),
    fc.date({ min: new Date('2024-01-01'), max: new Date('2026-06-01') }),
    fc.date({ min: new Date('2026-06-01'), max: new Date('2026-12-31') }),
    (sales, startDate, endDate) => {
      const filtered = filterByPeriod(sales, startDate, endDate);
      
      return filtered.every(sale => 
        sale.date >= startDate && sale.date <= endDate
      );
    }
  ),
  { numRuns: 100 }
);
```

### Property 14: Caché Round-Trip Preserva Valor

*Para cualquier* COGS calculado y almacenado en caché, recuperarlo del caché debe retornar el mismo valor

**Validates: Requirements 9.1, 9.2**

**Justificación:** El caché no debe alterar los valores. Esta es una property de round-trip.

**Implementación:**
```typescript
fc.assert(
  fc.property(
    fc.string(), // productId
    fc.integer({ min: 0, max: 100000 }), // cogs
    async (productId, cogs) => {
      const cogsBranded = toCOGS(cogs);
      
      await setCachedCOGS(productId, 'tenant1', cogsBranded);
      const retrieved = await getCachedCOGS(productId, 'tenant1');
      
      return retrieved === cogsBranded;
    }
  ),
  { numRuns: 100 }
);
```

### Property 15: Invalidación de Caché Afecta Productos Correctos

*Para cualquier* ingrediente usado en múltiples productos, invalidar el caché del ingrediente debe invalidar el caché de todos los productos que lo usan

**Validates: Requirements 1.3, 9.3, 9.4**

**Justificación:** La invalidación de caché debe ser completa y correcta para mantener consistencia.

**Implementación:**
```typescript
fc.assert(
  fc.property(
    fc.string(), // ingredientId
    fc.array(fc.string(), { minLength: 1, maxLength: 20 }), // productIds que usan el ingrediente
    async (ingredientId, productIds) => {
      // Cachear COGS de todos los productos
      for (const productId of productIds) {
        await setCachedCOGS(productId, 'tenant1', toCOGS(1000));
      }
      
      // Invalidar caché por cambio de ingrediente
      await invalidateCacheForIngredient(ingredientId, productIds, 'tenant1');
      
      // Verificar que todos los productos tienen caché invalidado
      const results = await Promise.all(
        productIds.map(id => getCachedCOGS(id, 'tenant1'))
      );
      
      return results.every(result => result === null);
    }
  ),
  { numRuns: 100 }
);
```

### Property 16: Eventos Contienen Tenant ID

*Para cualquier* evento emitido por el sistema, debe contener un tenant_id válido

**Validates: Requirements 11.5**

**Justificación:** El tenant_id es crítico para multi-tenancy. Esta property verifica que nunca se omite.

**Implementación:**
```typescript
fc.assert(
  fc.property(
    fc.constantFrom('COGS_CALCULATED', 'INGREDIENT_COST_CHANGED', 'PROFITABILITY_REPORT_GENERATED'),
    fc.record({
      productId: fc.string(),
      cogsCents: fc.integer({ min: 0, max: 100000 })
    }),
    (eventType, payload) => {
      const event = createEvent(eventType, payload, 'tenant1');
      
      return event.tenant_id === 'tenant1' && event.tenant_id.length > 0;
    }
  ),
  { numRuns: 100 }
);
```

### Property 17: Validación Rechaza Valores Inválidos

*Para cualquier* valor fuera de rango válido, la validación debe lanzar error con mensaje descriptivo

**Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5**

**Justificación:** La validación es la primera línea de defensa contra datos incorrectos. Esta property verifica que funciona correctamente.

**Implementación:**
```typescript
fc.assert(
  fc.property(
    fc.integer({ min: -100000, max: 100000 }),
    fc.float({ min: -200, max: 200 }),
    (cents, percentage) => {
      // Test validación de precio negativo
      if (cents < 0) {
        expect(() => validatePrice(cents)).toThrow('Precio no puede ser negativo');
      }
      
      // Test validación de COGS negativo
      if (cents < 0) {
        expect(() => validateCOGS(cents)).toThrow('COGS no puede ser negativo');
      }
      
      // Test validación de margen fuera de rango
      if (percentage < -100 || percentage > 100) {
        expect(() => toMargin(percentage)).toThrow('Margin debe estar en rango [-100, 100]');
      }
      
      return true;
    }
  ),
  { numRuns: 100 }
);
```

### Property 18: Formato de Exportación CSV es Correcto

*Para cualquier* conjunto de datos exportados a CSV, cada valor monetario debe tener formato "S/ X.XX" y cada porcentaje debe tener formato "X.XX%"

**Validates: Requirements 12.3, 12.4**

**Justificación:** El formato de exportación debe ser consistente y correcto para análisis externo.

**Implementación:**
```typescript
fc.assert(
  fc.property(
    fc.array(
      fc.record({
        productName: fc.string(),
        priceCents: fc.integer({ min: 100, max: 100000 }),
        marginPercent: fc.float({ min: -100, max: 100 })
      }),
      { minLength: 1, maxLength: 100 }
    ),
    (products) => {
      const csv = exportToCSV(products);
      const lines = csv.split('\n');
      
      // Verificar formato de cada línea (excepto header)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        
        // Verificar que contiene "S/" para precio
        if (!line.includes('S/')) return false;
        
        // Verificar que contiene "%" para margen
        if (!line.includes('%')) return false;
      }
      
      return true;
    }
  ),
  { numRuns: 100 }
);
```

### Property 19: Stress Test - 1000+ Productos Simultáneos

*Para cualquier* conjunto de 1000+ productos, el sistema debe calcular métricas de rentabilidad sin errores y en tiempo razonable

**Validates: Requirements 14.5**

**Justificación:** El sistema debe manejar cargas grandes sin fallar. Este es un stress test de escalabilidad.

**Implementación:**
```typescript
fc.assert(
  fc.property(
    fc.array(
      fc.record({
        productId: fc.string(),
        priceCents: fc.integer({ min: 100, max: 100000 }),
        cogsCents: fc.integer({ min: 50, max: 50000 }),
        quantity: fc.integer({ min: 1, max: 100 })
      }),
      { minLength: 1000, maxLength: 2000 }
    ),
    async (products) => {
      const startTime = Date.now();
      
      const report = await getProfitabilityReport({
        tenantId: 'tenant1',
        products
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Verificar que no hay errores
      expect(report).toBeDefined();
      expect(report.products.length).toBe(products.length);
      
      // Verificar que el tiempo es razonable (< 5 segundos para 1000+ productos)
      expect(duration).toBeLessThan(5000);
      
      return true;
    }
  ),
  { numRuns: 10 } // Menos iteraciones para stress tests
);
```

### Property 20: Error Logging Incluye Contexto Completo

*Para cualquier* error que ocurra en el sistema, el log debe incluir: tipo de error, mensaje, stack trace, tenant_id, y contexto de la operación

**Validates: Requirements 15.5**

**Justificación:** Los logs completos son críticos para debugging en producción. Esta property verifica que no se omite información.

**Implementación:**
```typescript
fc.assert(
  fc.property(
    fc.constantFrom('PRODUCT_NOT_FOUND', 'COGS_CALCULATION_FAILED', 'DATABASE_ERROR'),
    fc.record({
      productId: fc.string(),
      tenantId: fc.string()
    }),
    (errorType, context) => {
      const mockLogger = jest.fn();
      
      try {
        // Simular error
        throw new Error(`Test error: ${errorType}`);
      } catch (error) {
        logError(error, context, mockLogger);
      }
      
      // Verificar que el log incluye todo el contexto
      expect(mockLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          errorType,
          message: expect.any(String),
          stack: expect.any(String),
          tenantId: context.tenantId,
          productId: context.productId
        })
      );
      
      return true;
    }
  ),
  { numRuns: 100 }
);
```

