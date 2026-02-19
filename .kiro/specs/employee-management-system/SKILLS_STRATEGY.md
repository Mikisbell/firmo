# Estrategia de Uso de Skills - Sistema de RRHH

## 📊 Skills Instalados Actualmente

### 1. api-documentation-generator ✅
**Descripción:** Genera documentación completa de APIs con ejemplos en múltiples lenguajes

**Cuándo usar:**
- ✅ **Fase 6** (después de implementar APIs REST)
- ✅ Al completar cada grupo de endpoints

**Beneficios:**
- Documentación automática de 50+ endpoints
- Ejemplos en cURL, JavaScript, Python
- Colección de Postman
- Especificación OpenAPI/Swagger

**Ejemplo de uso:**
```
@api-documentation-generator Documenta todos los endpoints de /api/hr/employees
```

### 2. crafting-effective-readmes ✅
**Descripción:** Crea READMEs profesionales adaptados a la audiencia

**Cuándo usar:**
- ✅ Al completar cada fase
- ✅ Para documentar cada servicio
- ✅ Para guías de usuario

**Beneficios:**
- READMEs claros y estructurados
- Adaptados a desarrolladores o usuarios finales
- Templates para diferentes tipos de proyectos

**Ejemplo de uso:**
```
@crafting-effective-readmes Crea README para el módulo de gestión de empleados
```

### 3. vercel-react-best-practices ✅
**Descripción:** 57 reglas de optimización para React/Next.js de Vercel Engineering

**Cuándo usar:**
- ✅ **Fase 7** (UI Admin Panel)
- ✅ **Fase 8** (UI Employee Self-Service)
- ✅ Durante refactoring de componentes

**Beneficios:**
- Performance óptimo en React/Next.js
- Bundle size optimization
- Lazy loading correcto
- Memoización efectiva
- Eliminación de waterfalls

**Ejemplo de uso:**
```
@vercel-react-best-practices Optimiza el componente EmployeeTable
```

### 4. find-skills ✅
**Descripción:** Busca y descubre skills del ecosistema

**Cuándo usar:**
- ✅ Cuando necesites capacidades específicas
- ✅ Para explorar nuevas herramientas

**Ejemplo de uso:**
```
@find-skills Busca skills para testing
```

## 🎯 Skills Recomendados para Instalar

### 1. property-based-testing (RECOMENDADO)
**Fuente:** `trailofbits/skills@property-based-testing` (605 installs)

**Por qué lo necesitamos:**
- El spec tiene **76 correctness properties** para property-based testing
- Necesitamos escribir tests con fast-check
- Validación exhaustiva de lógica de negocio

**Instalar:**
```bash
npx skills add trailofbits/skills@property-based-testing -g -y
```

**Cuándo usar:**
- ✅ **Todas las fases** (cada tarea tiene property tests)
- ✅ Especialmente Fase 4 (cálculos de planilla)
- ✅ Fase 9 (sincronización offline)

### 2. webapp-testing (RECOMENDADO)
**Fuente:** `anthropics/skills@webapp-testing` (11.6K installs)

**Por qué lo necesitamos:**
- Testing de componentes React
- Integration tests
- E2E tests con Playwright

**Instalar:**
```bash
npx skills add anthropics/skills@webapp-testing -g -y
```

**Cuándo usar:**
- ✅ **Fase 7 y 8** (UI testing)
- ✅ **Fase 12** (testing completo)

### 3. javascript-testing-patterns (OPCIONAL)
**Fuente:** `wshobson/agents@javascript-testing-patterns` (2.7K installs)

**Por qué podría ser útil:**
- Patrones de testing para TypeScript
- Unit tests efectivos
- Mocking y stubbing

**Instalar:**
```bash
npx skills add wshobson/agents@javascript-testing-patterns -g -y
```

## 📅 Plan de Uso por Fase

### Fase 1: Schema y Modelos Base
**Skills a usar:** Ninguno
- Implementación directa de Prisma schema
- TypeScript types

### Fase 2: Event Schemas y Reducers
**Skills a usar:**
- ✅ `property-based-testing` (si instalado)
- Para validar event replay y reducers

### Fase 3: Servicios Core
**Skills a usar:**
- ✅ `property-based-testing` (si instalado)
- Para validar lógica de negocio

