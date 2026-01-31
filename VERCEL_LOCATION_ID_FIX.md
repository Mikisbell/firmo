# 🔧 Fix: LOCATION_ID Incorrecto en Vercel

**Fecha:** 23 Enero 2026  
**Problema:** LOCATION_ID en Vercel no coincide con el código y base de datos

---

## 🚨 PROBLEMA DETECTADO

Tienes configurado en Vercel:
```
LOCATION_ID = bfd72044-130d-40cc-acdf-6abb94c97f7c
```

Pero el código y base de datos esperan:
```
LOCATION_ID = loc-00000000-0000-0000-0000-000000000001
```

**Esto causará errores** porque:
- Los datos en tu base de datos usan `loc-00000000-0000-0000-0000-000000000001`
- El seed crea zonas, mesas, y configuración con ese ID
- El código busca datos con ese ID
- Si usas un ID diferente, no encontrará nada

---

## ✅ SOLUCIÓN (2 minutos)

### Paso 1: Ir a Vercel Dashboard

1. Abre https://vercel.com
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**

### Paso 2: Editar LOCATION_ID

1. Busca la variable `LOCATION_ID`
2. Click en los **3 puntos** (⋮) al lado derecho
3. Click en **Edit**
4. Cambia el valor a:
   ```
   loc-00000000-0000-0000-0000-000000000001
   ```
5. Verifica que esté seleccionado para:
   - ☑️ Production
   - ☑️ Preview
   - ☑️ Development
6. Click **Save**

### Paso 3: Verificar

Vercel automáticamente hará redeploy. Espera 2-3 minutos.

---

## 📋 VALORES CORRECTOS PARA VERCEL

Copia y pega estos valores exactos:

### TENANT_ID
```
a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### LOCATION_ID (CORREGIR ESTE)
```
loc-00000000-0000-0000-0000-000000000001
```

### JWT_SECRET
```
<generar con: npx tsx scripts/generate-secrets.ts>
```

### PIN_SALT
```
<generar con: npx tsx scripts/generate-secrets.ts>
```

---

## 🔍 POR QUÉ ESTE VALOR ESPECÍFICO

Este `LOCATION_ID` está hardcodeado en varios lugares:

1. **Seed Data** (`prisma/seed.ts`):
   ```typescript
   const locationId = DEFAULT_LOCATION_ID; // loc-00000000-0000-0000-0000-000000000001
   ```

2. **Configuración** (`src/core/config/location.ts`):
   ```typescript
   export const DEFAULT_LOCATION_ID = 'loc-00000000-0000-0000-0000-000000000001';
   ```

3. **Base de Datos**:
   - Todas las zonas tienen `location_id = loc-00000000-0000-0000-0000-000000000001`
   - Todas las mesas tienen `location_id = loc-00000000-0000-0000-0000-000000000001`
   - Configuración de propinas usa este ID
   - Caja chica usa este ID

Si usas un ID diferente, **nada funcionará** porque no encontrará los datos.

---

## ✅ DESPUÉS DE CORREGIR

Una vez cambies el `LOCATION_ID` en Vercel:

1. ✅ Build pasará sin errores
2. ✅ App encontrará las zonas y mesas
3. ✅ Configuración funcionará correctamente
4. ✅ Todo el sistema operará normalmente

---

## 🎯 RESUMEN

**Acción requerida:**
1. Editar `LOCATION_ID` en Vercel
2. Cambiar de `bfd72044-130d-40cc-acdf-6abb94c97f7c` a `loc-00000000-0000-0000-0000-000000000001`
3. Guardar y esperar redeploy

**Tiempo:** 2 minutos  
**Impacto:** CRÍTICO - Sin esto, la app no encontrará datos

---

**Última actualización:** 23 Enero 2026
