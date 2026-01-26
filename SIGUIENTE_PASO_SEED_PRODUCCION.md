# 🎯 Siguiente Paso: Seed de Base de Datos de Producción

## ✅ Lo que acabamos de hacer

Creamos un script de seed mínimo para producción que solo crea los datos esenciales para que puedas hacer login.

## 🚀 Ahora tú debes hacer esto:

### Paso 1: Obtener DATABASE_URL de Vercel

1. Ve a: https://vercel.com/tu-usuario/park/settings/environment-variables
2. Busca la variable `DATABASE_URL`
3. Copia el valor completo (empieza con `postgresql://`)

### Paso 2: Crear archivo .env.production

En la raíz del proyecto, crea un archivo `.env.production`:

```bash
DATABASE_URL="postgresql://usuario:password@host:5432/database?sslmode=require"
```

**⚠️ Reemplaza con tu DATABASE_URL real de Vercel**

### Paso 3: Ejecutar el seed

```bash
# Instalar dotenv-cli (solo la primera vez)
npm install -g dotenv-cli

# Ejecutar seed
npx dotenv -e .env.production -- npm run seed:prod
```

### Paso 4: Verificar

Deberías ver:

```
✅ PRODUCTION DATABASE SEEDED SUCCESSFULLY!

📋 Summary:
   • Admin Employee: Admin Principal
   • Login PIN: 1234
   • Products: 10
   • Tables: 10
   • Terminals: 3

🚀 You can now login to the admin panel with PIN: 1234
```

### Paso 5: (Opcional) Verificar con script

```bash
npx dotenv -e .env.production -- npm run verify:prod
```

Esto te mostrará un reporte detallado confirmando que todo se creó correctamente.

### Paso 6: Probar login

1. Ve a: https://tu-app.vercel.app/admin
2. Selecciona rol: **ADMIN**
3. Ingresa PIN: **1234**
4. ✅ Deberías poder acceder

### Paso 7: Limpiar (IMPORTANTE)

```bash
# Eliminar el archivo con credenciales
rm .env.production
```

## 🔧 Scripts Disponibles

```bash
# Seed de producción (crear datos)
npm run seed:prod

# Verificar seed (confirmar que todo está bien)
npm run verify:prod
```

## 🔧 Archivos Creados

- ✅ `scripts/seed-production.ts` - Script de seed mínimo
- ✅ `scripts/verify-production-seed.ts` - Script de verificación
- ✅ `VERCEL_PRODUCTION_SEED.md` - Guía completa
- ✅ `package.json` - Agregados scripts `seed:prod` y `verify:prod`

## 💡 Datos que se crearán

- **1 empleado ADMIN** (PIN: 1234)
- **10 productos** (pollos, papas, bebidas)
- **10 mesas** (2 zonas: Salón y Terraza)
- **3 terminales** (Caja, KDS, Mesero)
- **5 estaciones** (Parrilla, Cocina, Bar, Fríos, Postres)

## ❓ ¿Necesitas ayuda?

Si tienes problemas:
1. Verifica que DATABASE_URL sea correcta
2. Asegúrate de incluir `?sslmode=require` al final
3. Verifica que tengas permisos de escritura en la DB

---

**Commit:** `e3ee30f` - feat: production database seed script + comprehensive guide  
**Fecha:** 26 Enero 2026
