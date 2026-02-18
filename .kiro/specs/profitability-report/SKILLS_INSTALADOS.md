# 🎯 Skills Instalados para Módulo de Rentabilidad

> Documentación de los skills instalados para implementar el módulo de rentabilidad de PARK POS

**Fecha:** 17 de febrero de 2026  
**Spec:** `.kiro/specs/profitability-report/`

---

## ✅ Skills Instalados (3 nuevos)

### 1. 🏦 Financial Operations Expert
**Instalado:** ✅ Sí  
**Ubicación:** `~/.agents/skills/financial-operations-expert`  
**Fuente:** `shipshitdev/library@financial-operations-expert`  
**Instalaciones globales:** 673  
**URL:** https://skills.sh/shipshitdev/library/financial-operations-expert

**Propósito:**
- Experto en operaciones financieras
- Cálculos de costos y ganancias
- Análisis de rentabilidad
- Manejo de dinero en centavos (integer)
- Validación de cálculos financieros

**Cuándo usar:**
```
@financial-operations-expert Calcula el COGS de este producto
@financial-operations-expert Valida estos cálculos de margen
@financial-operations-expert Optimiza la estructura de costos
```

**Aplicaciones en el módulo:**
- Cálculo de COGS desde recetas
- Cálculo de ganancia y margen
- Validación de branded types (Centavos, COGS, Profit, Margin)
- Redondeo correcto de decimales
- Validación de rangos financieros

---

### 2. 🧪 Property-Based Testing
**Instalado:** ✅ Sí  
**Ubicación:** `~/.agents/skills/property-based-testing`  
**Fuente:** `trailofbits/skills@property-based-testing`  
**Instalaciones globales:** 583  
**URL:** https://skills.sh/trailofbits/skills/property-based-testing

**Propósito:**
- Experto en property-based testing (PBT)
- Generación de arbitraries con fast-check
- Definición de propiedades de correctitud
- Estrategias de testing exhaustivo
- Detección de edge cases

**Cuándo usar:**
```
@property-based-testing Crea propiedades para este cálculo
@property-based-testing Genera arbitraries para productos
@property-based-testing Valida esta propiedad matemática
```

**Aplicaciones en el módulo:**
- 20 propiedades de correctitud definidas en design.md
- Arbitraries para Centavos, COGS, Profit, Margin
- Stress tests con 1000+ productos
- Validación de invariantes matemáticas
- Cobertura > 90%

---

### 3. 📘 TypeScript Best Practices
**Instalado:** ✅ Sí  
**Ubicación:** `~/.agents/skills/typescript-best-practices`  
**Fuente:** `0xbigboss/claude-code@typescript-best-practices`  
**Instalaciones globales:** 393  
**URL:** https://skills.sh/0xbigboss/claude-code/typescript-best-practices

**Propósito:**
- Mejores prácticas de TypeScript
- Type safety y branded types
- Patrones de diseño
- Manejo de errores
- Código limpio y mantenible

**Cuándo usar:**
```
@typescript-best-practices Revisa este código
@typescript-best-practices Implementa branded types
@typescript-best-practices Optimiza esta función
```

**Aplicaciones en el módulo:**
- Branded types: Centavos, COGS, Profit, Margin
- Type guards y validación
- Manejo de errores con Result<T, E>
- Código type-safe
- Interfaces y tipos reutilizables

---

## 🎯 Skills Ya Instalados (3 existentes)

### 4. ⚛️ Vercel React Best Practices
**Instalado:** ✅ Sí (ya existía)  
**Ubicación:** `.agents/skills/vercel-react-best-practices`  
**Fuente:** `vercel-labs/agent-skills@vercel-react-best-practices`

**Aplicaciones en el módulo:**
- Code splitting del dashboard
- Lazy loading de gráficos (MarginChart, ProfitTrendChart)
- SWR para caché de datos
- Memoización de cálculos pesados
- Bundle optimization

**Reglas críticas a aplicar:**
- `bundle-dynamic-imports` - Dashboard carga bajo demanda
- `client-swr-dedup` - Deduplicación automática de requests
- `async-parallel` - Llamadas API en paralelo
- `rerender-memo` - Memoizar cálculos de COGS
- `rendering-content-visibility` - Tablas largas de productos

---

### 5. 📄 API Documentation Generator
**Instalado:** ✅ Sí (ya existía)  
**Ubicación:** `.agents/skills/api-documentation-generator`

**Aplicaciones en el módulo:**
- Documentar 3 endpoints REST:
  - `GET /api/admin/reports/profitability`
  - `GET /api/admin/reports/profit-by-product/:id`
  - `GET /api/admin/reports/margin-analysis`
- Generar ejemplos en cURL, JavaScript, Python
- Crear especificación OpenAPI/Swagger
- Documentar request/response schemas

---

### 6. 📝 Crafting Effective READMEs
**Instalado:** ✅ Sí (ya existía)  
**Ubicación:** `.agents/skills/crafting-effective-readmes`

**Aplicaciones en el módulo:**
- README.md del spec (ya creado)
- Documentación de uso
- Guías de implementación
- FAQs y troubleshooting

---

## 🚀 Cómo Usar los Skills

### Fase 1: Documentación (Primero)

```bash
# 1. Documentar APIs REST
@api-documentation-generator Documenta los 3 endpoints del módulo de rentabilidad

# 2. Crear guías de uso
@crafting-effective-readmes Crea guía de uso del dashboard de rentabilidad
```

