# 🎯 Configuración Completa de Vercel - PARK POS

**Fecha:** 26 Enero 2026  
**Tiempo Total:** 10 minutos  
**Estado:** Listo para configurar

---

## 📋 SECRETS GENERADOS

**⚠️ IMPORTANTE: Guarda estos valores en un lugar seguro (password manager)**

```
JWT_SECRET=Pf81nroLuvTcaMvSzVCrqPDUCSqfNUb1X1PBpq28yLI=
PIN_SALT=IrSv/3gTZtidQCQun6guBi8mkZLu7lmkOoJMFQqc8EU=
PARK_API_SECRET=1fAUJXhx/likNZlpQZduLU4Z+bKp/gmJXFG7pgAzQcc=
ADMIN_API_KEY=m6lC/VbS0IV646lTVupHlI5euTZFm7Yu+zb91HNwIL0=
```

---

## 🔑 PASO A PASO: Configurar en Vercel

### 1. Ir a Vercel Dashboard

1. Abre https://vercel.com
2. Selecciona tu proyecto PARK POS
3. Click en **Settings** (menú lateral izquierdo)
4. Click en **Environment Variables**

---

### 2. Agregar Variable 1: TENANT_ID

```
Key:    TENANT_ID
Value:  a1b2c3d4-e5f6-7890-abcd-ef1234567890

Environments:
☑️ Production
☑️ Preview
☑️ Development
```

**Click "Save"**

---

### 3. Agregar Variable 2: LOCATION_ID

```
Key:    LOCATION_ID
Value:  loc-00000000-0000-0000-0000-000000000001

Environments:
☑️ Production
☑️ Preview
☑️ Development
```

**Click "Save"**

---

### 4. Agregar Variable 3: JWT_SECRET

```
Key:    JWT_SECRET
Value:  Pf81nroLuvTcaMvSzVCrqPDUCSqfNUb1X1PBpq28yLI=

Environments:
☑️ Production
☑️ Preview
☑️ Development
```

**Click "Save"**

---

### 5. Agregar Variable 4: PIN_SALT

```
Key:    PIN_SALT
Value:  IrSv/3gTZtidQCQun6guBi8mkZLu7lmkOoJMFQqc8EU=

Environments:
☑️ Production
☑️ Preview
☑️ Development
```

**Click "Save"**

---

## ✅ VERIFICACIÓN

### Paso 1: Esperar Redeploy Automático

Vercel automáticamente hará redeploy cuando agregues las variables.

1. Ve a la pestaña **Deployments**
2. Verás un nuevo deployment en progreso
3. Espera 2-3 minutos

---

### Paso 2: Verificar Build Logs

1. Click en el deployment en progreso
2. Ve a **Build Logs**
3. Busca estas líneas:

**✅ DEBE APARECER:**
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages (89/89)
✓ Finalizing page optimization
```

**❌ NO DEBE APARECER:**
```
CONFIGURATION ERROR: TENANT_ID must be configured
SECURITY ERROR: JWT_SECRET must be configured
SECURITY ERROR: PIN_SALT must be configured
```

---

### Paso 3: Probar la App

1. Abre tu app: `https://tu-app.vercel.app`
2. Debe cargar la pantalla de login
3. Ingresa PIN: `1234`
4. Debe entrar al sistema sin errores

---

### Paso 4: Verificar API Health

```bash
curl https://tu-app.vercel.app/api/health
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-26T..."
}
```

---

## 🎉 ¡LISTO!

Si todos los pasos anteriores funcionan:

✅ Build de Vercel pasa sin errores  
✅ App carga correctamente  
✅ Login con PIN 1234 funciona  
✅ API health check retorna 200  
✅ Sistema 100% operativo en producción

---

## 📊 RESUMEN DE VARIABLES CONFIGURADAS

| Variable | Valor | ¿Para qué sirve? |
|----------|-------|------------------|
| **DATABASE_URL** | (ya configurado) | Conexión a PostgreSQL |
| **TENANT_ID** | a1b2c3d4-... | Identifica tu negocio |
| **LOCATION_ID** | loc-00000000-... | Identifica la sucursal |
| **JWT_SECRET** | Pf81nroLuvTc... | Firma tokens de sesión |
| **PIN_SALT** | IrSv/3gTZtid... | Hash seguro de PINs |

---

