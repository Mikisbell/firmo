# 🌅 Plan de Trabajo - Módulo de Rentabilidad
## Mañana 18 de Febrero 2026 - Primera Hora

> Guía completa para comenzar la implementación del módulo de rentabilidad de PARK POS

---

## ✅ Estado Actual (17 Feb 2026 - 11:00 PM)

### Completado Hoy

1. **✅ Spec Completo Creado**
   - `requirements.md` - 15 requirements, 75 acceptance criteria
   - `design.md` + `design-part2.md` + `design-part3.md` - Arquitectura completa
   - `tasks.md` - 16 tareas principales, 60+ sub-tareas
   - `README.md` - Documentación navegable

2. **✅ Skills Instalados (3 nuevos)**
   - 🏦 Financial Operations Expert (673 instalaciones)
   - 🧪 Property-Based Testing (583 instalaciones)
   - 📘 TypeScript Best Practices (393 instalaciones)

3. **✅ Documentación Preparada**
   - `SKILLS_INSTALADOS.md` - Guía completa de uso de skills
   - Ejemplos prácticos de cada skill
   - Checklist de aplicación

### Pendiente para Mañana

- [ ] Implementar Tarea 1: Setup de infraestructura
- [ ] Implementar Tarea 2: Servicios core
- [ ] Implementar Tarea 3: APIs REST
- [ ] Implementar Tarea 4: Dashboard UI
- [ ] Testing completo

---

## 🎯 Plan de Acción - Mañana 18 Feb 2026

### ⏰ Sesión 1: Primera Hora (8:00 AM - 9:00 AM)

#### Paso 1: Revisar Documentación (10 min)

```bash
# 1. Abrir el spec completo
code .kiro/specs/profitability-report/

# 2. Leer archivos en orden:
# - README.md (5 min) - Overview general
# - requirements.md (3 min) - Qué debe hacer
# - design.md (2 min) - Cómo se implementa
```

**Archivos clave:**
- `.kiro/specs/profitability-report/README.md` - Punto de entrada
- `.kiro/specs/profitability-report/SKILLS_INSTALADOS.md` - Guía de skills
- `.kiro/specs/profitability-report/tasks.md` - Plan de implementación

#### Paso 2: Verificar Skills Instalados (5 min)

```bash
# Verificar que los 3 skills nuevos están instalados
ls ~/.agents/skills/

# Deberías ver:
# - financial-operations-expert/
# - property-based-testing/
# - typescript-best-practices/
# - vercel-react-best-practices/ (ya existía)
# - api-documentation-generator/ (ya existía)
# - crafting-effective-readmes/ (ya existía)
```

**Si falta alguno, reinstalar:**
```bash
npx skills add shipshitdev/library@financial-operations-expert -g -y
npx skills add trailofbits/skills@property-based-testing -g -y
npx skills add 0xbigboss/claude-code@typescript-best-practices -g -y
```

#### Paso 3: Comenzar con Tarea 1 - Setup (45 min)

**Tarea 1: Setup de Infraestructura**

```bash
# Decirle a Kiro:
"Ejecuta la Tarea 1 del spec de rentabilidad:
.kiro/specs/profitability-report/tasks.md

Usa los skills instalados:
- @typescript-best-practices para branded types
- @financial-operations-expert para validar tipos financieros

Implementa:
1.1 Branded types (Centavos, COGS, Profit, Margin)
1.2 Helpers de conversión
1.3 Validadores de rangos
1.4 Tests unitarios (10 tests mínimo)
1.5 Tests de propiedades (5 properties mínimo)"
```

**Resultado esperado:**
- `src/core/types/profitability.ts` - Branded types
- `src/core/domain/profitability.ts` - Helpers y validadores
- `src/core/domain/__tests__/profitability.unit.test.ts` - Unit tests
- `src/core/domain/__tests__/profitability.property.test.ts` - Property tests

---

### ⏰ Sesión 2: Segunda Hora (9:00 AM - 10:00 AM)

#### Paso 4: Implementar Tarea 2 - Servicios Core (60 min)

