# 🔧 Actualizar Variables de Entorno en Vercel

## Problema
Las APIs `/api/admin/zones` y `/api/admin/tables` están retornando error 500 en producción porque la variable `LOCATION_ID` en Vercel no coincide con los datos en la base de datos.

## Solución

### Paso 1: Acceder a Vercel Dashboard
1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto "park"
3. Ve a **Settings** (en el menú superior)

### Paso 2: Actualizar Variables de Entorno
1. En el menú lateral, selecciona **Environment Variables**
2. Busca la variable `LOCATION_ID`
3. Si existe, haz clic en los tres puntos (...) → **Edit**
4. Si no existe, haz clic en **Add New**

### Paso 3: Configurar el Valor Correcto
**Variable**: `LOCATION_ID`  
**Valor**: `9bc7e15f-ca13-43aa-a647-b1e4d46529fd`  
**Environments**: Selecciona todos (Production, Preview, Development)

### Paso 4: Verificar Otras Variables
Asegúrate de que estas variables también estén configuradas:

```
TENANT_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890
LOCATION_ID=9bc7e15f-ca13-43aa-a647-b1e4d46529fd
DATABASE_URL=postgresql://postgres.ncwdmdjnelopikpgrhty:M1k1sB3ll.$@aws-1-sa-east-1.pooler.supabase.com:5432/postgres
DIRECT_URL=postgresql://postgres.ncwdmdjnelopikpgrhty:M1k1sB3ll.$@aws-1-sa-east-1.pooler.supabase.com:5432/postgres
PARK_API_SECRET=park_secret_mvp_2025
VAPID_PUBLIC_KEY=BDAi940UvfivYG28Gjb6h1ltUKyDiwV3f-qo2lWy2tZ1eIMO81hS8thLIrk8L0uzuoaqpFd7Wv8bUZkBTd4p8hE
VAPID_PRIVATE_KEY=CmaFbBC_oku8d4qUJyFVqvhtv5eqUovVbJZt6UVO20E
VAPID_SUBJECT=mailto:admin@parkpos.pe
```

### Paso 5: Redeploy
1. Ve a **Deployments** (en el menú superior)
2. Encuentra el último deployment exitoso
3. Haz clic en los tres puntos (...) → **Redeploy**
4. Confirma el redeploy

**O simplemente haz un nuevo push a Git** (las variables se aplicarán automáticamente en el próximo deploy)

## Verificación
Después del redeploy, verifica que las APIs funcionen:
- https://tu-dominio.vercel.app/api/admin/zones
- https://tu-dominio.vercel.app/api/admin/tables?active=true

Ambas deberían retornar status 200 con datos JSON.

## ¿Por qué pasó esto?
El archivo `.env` no se sube a Git (está en `.gitignore` por seguridad). Cuando actualizamos el `LOCATION_ID` localmente, Vercel no recibió ese cambio automáticamente. Las variables de entorno en Vercel deben configurarse manualmente en el dashboard.

---

**Fecha**: 19 Enero 2026  
**Commit relacionado**: a536ec3