### Fase 4: Servicios de Planilla
**Skills a usar:**
- ✅ `property-based-testing` (CRÍTICO)
- Validar cálculos de dinero (CTS, gratificaciones, horas extras)
- Asegurar precisión al centavo

### Fase 5: Servicios de Solicitudes
**Skills a usar:**
- ✅ `property-based-testing` (si instalado)
- Validar flujos de aprobación

### Fase 6: APIs REST
**Skills a usar:**
- ✅ `api-documentation-generator` (CRÍTICO)
- Documentar todos los endpoints
- Generar colección de Postman

### Fase 7: UI Admin Panel
**Skills a usar:**
- ✅ `vercel-react-best-practices` (CRÍTICO)
- Optimizar componentes pesados (tablas, calendarios)
- Bundle optimization
- ✅ `webapp-testing` (si instalado)
- Testing de componentes

### Fase 8: UI Employee Self-Service
**Skills a usar:**
- ✅ `vercel-react-best-practices` (CRÍTICO)
- Optimizar para mobile
- Performance crítico
- ✅ `webapp-testing` (si instalado)
- Testing de flujos de usuario

### Fase 9: Soporte Offline
**Skills a usar:**
- ✅ `property-based-testing` (CRÍTICO)
- Validar sincronización
- Validar resolución de conflictos

### Fase 10: Reportes y Analytics
**Skills a usar:**
- ✅ `vercel-react-best-practices`
- Optimizar gráficos y tablas
- ✅ `api-documentation-generator`
- Documentar endpoints de reportes

### Fase 11: Notificaciones
**Skills a usar:**
- ✅ `property-based-testing` (si instalado)
- Validar lógica de notificaciones

### Fase 12: Testing Completo
**Skills a usar:**
- ✅ `property-based-testing` (CRÍTICO)
- ✅ `webapp-testing` (CRÍTICO)
- ✅ `javascript-testing-patterns` (si instalado)
- Testing exhaustivo de todo el sistema

## 🚀 Recomendación de Instalación

### Instalar AHORA (antes de Fase 1):
```bash
# Property-based testing (CRÍTICO para el proyecto)
npx skills add trailofbits/skills@property-based-testing -g -y

# Webapp testing (útil para Fases 7-8)
npx skills add anthropics/skills@webapp-testing -g -y
```

### Instalar DESPUÉS (según necesidad):
```bash
# JavaScript testing patterns (opcional)
npx skills add wshobson/agents@javascript-testing-patterns -g -y
```

## 💡 Cómo Usar los Skills

### Sintaxis General
```
@skill-name Tu solicitud aquí
```

### Ejemplos Prácticos

#### 1. Property-Based Testing
```
@property-based-testing Escribe property test para validar que el cálculo de CTS 
siempre retorna un valor positivo y nunca excede el salario anual
```

#### 2. API Documentation
```
@api-documentation-generator Documenta el endpoint POST /api/hr/employees con 
ejemplos en cURL, JavaScript y Python
```

#### 3. React Optimization
```
@vercel-react-best-practices Optimiza el componente EmployeeTable que renderiza 
1000+ empleados. Necesito lazy loading y virtualización
```

#### 4. README Creation
```
@crafting-effective-readmes Crea README para el servicio PayrollService. 
Audiencia: desarrolladores internos. Incluir ejemplos de uso y arquitectura
```

## 📊 Resumen de Beneficios

| Skill | Fase | Impacto | Prioridad |
|-------|------|---------|-----------|
| property-based-testing | 2-12 | 🔴 CRÍTICO | Alta |
| api-documentation-generator | 6, 10 | 🟡 ALTO | Media |
| vercel-react-best-practices | 7, 8, 10 | 🟡 ALTO | Media |
| webapp-testing | 7, 8, 12 | 🟢 MEDIO | Media |
| crafting-effective-readmes | Todas | 🟢 MEDIO | Baja |
| javascript-testing-patterns | 12 | 🟢 BAJO | Baja |

## 🎯 Próximos Pasos

1. **Instalar skills recomendados:**
   ```bash
   npx skills add trailofbits/skills@property-based-testing -g -y
   npx skills add anthropics/skills@webapp-testing -g -y
   ```

2. **Verificar instalación:**
   ```bash
   npx skills list
   ```

3. **Empezar Fase 1** con los skills disponibles

---

**Nota:** Los skills se activan automáticamente cuando mencionas su nombre con `@` o cuando el contexto de tu solicitud coincide con sus capacidades.