## 🚨 SI ALGO SALE MAL

### Error: "CONFIGURATION ERROR: TENANT_ID must be configured"

**Causa:** Variable TENANT_ID no está en Vercel  
**Solución:**
1. Ve a Settings → Environment Variables
2. Verifica que TENANT_ID existe
3. Verifica que el valor es exactamente: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
4. Verifica que está seleccionado para Production, Preview y Development

---

### Error: "SECURITY ERROR: JWT_SECRET must be configured"

**Causa:** Variable JWT_SECRET no está en Vercel  
**Solución:**
1. Ve a Settings → Environment Variables
2. Verifica que JWT_SECRET existe
3. Verifica que el valor es exactamente: `Pf81nroLuvTcaMvSzVCrqPDUCSqfNUb1X1PBpq28yLI=`
4. Verifica que está seleccionado para Production, Preview y Development

---

### Error: "SECURITY ERROR: PIN_SALT must be configured"

**Causa:** Variable PIN_SALT no está en Vercel  
**Solución:**
1. Ve a Settings → Environment Variables
2. Verifica que PIN_SALT existe
3. Verifica que el valor es exactamente: `IrSv/3gTZtidQCQun6guBi8mkZLu7lmkOoJMFQqc8EU=`
4. Verifica que está seleccionado para Production, Preview y Development

---

### Login no funciona después de configurar

**Causa:** Variables configuradas pero con valores incorrectos  
**Solución:**
1. Verifica que copiaste los valores EXACTAMENTE como están arriba
2. Verifica que no hay espacios extra al inicio o final
3. Verifica que seleccionaste los 3 environments
4. Espera 1 minuto y recarga la página

---

### Build pasa pero app no carga

**Causa:** DATABASE_URL incorrecto o Supabase inactivo  
**Solución:**
1. Ve a Supabase Dashboard
2. Verifica que tu proyecto está activo
3. Ve a Settings → Database → Connection String
4. Copia el connection string completo
5. Ve a Vercel → Settings → Environment Variables
6. Actualiza DATABASE_URL con el nuevo valor

---

## 📞 SOPORTE ADICIONAL

Si después de seguir todos los pasos aún tienes problemas:

1. **Revisa los logs de Vercel**
   - Deployment → [Tu Deployment] → Logs
   - Busca errores específicos

2. **Verifica todas las variables**
   - Settings → Environment Variables
   - Confirma que las 5 variables están configuradas:
     - DATABASE_URL ✅
     - TENANT_ID ✅
     - LOCATION_ID ✅
     - JWT_SECRET ✅
     - PIN_SALT ✅

3. **Verifica build local**
   ```bash
   NODE_ENV=production npm run build
   ```
   - Si falla localmente, el problema es en el código
   - Si pasa localmente pero falla en Vercel, el problema es en las variables

---

## 🎓 DOCUMENTACIÓN DE REFERENCIA

- `POR_QUE_ESTAS_CONFIGURACIONES.md` - Explicación detallada de cada variable
- `VERCEL_ENV_UPDATE.md` - Guía paso a paso en español
- `VERCEL_BUILD_FIXES.md` - Análisis técnico completo
- `RESUMEN_SEGURIDAD_COMPLETO.md` - Resumen ejecutivo de seguridad

---

## ✅ CHECKLIST FINAL

Marca cada paso cuando lo completes:

### Configuración
- [ ] Generé los secrets (JWT_SECRET, PIN_SALT)
- [ ] Guardé los secrets en password manager
- [ ] Agregué TENANT_ID en Vercel
- [ ] Agregué LOCATION_ID en Vercel
- [ ] Agregué JWT_SECRET en Vercel
- [ ] Agregué PIN_SALT en Vercel
- [ ] Seleccioné los 3 environments para cada variable

### Verificación
- [ ] Esperé el redeploy automático
- [ ] Revisé los build logs (sin errores)
- [ ] Abrí la app en el navegador
- [ ] Probé login con PIN 1234
- [ ] Login funcionó correctamente
- [ ] Verifiqué API health check

### Resultado
- [ ] ✅ Sistema 100% operativo en producción

---

**Última actualización:** 26 Enero 2026  
**Estado:** Listo para configurar  
**Tiempo estimado:** 10 minutos  
**Próximo paso:** Ir a Vercel Dashboard y agregar las 4 variables