### Fase 2: Implementación con Buenas Prácticas (Segundo)

```bash
# 1. Implementar servicios con TypeScript best practices
@typescript-best-practices Implementa ProfitabilityService con branded types

# 2. Validar cálculos financieros
@financial-operations-expert Valida el cálculo de COGS y margen

# 3. Optimizar dashboard con React best practices
@vercel-react-best-practices Optimiza el dashboard de rentabilidad
```

### Fase 3: Testing (Tercero)

```bash
# 1. Crear property-based tests
@property-based-testing Implementa las 20 propiedades de correctitud

# 2. Generar arbitraries
@property-based-testing Crea arbitraries para Centavos, COGS, Profit, Margin

# 3. Stress tests
@property-based-testing Crea stress test para 1000+ productos
```

---

## 📊 Resumen de Cobertura

| Área | Skills Aplicables | Prioridad |
|------|-------------------|-----------|
| **Documentación** | api-documentation-generator, crafting-effective-readmes | 🔴 ALTA |
| **Cálculos Financieros** | financial-operations-expert, typescript-best-practices | 🔴 CRÍTICA |
| **Testing** | property-based-testing | 🔴 CRÍTICA |
| **Frontend** | vercel-react-best-practices | 🟡 MEDIA |
| **Type Safety** | typescript-best-practices | 🔴 ALTA |

---

## 🎓 Ejemplos de Uso

### Ejemplo 1: Validar Cálculo de COGS

```typescript
// Prompt:
@financial-operations-expert Valida este cálculo de COGS:

async function calculateCOGS(productId: string): Promise<COGS> {
  const recipe = await prisma.recipes.findUnique({
    where: { product_id: productId },
    include: { ingredients: true }
  });
  
  let totalCost = 0;
  for (const ingredient of recipe.ingredients) {
    const inventory = await prisma.inventory.findFirst({
      where: { code: ingredient.inventory_code }
    });
    
    totalCost += inventory.cost_cents * ingredient.quantity;
  }
  
  return totalCost as COGS;
}

// Resultado esperado:
// - Validación de tipos
// - Manejo de errores
// - Optimizaciones
// - Sugerencias de mejora
```

### Ejemplo 2: Crear Property Test

```typescript
// Prompt:
@property-based-testing Crea property test para esta propiedad:

// Propiedad: ganancia = precio - cogs
// Para todo precio >= 0 y cogs >= 0:
// calculateProfit(precio, cogs) === precio - cogs

// Resultado esperado:
fc.assert(
  fc.property(
    fc.integer({ min: 0, max: 1000000 }), // priceCents
    fc.integer({ min: 0, max: 1000000 }), // cogsCents
    (priceCents, cogsCents) => {
      const profit = calculateProfit(priceCents, cogsCents);
      return profit === priceCents - cogsCents;
    }
  ),
  { numRuns: 1000 }
);
```

### Ejemplo 3: Optimizar Dashboard

```typescript
// Prompt:
@vercel-react-best-practices Optimiza este componente:

export default function ProfitabilityDashboard() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    fetch('/api/admin/reports/profitability')
      .then(res => res.json())
      .then(setData);
  }, []);
  
  return (
    <div>
      <ProfitabilityTable data={data} />
      <MarginChart data={data} />
      <COGSBreakdown data={data} />
    </div>
  );
}

// Resultado esperado:
// - Usar SWR para caché
// - Lazy loading de gráficos
// - Memoización de cálculos
// - Code splitting
// - Skeleton loaders
```

---

## 📚 Recursos Adicionales

### Documentación de Skills

```bash
# Ver documentación de un skill
cat ~/.agents/skills/financial-operations-expert/SKILL.md
cat ~/.agents/skills/property-based-testing/SKILL.md
cat ~/.agents/skills/typescript-best-practices/SKILL.md
```

### Buscar Más Skills

```bash
# Buscar skills adicionales
npx skills find stress testing
npx skills find financial calculations
npx skills find react optimization
```

### Actualizar Skills

```bash
# Verificar actualizaciones
npx skills check

# Actualizar todos los skills
npx skills update
```

---

## ✅ Checklist de Uso

Antes de implementar cada tarea del spec, verificar:

- [ ] ¿Necesito documentar APIs? → Usar `@api-documentation-generator`
- [ ] ¿Estoy haciendo cálculos financieros? → Usar `@financial-operations-expert`
- [ ] ¿Necesito crear tests? → Usar `@property-based-testing`
- [ ] ¿Estoy escribiendo TypeScript? → Usar `@typescript-best-practices`
- [ ] ¿Estoy optimizando React? → Usar `@vercel-react-best-practices`
- [ ] ¿Necesito crear documentación? → Usar `@crafting-effective-readmes`

---

## 🎯 Próximos Pasos

1. **Leer documentación de cada skill:**
   ```bash
   cat ~/.agents/skills/financial-operations-expert/SKILL.md
   cat ~/.agents/skills/property-based-testing/SKILL.md
   cat ~/.agents/skills/typescript-best-practices/SKILL.md
   ```

2. **Comenzar con Tarea 1 del spec:**
   ```bash
   cat .kiro/specs/profitability-report/tasks.md
   ```

3. **Aplicar skills en orden:**
   - Documentación → Implementación → Testing

---

**Última actualización:** 17 de febrero de 2026  
**Skills instalados:** 6 (3 nuevos + 3 existentes)  
**Estado:** ✅ Listos para usar