```bash
# Decirle a Kiro:
"Ejecuta la Tarea 2 del spec de rentabilidad:

Usa los skills:
- @financial-operations-expert para cálculos de COGS
- @typescript-best-practices para arquitectura limpia

Implementa:
2.1 ProfitabilityService con cálculo de COGS
2.2 Integración con Prisma (recipes, inventory)
2.3 Caché con Redis (TTL 5 min)
2.4 Event Sourcing (PROFITABILITY_CALCULATED)
2.5 Tests unitarios (15 tests)
2.6 Tests de propiedades (8 properties)"
```

**Resultado esperado:**
- `src/core/services/profitability.service.ts` - Servicio principal
- `src/core/services/__tests__/profitability.service.unit.test.ts` - Unit tests
- `src/core/services/__tests__/profitability.service.property.test.ts` - Property tests
- `src/core/domain/events.ts` - Evento PROFITABILITY_CALCULATED

---

### ⏰ Sesión 3: Tercera Hora (10:00 AM - 11:00 AM)

#### Paso 5: Implementar Tarea 3 - APIs REST (60 min)

```bash
# Decirle a Kiro:
"Ejecuta la Tarea 3 del spec de rentabilidad:

Usa los skills:
- @api-documentation-generator para documentar endpoints
- @typescript-best-practices para validación Zod

Implementa los 3 endpoints:
3.1 GET /api/admin/reports/profitability
3.2 GET /api/admin/reports/profit-by-product/:id
3.3 GET /api/admin/reports/margin-analysis

Con:
- Validación Zod de query params
- Autenticación JWT (rol ADMIN/MANAGER)
- Rate limiting
- Tests de integración (12 tests)
- Documentación OpenAPI"
```

**Resultado esperado:**
- `src/app/api/admin/reports/profitability/route.ts`
- `src/app/api/admin/reports/profit-by-product/[id]/route.ts`
- `src/app/api/admin/reports/margin-analysis/route.ts`
- `src/app/api/admin/reports/__tests__/profitability.integration.test.ts`
- `docs/api/PROFITABILITY_API.md` - Documentación completa

---

### ⏰ Sesión 4: Cuarta Hora (11:00 AM - 12:00 PM)

#### Paso 6: Implementar Tarea 4 - Dashboard UI (60 min)

```bash
# Decirle a Kiro:
"Ejecuta la Tarea 4 del spec de rentabilidad:

Usa los skills:
- @vercel-react-best-practices para optimización
- @typescript-best-practices para componentes type-safe

Implementa el dashboard:
4.1 ProfitabilityTable con sorting y filtering
4.2 MarginChart (lazy loaded)
4.3 COGSBreakdown (lazy loaded)
4.4 ProfitTrendChart (lazy loaded)
4.5 ExportButton (CSV/Excel)

Con:
- SWR para caché de datos
- Code splitting del dashboard
- Skeleton loaders
- Tests de componentes (8 tests)"
```

**Resultado esperado:**
- `src/app/admin/reports/profitability/page.tsx` - Dashboard principal
- `src/app/admin/reports/profitability/components/ProfitabilityTable.tsx`
- `src/app/admin/reports/profitability/components/MarginChart.tsx`
- `src/app/admin/reports/profitability/components/COGSBreakdown.tsx`
- `src/app/admin/reports/profitability/components/ProfitTrendChart.tsx`
- `src/app/admin/reports/profitability/__tests__/page.test.tsx`

---

## 📊 Progreso Esperado al Final del Día

| Tarea | Tiempo | Estado Esperado |
|-------|--------|-----------------|
| Tarea 1: Setup | 45 min | ✅ Completo |
| Tarea 2: Servicios | 60 min | ✅ Completo |
| Tarea 3: APIs | 60 min | ✅ Completo |
| Tarea 4: Dashboard | 60 min | ✅ Completo |
| **Total** | **4 horas** | **4/16 tareas (25%)** |

---

## 🎯 Comandos Rápidos para Mañana

### Iniciar Sesión de Trabajo

