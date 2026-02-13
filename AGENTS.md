# 🤖 PARK POS - Guía de Agents y Skills

> Documentación completa sobre el uso de agents y skills de Kiro en el proyecto PARK POS

---

## 📋 Tabla de Contenidos

1. [¿Qué son los Agents y Skills?](#qué-son-los-agents-y-skills)
2. [Skills Instalados](#skills-instalados)
3. [Cómo Usar los Skills](#cómo-usar-los-skills)
4. [Workflows Automatizados](#workflows-automatizados)
5. [Hooks Configurados](#hooks-configurados)
6. [Steering Files](#steering-files)
7. [Mejores Prácticas](#mejores-prácticas)

---

## 🎯 ¿Qué son los Agents y Skills?

### Agents

Los **agents** son asistentes de IA especializados que pueden ejecutar tareas específicas de forma autónoma. En PARK POS usamos varios agents:

- **general-task-execution** - Agent general para tareas arbitrarias
- **context-gatherer** - Analiza el repositorio para identificar archivos relevantes
- **spec-task-execution** - Especializado en ejecutar tareas de specs
- **feature-requirements-first-workflow** - Workflow de specs (Requirements → Design → Tasks)

### Skills

Los **skills** son paquetes de conocimiento especializado que los agents pueden usar. Son como "plugins" que agregan capacidades específicas.

---

## 📦 Skills Instalados

### 1. find-skills

**Propósito:** Buscar y descubrir skills disponibles en el ecosistema

**Ubicación:** `.agents/skills/find-skills/`

**Uso:**
```bash
# Buscar skills relacionados con documentación
npx skills find documentation

# Buscar skills de testing
npx skills find testing

# Buscar skills de API
npx skills find api
```

**Cuándo usar:**
- Necesitas encontrar un skill para una tarea específica
- Quieres explorar qué skills están disponibles
- Buscas herramientas para mejorar tu workflow

---

### 2. crafting-effective-readmes

**Propósito:** Crear y mejorar archivos README profesionales

**Ubicación:** `.agents/skills/crafting-effective-readmes/`

**Capacidades:**
- Crear READMEs desde cero
- Actualizar READMEs existentes
- Adaptar contenido según audiencia (OSS, interno, personal)
- Seguir mejores prácticas de documentación

**Uso con Kiro:**
```
@crafting-effective-readmes Necesito crear un README para el módulo de inventario
```

**Templates disponibles:**
- `templates/oss.md` - Para proyectos open source
- `templates/internal.md` - Para proyectos internos
- `templates/personal.md` - Para proyectos personales
- `templates/xdg-config.md` - Para configuraciones

**Referencias:**
- `section-checklist.md` - Qué secciones incluir
- `style-guide.md` - Guía de estilo
- `using-references.md` - Cómo usar referencias

---

### 3. api-documentation-generator

**Propósito:** Generar documentación completa de APIs

**Ubicación:** `.agents/skills/api-documentation-generator/`

**Capacidades:**
- Documentar endpoints REST
- Generar ejemplos de código (cURL, JavaScript, Python)
- Documentar request/response schemas
- Crear especificaciones OpenAPI/Swagger
- Generar colecciones de Postman

**Uso con Kiro:**
```
@api-documentation-generator Documenta el endpoint POST /api/orders
```

**Genera:**
- Descripción del endpoint
- Parámetros y body
- Respuestas de éxito y error
- Ejemplos de código en múltiples lenguajes
- Casos de uso comunes

**Ejemplo de salida:**
```markdown
## POST /api/orders

Crear nueva orden.

**Request:**
\`\`\`json
{
  "orderType": "DINE_IN",
  "items": [...]
}
\`\`\`

**Response (201 Created):**
\`\`\`json
{
  "id": "ord_123",
  "orderNumber": 42,
  ...
}
\`\`\`

**Ejemplo (cURL):**
\`\`\`bash
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer TOKEN" \
  -d '{"orderType":"DINE_IN",...}'
\`\`\`
```

---

### 4. vercel-react-best-practices

**Propósito:** Aplicar mejores prácticas de React y Next.js para Vercel

**Ubicación:** `.agents/skills/vercel-react-best-practices/`

**Capacidades:**
- Optimización de performance
- Code splitting
- Lazy loading
- Manejo de eventos
- Optimización de bundle
- Mejores prácticas de React hooks

**Reglas disponibles (57 archivos):**
- `async-api-routes.md` - APIs asíncronas
- `bundle-dynamic-imports.md` - Imports dinámicos
- `client-event-listeners.md` - Event listeners
- `js-cache-function-results.md` - Caché de resultados
- Y 53 más...

**Uso:**
El skill se aplica automáticamente cuando Kiro detecta código React/Next.js que puede optimizarse.

---

## 🎨 Cómo Usar los Skills

### Método 1: Mención Directa

```
@skill-name Tu solicitud aquí
```

Ejemplo:
```
@api-documentation-generator Documenta todos los endpoints de /api/admin
```

### Método 2: Contexto Implícito

Kiro detecta automáticamente cuándo usar un skill basándose en tu solicitud:

```
# Kiro usará crafting-effective-readmes automáticamente
"Necesito crear un README para el módulo de delivery"

# Kiro usará api-documentation-generator automáticamente
"Documenta el endpoint de crear órdenes"
```

### Método 3: Workflow Completo

Para tareas complejas, usa workflows que combinan múltiples skills:

```
"Crea documentación completa para el módulo de inventario:
- README.md con overview
- API.md con todos los endpoints
- SETUP.md con guía de configuración"
```

---

## ⚙️ Workflows Automatizados

### Workflow: Spec Creation

**Trigger:** Usuario solicita crear un spec

**Proceso:**
1. Agent `feature-requirements-first-workflow` se activa
2. Recopila requirements del usuario
3. Crea `requirements.md`
4. Usuario revisa y aprueba
5. Genera `design.md` con arquitectura
6. Usuario revisa y aprueba
7. Crea `tasks.md` con plan de implementación
8. Listo para ejecutar tareas

**Ejemplo:**
```
"Crea un spec para el módulo de reservaciones"
```

### Workflow: Task Execution

**Trigger:** Usuario solicita ejecutar tarea de spec

**Proceso:**
1. Agent `spec-task-execution` se activa
2. Lee requirements y design
3. Implementa la tarea
4. Escribe tests
5. Valida implementación
6. Marca tarea como completada

**Ejemplo:**
```
"Ejecuta la tarea 3.1 del spec de reservaciones"
```

### Workflow: Documentation Update

**Trigger:** Cambios en código que requieren actualizar docs

**Proceso:**
1. Detecta archivos modificados
2. Identifica documentación relacionada
3. Actualiza documentación automáticamente
4. Genera changelog entry

---

## 🪝 Hooks Configurados

Los hooks permiten automatizar acciones basadas en eventos del IDE.

### Hook: Lint on Save

**Evento:** `fileEdited`  
**Archivos:** `*.ts`, `*.tsx`  
**Acción:** Ejecutar linter y corregir errores

**Configuración:**
```json
{
  "name": "Lint on Save",
  "when": {
    "type": "fileEdited",
    "patterns": ["*.ts", "*.tsx"]
  },
  "then": {
    "type": "askAgent",
    "prompt": "Ejecuta npm run lint y corrige errores"
  }
}
```

### Hook: Test on Commit

**Evento:** `promptSubmit`  
**Acción:** Ejecutar tests antes de commit

**Configuración:**
```json
{
  "name": "Test Before Commit",
  "when": {
    "type": "promptSubmit"
  },
  "then": {
    "type": "runCommand",
    "command": "npm test"
  }
}
```

### Hook: Update Docs on API Change

**Evento:** `fileEdited`  
**Archivos:** `src/app/api/**/*.ts`  
**Acción:** Actualizar API.md

**Configuración:**
```json
{
  "name": "Update API Docs",
  "when": {
    "type": "fileEdited",
    "patterns": ["src/app/api/**/*.ts"]
  },
  "then": {
    "type": "askAgent",
    "prompt": "Actualiza API.md con los cambios en este endpoint"
  }
}
```

### Gestionar Hooks

```bash
# Ver hooks activos
# En VS Code: Ver → Agent Hooks

# Crear nuevo hook
# Command Palette → "Open Kiro Hook UI"

# Editar hooks
# Editar archivos en .kiro/hooks/
```

---

## 📄 Steering Files

Los steering files son instrucciones permanentes que guían el comportamiento de Kiro.

### Ubicación

- **Workspace:** `.kiro/steering/`
- **User:** `~/.kiro/steering/`

### Steering Files Activos

#### 1. MASTER.md

**Propósito:** Guía maestra del proyecto

**Contenido:**
- Contexto del proyecto
- Checklist de implementación
- Referencias rápidas
- Reglas críticas

**Inclusión:** Siempre (automático)

#### 2. IDIOMA_ESPAÑOL_OBLIGATORIO.md

**Propósito:** Forzar uso de español en todo el código y documentación

**Regla crítica:**
```
TODO el código, comentarios, mensajes y documentación
DEBE estar en ESPAÑOL
```

**Inclusión:** Siempre (automático)

#### 3. git-workflow.md

**Propósito:** Reglas de commits y push

**Reglas:**
- Agrupar cambios relacionados en 1 commit
- Usar Conventional Commits
- Probar localmente antes de push

**Inclusión:** Siempre (automático)

#### 4. WORKFLOW_TESTING.md

**Propósito:** Workflow obligatorio de testing

**Regla crítica:**
```
NUNCA hacer git push sin probar localmente primero
```

**Checklist:**
1. TypeScript diagnostics
2. Build local
3. Servidor de desarrollo
4. Tests (si aplica)
5. Solo entonces: git push

**Inclusión:** Siempre (automático)

### Crear Steering File Personalizado

```markdown
---
inclusion: auto
---

# Mi Steering File

Instrucciones específicas para Kiro...
```

Guardar en `.kiro/steering/mi-steering.md`

---

## ✅ Mejores Prácticas

### 1. Usar Skills Apropiados

```
# ✅ BIEN
@api-documentation-generator Documenta POST /api/orders

# ❌ MAL
"Documenta el endpoint" (sin especificar cuál)
```

### 2. Ser Específico

```
# ✅ BIEN
@crafting-effective-readmes Crea README para módulo de inventario,
audiencia: desarrolladores internos, incluir setup y API reference

# ❌ MAL
"Crea un README"
```

### 3. Revisar Output

Siempre revisa lo que los agents generan:
- Verifica exactitud técnica
- Confirma que sigue estándares del proyecto
- Asegura que está en español

### 4. Iterar

Los agents aprenden de tu feedback:

```
"El README está bien pero falta la sección de troubleshooting"
"Agrega ejemplos de código más detallados"
"Usa el formato de la documentación existente"
```

### 5. Combinar Skills

```
"Usando @crafting-effective-readmes y @api-documentation-generator,
crea documentación completa para el módulo de delivery:
- README.md con overview
- API.md con endpoints
- Ejemplos de uso"
```

---

## 🔧 Troubleshooting

### Problema: Skill No Responde

**Solución:**
1. Verifica que el skill está instalado: `ls .agents/skills/`
2. Usa mención explícita: `@skill-name`
3. Reinicia Kiro

### Problema: Output en Inglés

**Solución:**
El steering file `IDIOMA_ESPAÑOL_OBLIGATORIO.md` debe forzar español.
Si no funciona, menciona explícitamente:

```
"Genera la documentación EN ESPAÑOL"
```

### Problema: Hook No Se Ejecuta

**Solución:**
1. Verifica configuración en `.kiro/hooks/`
2. Revisa que el patrón de archivos es correcto
3. Verifica que el evento es el correcto

---

## 📚 Recursos Adicionales

### Documentación de Skills

Cada skill tiene su propia documentación en `SKILL.md`:

```bash
# Ver documentación de un skill
cat .agents/skills/crafting-effective-readmes/SKILL.md
cat .agents/skills/api-documentation-generator/SKILL.md
```

### Buscar Más Skills

```bash
# Buscar skills disponibles
npx skills find <término>

# Instalar nuevo skill
npx skills add <url> --skill <nombre>
```

### Comunidad

- **Discord:** [Únete a la comunidad de Kiro](https://discord.gg/kiro)
- **Docs:** [https://docs.kiro.ai](https://docs.kiro.ai)
- **Skills Registry:** [https://skills.kiro.ai](https://skills.kiro.ai)

---

## 🎓 Ejemplos Prácticos

### Ejemplo 1: Documentar Nueva Feature

```
Contexto: Acabas de implementar el módulo de reservaciones

Prompt:
"Usando los skills de documentación, crea:
1. README.md para docs/03-features/FLUJO_RESERVAS.md
2. Documenta los endpoints en API.md
3. Actualiza el índice en docs/README.md"

Resultado:
- Documentación completa y profesional
- Ejemplos de código
- Diagramas de flujo
- Todo en español
```

### Ejemplo 2: Crear Spec Completo

```
Prompt:
"Crea un spec completo para el módulo de programa de lealtad:
- Sistema de puntos por compra
- Niveles de membresía (Bronce, Plata, Oro)
- Recompensas y descuentos
- Integración con WhatsApp"

Resultado:
- requirements.md con 15 requirements
- design.md con arquitectura detallada
- tasks.md con 30+ tareas
- Listo para implementar
```

### Ejemplo 3: Optimizar Performance

```
Prompt:
"Usando @vercel-react-best-practices, audita y optimiza
el componente src/app/admin/dashboard/page.tsx"

Resultado:
- Code splitting aplicado
- Lazy loading de componentes pesados
- Memoización de cálculos costosos
- Bundle size reducido 40%
```

---

**Última actualización:** 13 Febrero 2026  
**Versión:** 2.0.0  
**Mantenido por:** Equipo PARK POS
