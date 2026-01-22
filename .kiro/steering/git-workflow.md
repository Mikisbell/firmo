---
inclusion: always
---

# Git Workflow - Reglas de Commits y Push

## 🎯 Regla Principal: Agrupar Cambios Relacionados

**SIEMPRE agrupar en 1 solo commit:**
- Fix de código + su documentación
- Fix de código + análisis relacionado
- Cambios relacionados que forman una unidad lógica

## ✅ Flujo Correcto

```bash
# 1. Hacer TODOS los cambios relacionados
- Fix del código
- Análisis completo
- Actualizar documentación

# 2. Agregar TODO junto
git add archivo1.ts archivo2.md archivo3.ts

# 3. 1 solo commit con mensaje descriptivo
git commit -m "fix: descripción completa del fix + análisis"

# 4. 1 solo push
git push
```

## ❌ Evitar: Múltiples Commits/Push para lo Mismo

**MAL:**
```bash
git commit -m "fix: código"
git push
# ... hacer análisis ...
git commit -m "docs: documentación del fix"
git push
```

**BIEN:**
```bash
# Hacer fix + análisis + docs
git add -A
git commit -m "fix: código + análisis completo + documentación"
git push
```

## 📋 Cuándo SÍ Hacer Commits Separados

Solo cuando son cambios **independientes y no relacionados**:

```bash
# Commit 1: Feature A completa
git commit -m "feat: nueva funcionalidad A"

# Commit 2: Feature B completa (diferente)
git commit -m "feat: nueva funcionalidad B"

# 1 push con ambos commits
git push
```

## 🔍 Tipos de Commit (Conventional Commits)

- `fix:` - Corrección de bugs
- `feat:` - Nueva funcionalidad
- `docs:` - Solo documentación (sin cambios de código)
- `refactor:` - Refactorización sin cambiar funcionalidad
- `test:` - Agregar o modificar tests
- `chore:` - Cambios de build, dependencias, etc.
- `perf:` - Mejoras de performance
- `style:` - Cambios de formato (no afectan lógica)

## 💡 Ejemplos Correctos

### Ejemplo 1: Fix + Documentación
```bash
# Cambios:
# - src/api/route.ts (fix)
# - FIXES.md (documentación del fix)

git add src/api/route.ts FIXES.md
git commit -m "fix: await params in error handler + comprehensive analysis"
git push
```

### Ejemplo 2: Feature Completa
```bash
# Cambios:
# - src/feature.ts (código)
# - src/feature.test.ts (tests)
# - docs/feature.md (docs)

git add src/feature.ts src/feature.test.ts docs/feature.md
git commit -m "feat: nueva funcionalidad X con tests y documentación"
git push
```

### Ejemplo 3: Múltiples Fixes Independientes
```bash
# Fix 1: Problema A
git add fileA.ts
git commit -m "fix: problema A en módulo X"

# Fix 2: Problema B (diferente)
git add fileB.ts
git commit -m "fix: problema B en módulo Y"

# 1 push con ambos
git push
```

## 🚫 Anti-Patrones a Evitar

1. **Push inmediato sin análisis completo**
   - ❌ Push del fix → análisis → push de docs
   - ✅ Fix → análisis → docs → 1 push

2. **Commits de "oops, olvidé esto"**
   - ❌ commit "fix" → commit "forgot to update docs"
   - ✅ 1 commit completo desde el inicio

3. **Commits por archivo**
   - ❌ commit file1 → commit file2 → commit file3
   - ✅ 1 commit con todos los archivos relacionados

## 📝 Checklist Antes de Commit

Antes de hacer `git commit`, verificar:

- [ ] ¿Hice TODOS los cambios relacionados?
- [ ] ¿Actualicé la documentación correspondiente?
- [ ] ¿Hice el análisis completo si es necesario?
- [ ] ¿Los tests pasan?
- [ ] ¿El mensaje de commit es descriptivo?

Si todas las respuestas son SÍ → Hacer 1 commit + 1 push ✅

---

**Última actualización:** 22 Enero 2026
**Razón:** Evitar múltiples push innecesarios que generan ruido en el historial
