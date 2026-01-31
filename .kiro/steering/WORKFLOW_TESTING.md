---
inclusion: always
---

# 🔴 WORKFLOW DE TESTING OBLIGATORIO

**REGLA CRÍTICA:** NUNCA hacer `git push` sin probar localmente primero.

---

## ✅ Proceso Obligatorio Antes de Push

### 1. TypeScript Diagnostics
```bash
# Verificar errores de tipos
npx tsc --noEmit
```
O usar la herramienta `getDiagnostics` en los archivos modificados.

### 2. Build Local
```bash
npm run build
```
**Debe completar sin errores.** Si falla, NO hacer push.

### 3. Servidor de Desarrollo
```bash
npm run dev
```
**Debe arrancar correctamente.** Verificar que no hay errores en consola.

### 4. Tests (si aplica)
```bash
# Unit tests
npm test

# E2E tests (si modificaste funcionalidad crítica)
npm run test:e2e
```

### 5. Solo Entonces: Git Push
```bash
git add .
git commit -m "descripción del cambio"
git push
```

---

## ❌ Anti-Patrón: Usar Vercel como Compilador

**MAL:**
```bash
# Hacer cambio
git add .
git commit -m "fix"
git push
# Esperar a que Vercel compile
# Ver error en Vercel
# Hacer otro commit para arreglar
git commit -m "fix 2"
git push
# Repetir 5 veces...
```

**BIEN:**
```bash
# Hacer cambio
npm run build  # ← Probar localmente
# Si pasa, entonces:
git add .
git commit -m "fix completo y probado"
git push
```

---

## 📊 Comparación de Tiempo

| Enfoque | Tiempo Total | Commits |
|---------|--------------|---------|
| **Sin probar localmente** | 30-45 min | 5-6 commits |
| **Probando localmente** | 5-10 min | 1 commit |

**Ahorro:** 20-35 minutos por fix.

---

## 🎯 Checklist Pre-Push

Antes de hacer `git push`, verificar:

- [ ] ✅ `getDiagnostics` sin errores en archivos modificados
- [ ] ✅ `npm run build` completa exitosamente
- [ ] ✅ `npm run dev` arranca sin errores
- [ ] ✅ Tests relevantes pasan (si aplica)
- [ ] ✅ Commit message descriptivo

**Si todas las respuestas son SÍ → Hacer push ✅**

---

## 🔧 Comandos Rápidos

### Verificación Completa
```bash
# 1. TypeScript
npx tsc --noEmit

# 2. Build
npm run build

# 3. Dev server (Ctrl+C para detener)
npm run dev
```

### Solo Build (más rápido)
```bash
npm run build
```
Si el build pasa, el 95% de las veces Vercel también pasará.

---

## 📝 Lecciones Aprendidas

### Caso Real: Analytics Dashboard (27 Enero 2026)

**Problema:** Hice 5 commits/push sin probar localmente, usando Vercel como compilador.

**Errores encontrados:**
1. Faltaba `unsafeCentavos()` para branded types
2. Faltaban propiedades en `sales_by_payment_method`
3. Faltaba campo `last_updated`

**Tiempo perdido:** ~30 minutos en múltiples intentos.

**Solución correcta:**
```bash
npm run build  # ← Hubiera encontrado TODOS los errores en 1 minuto
```

**Resultado:** 1 solo commit en vez de 5.

---

## 🚨 Excepciones

**Cuándo SÍ puedes hacer push sin build local:**

1. **Cambios solo en documentación** (archivos `.md`)
2. **Cambios en configuración** (`.env.example`, `README.md`)
3. **Cambios en scripts** que no afectan el build

**Para TODO lo demás:** Probar localmente primero.

---

## 💡 Tips

### Build Rápido
Si solo modificaste frontend:
```bash
npm run build
```
Toma ~20-30 segundos.

### Build + Dev
Si modificaste backend o APIs:
```bash
npm run build && npm run dev
```
Verifica que las APIs funcionan correctamente.

### Watch Mode (desarrollo activo)
```bash
npm run dev
```
Deja corriendo mientras desarrollas. Verás errores en tiempo real.

---

## 🎓 Principio

> "El tiempo que ahorras al no probar localmente, lo pierdes multiplicado por 10 esperando builds de Vercel y haciendo múltiples commits."

**Probar localmente = Más rápido + Menos commits + Mejor historial de Git**

---

**Última actualización:** 27 Enero 2026  
**Razón:** Aprendizaje de error real en analytics dashboard  
**Impacto:** Crítico - Afecta velocidad de desarrollo y calidad del código
