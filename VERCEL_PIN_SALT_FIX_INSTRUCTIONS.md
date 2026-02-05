# 🔴 INSTRUCCIONES: Actualizar PIN_SALT en Vercel

**Fecha:** 5 Febrero 2026  
**Status:** 🔴 ACCIÓN REQUERIDA  
**Tiempo estimado:** 5 minutos

---

## 🎯 Problema Confirmado

El `PIN_SALT` en Vercel es **diferente** al que se usó para generar los hashes en la base de datos.

### Evidencia

```json
{
  "pin_salt_en_vercel": "IrSv/3gTZtidQCQun6guBi8mkZLu7lmkOoJMFQqc8EU=",
  "pin_salt_esperado": "PARK_POS_2026_",
  "hash_generado_por_vercel": "51946944470e8220c299888bc23f19bb2ffc3298e6a17722185227ef9ad7a7c4",
  "hash_en_base_de_datos": "7702fd435c747e5c02f3a41b256a68f384f16a555308656d4e5cbc3eb80a0558",
  "coinciden": false
}
```

**Resultado:** El login falla porque los hashes no coinciden.

---

## ✅ Solución: Actualizar PIN_SALT en Vercel

### Paso 1: Ir a Vercel Dashboard

1. Abrir: https://vercel.com/dashboard
2. Seleccionar el proyecto **parkperu**

### Paso 2: Actualizar Environment Variable

1. Click en **Settings** (menú lateral izquierdo)
2. Click en **Environment Variables**
3. Buscar la variable `PIN_SALT`
4. Click en los 3 puntos (...) → **Edit**
5. Cambiar el valor a:
   ```
   PARK_POS_2026_
   ```
6. Seleccionar los ambientes:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
7. Click en **Save**

### Paso 3: Redeploy

Vercel rebuildeará automáticamente después de guardar la variable.

**O forzar redeploy:**
1. Ir a **Deployments** tab
2. Click en el último deployment
3. Click en los 3 puntos (...) → **Redeploy**

### Paso 4: Esperar Build

El build toma aproximadamente **2-3 minutos**.

Puedes monitorear el progreso en:
- https://vercel.com/dashboard → Deployments

---

## 🧪 Verificación

### Después del Redeploy

**1. Verificar que el PIN_SALT cambió:**

```bash
curl https://parkperu.vercel.app/api/debug/env
```

**Resultado esperado:**
```json
{
  "pin_salt_value": "PARK_POS_2026_",
  "test_pin_hash": "7702fd435c747e5c02f3a41b256a68f384f16a555308656d4e5cbc3eb80a0558"
}
```

✅ El `test_pin_hash` debe coincidir con el hash en la base de datos.

**2. Limpiar lockout:**

```bash
npx tsx scripts/clear-lockout-production.ts
```

**3. Probar login:**

1. Abrir: https://parkperu.vercel.app/
2. Ingresar PIN: **1234**
3. Verificar login exitoso ✅

---

## 🔐 Seguridad: Eliminar Debug Endpoint

**IMPORTANTE:** Después de verificar que el login funciona, eliminar el endpoint de debug:

```bash
# 1. Eliminar archivo
rm src/app/api/debug/env/route.ts

# 2. Commit
git add src/app/api/debug/env/route.ts
git commit -m "security: remove debug endpoint after PIN_SALT fix"

# 3. Push
git push
```

Vercel rebuildeará automáticamente y el endpoint ya no estará disponible.

---

## 📊 Checklist

- [ ] Actualizar `PIN_SALT` en Vercel Dashboard
- [ ] Esperar redeploy (2-3 min)
- [ ] Verificar endpoint `/api/debug/env`
- [ ] Limpiar lockout con script
- [ ] Probar login con PIN 1234
- [ ] Eliminar endpoint de debug
- [ ] Push a GitHub
- [ ] Verificar que endpoint ya no existe

---

## 🎯 Resultado Esperado

Después de seguir estos pasos:

✅ Login funciona con PIN 1234  
✅ Todos los empleados pueden autenticarse  
✅ Sistema listo para smoke tests  
✅ Endpoint de debug eliminado  

---

## 📝 Notas

### ¿Por qué pasó esto?

El `PIN_SALT` en Vercel probablemente se configuró con un valor diferente al que se usó para generar los hashes en la base de datos durante el seed.

### ¿Cómo evitarlo en el futuro?

1. Documentar el `PIN_SALT` en `.env.example`
2. Verificar que todas las env vars coinciden antes de deploy
3. Crear scripts de verificación pre-deploy
4. Mantener backup de env vars críticas

---

**Última actualización:** 5 Febrero 2026 - 19:30  
**Status:** 🟡 ESPERANDO ACCIÓN DEL USUARIO  
**Próximo paso:** Actualizar PIN_SALT en Vercel Dashboard