```bash
# 1. Abrir VS Code en el proyecto
cd E:\FREECLOUD\FREECLOUD-IA\PROYECTOS\park
code .

# 2. Abrir el spec
code .kiro/specs/profitability-report/

# 3. Abrir tasks.md
code .kiro/specs/profitability-report/tasks.md
```

### Verificar Estado

```bash
# Ver skills instalados
ls ~/.agents/skills/

# Ver estructura del spec
ls -la .kiro/specs/profitability-report/

# Ver tareas pendientes
cat .kiro/specs/profitability-report/tasks.md | grep "\[ \]"
```

### Ejecutar Tests

```bash
# Después de implementar cada tarea, ejecutar tests
npm test -- profitability

# Ver cobertura
npm test -- --coverage profitability
```

---

## 💡 Tips para Mañana

### 1. Usar Skills Correctamente

**Formato correcto:**
```
@financial-operations-expert Valida este cálculo de COGS
@property-based-testing Crea property test para margen
@typescript-best-practices Revisa estos branded types
```

**NO hacer:**
```
"Usa el skill de financial operations"  ❌
"financial-operations-expert ayúdame"   ❌
```

### 2. Seguir el Orden de Tareas

No saltar tareas. El orden es importante:
1. Setup (tipos y helpers)
2. Servicios (lógica de negocio)
3. APIs (endpoints REST)
4. Dashboard (UI)
5. Testing (validación completa)

### 3. Validar Después de Cada Tarea

```bash
# Después de cada tarea:
npm run build          # Verificar que compila
npm test              # Verificar que tests pasan
npm run dev           # Verificar que funciona
```

### 4. Documentar Mientras Implementas

Cada vez que completes una tarea, actualizar:
- `tasks.md` - Marcar tarea como completada `[x]`
- Crear archivo `TASK_X_COMPLETE.md` con resumen

---

## 🚨 Problemas Comunes y Soluciones

### Problema 1: Skill No Responde

**Síntoma:** Mencionas `@skill-name` pero no hace nada

**Solución:**
```bash
# Verificar que está instalado
ls ~/.agents/skills/skill-name/

# Si no está, reinstalar
npx skills add owner/repo@skill-name -g -y

# Reiniciar Kiro
```

### Problema 2: Tests Fallan

**Síntoma:** Tests de property-based fallan con counterexamples

**Solución:**
```bash
# Leer el counterexample
# Ajustar el código o el test
# Volver a ejecutar

# Si persiste, pedir ayuda:
@property-based-testing Analiza este counterexample: [pegar output]
```

### Problema 3: Build Falla

**Síntoma:** `npm run build` falla con errores de TypeScript

**Solución:**
```bash
# Ver errores detallados
npx tsc --noEmit

# Usar getDiagnostics en Kiro
# Pedir ayuda:
@typescript-best-practices Corrige estos errores de tipos
```

---

## 📚 Recursos de Referencia

### Documentación del Spec

| Archivo | Propósito | Cuándo Leer |
|---------|-----------|-------------|
| `README.md` | Overview general | Inicio del día |
| `requirements.md` | Qué debe hacer | Antes de cada tarea |
| `design.md` | Cómo implementar | Durante implementación |
| `tasks.md` | Plan de trabajo | Todo el tiempo |
| `SKILLS_INSTALADOS.md` | Guía de skills | Cuando uses skills |

### Ejemplos de Código

**Ejemplo 1: Branded Type**
```typescript
// src/core/types/profitability.ts
export type Centavos = number & { __brand: 'Centavos' };
export type COGS = number & { __brand: 'COGS' };
export type Profit = number & { __brand: 'Profit' };
export type Margin = number & { __brand: 'Margin' };

export const toCentavos = (n: number): Centavos => n as Centavos;
export const toCOGS = (n: number): COGS => n as COGS;
export const toProfit = (n: number): Profit => n as Profit;
export const toMargin = (n: number): Margin => n as Margin;
```

**Ejemplo 2: Cálculo de COGS**
```typescript
// src/core/services/profitability.service.ts
async calculateCOGS(productId: string): Promise<COGS> {
  const recipe = await prisma.recipes.findUnique({
    where: { product_id: productId },
    include: { ingredients: true }
  });
  
  if (!recipe) {
    throw new Error(`Recipe not found for product ${productId}`);
  }
  
  let totalCost = 0;
  for (const ingredient of recipe.ingredients) {
    const inventory = await prisma.inventory.findFirst({
      where: { code: ingredient.inventory_code }
    });
    
    if (!inventory) {
      throw new Error(`Inventory not found: ${ingredient.inventory_code}`);
    }
    
    totalCost += inventory.cost_cents * ingredient.quantity;
  }
  
  return toCOGS(totalCost);
}
```

**Ejemplo 3: Property Test**
```typescript
// src/core/domain/__tests__/profitability.property.test.ts
import fc from 'fast-check';

describe('Profitability Properties', () => {
  it('ganancia = precio - cogs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }), // priceCents
        fc.integer({ min: 0, max: 1000000 }), // cogsCents
        (priceCents, cogsCents) => {
          const profit = calculateProfit(
            toCentavos(priceCents),
            toCOGS(cogsCents)
          );
          return profit === priceCents - cogsCents;
        }
      ),
      { numRuns: 1000 }
    );
  });
});
```

---

## ✅ Checklist Pre-Inicio (Mañana 8:00 AM)

Antes de comenzar, verificar:

- [ ] ✅ VS Code abierto en el proyecto
- [ ] ✅ Spec abierto en `.kiro/specs/profitability-report/`
- [ ] ✅ Skills verificados con `ls ~/.agents/skills/`
- [ ] ✅ `tasks.md` abierto para seguimiento
- [ ] ✅ Terminal lista para ejecutar comandos
- [ ] ✅ Café preparado ☕

---

## 🎯 Objetivo del Día

**Meta:** Completar las primeras 4 tareas del spec (25% del módulo)

**Entregables:**
1. ✅ Branded types y helpers funcionando
2. ✅ ProfitabilityService con cálculo de COGS
3. ✅ 3 endpoints REST documentados
4. ✅ Dashboard UI básico funcionando
5. ✅ 45+ tests pasando (unit + property + integration)

**Criterio de éxito:**
```bash
npm run build  # ✅ Sin errores
npm test       # ✅ 45+ tests passing
npm run dev    # ✅ Dashboard visible en /admin/reports/profitability
```

---

## 📞 Si Necesitas Ayuda

### Durante la Implementación

```bash
# Pedir ayuda específica a un skill
@financial-operations-expert ¿Cómo valido este cálculo de margen?
@property-based-testing ¿Cómo genero arbitraries para Centavos?
@typescript-best-practices ¿Cómo implemento este branded type?
```

### Si Te Atascas

1. **Lee la documentación del spec** - Probablemente la respuesta está ahí
2. **Revisa ejemplos en el código existente** - Busca patrones similares
3. **Consulta SKILLS_INSTALADOS.md** - Ejemplos prácticos de cada skill
4. **Pide ayuda a Kiro** - Sé específico con tu pregunta

---

## 🎉 Motivación

Estás a punto de implementar un módulo completo que permitirá a las pollerías:

- 💰 Saber exactamente cuánto ganan por cada pollo vendido
- 📊 Identificar productos más y menos rentables
- 🎯 Optimizar precios basándose en costos reales
- 📈 Tomar decisiones de negocio informadas

**¡Es un módulo que genera valor real!**

---

## 📅 Próximos Pasos (Después del 18 Feb)

Una vez completes las primeras 4 tareas:

- **Día 2:** Tareas 5-8 (Testing completo + Optimizaciones)
- **Día 3:** Tareas 9-12 (Features avanzadas + Exportación)
- **Día 4:** Tareas 13-16 (Documentación + Deployment)

---

**Última actualización:** 17 de febrero de 2026 - 11:00 PM  
**Preparado por:** Kiro AI  
**Para:** Sesión de trabajo del 18 de febrero de 2026

**¡Buena suerte mañana! 🚀**
