# 🌱 Guía: Seed de Base de Datos de Producción en Vercel

## 📋 Problema

La base de datos de producción en Vercel está vacía, por lo que no puedes hacer login con PIN 1234.

## ✅ Solución

Hemos creado un script de seed mínimo para producción que solo crea los datos esenciales:

- ✅ 1 tenant settings
- ✅ 1 empleado ADMIN (PIN: 1234)
- ✅ 1 location
- ✅ 5 estaciones (PARRILLA, COCINA, BAR, FRIOS, POSTRES)
- ✅ 10 productos esenciales
- ✅ 2 zonas con 10 mesas
- ✅ 3 terminales (CAJA_01, SPC_HORNO, MOZO_01)

## 🚀 Pasos para Ejecutar

### Opción 1: Desde tu máquina local (RECOMENDADO)

#### 1. Obtener DATABASE_URL de Vercel

Ve a tu proyecto en Vercel:
1. Dashboard → Tu Proyecto → Settings → Environment Variables
2. Busca `DATABASE_URL`
3. Copia el valor completo (debe empezar con `postgresql://`)

#### 2. Crear archivo .env.production

Crea un archivo `.env.production` en la raíz del proyecto:

```bash
DATABASE_URL="postgresql://usuario:password@host:5432/database?sslmode=require"
```

**⚠️ IMPORTANTE:** Reemplaza con tu DATABASE_URL real de Vercel.

#### 3. Ejecutar el seed

```bash
# Instalar dotenv-cli si no lo tienes
npm install -g dotenv-cli

# Ejecutar seed apuntando a producción
npx dotenv -e .env.production -- npm run seed:prod
```

#### 4. Verificar

Deberías ver una salida como esta:

```
🌱 Seeding PRODUCTION database with minimal data...
📍 Database: your-db-host.supabase.co

1️⃣  Creating tenant settings...
   ✅ Tenant settings created

2️⃣  Creating ADMIN employee...
   ✅ Admin employee created (ID: 00000000-0000-0000-0000-000000000001)
   🔑 Login PIN: 1234

3️⃣  Creating location...
   ✅ Location created (ID: loc-00000000-0000-0000-0000-000000000001)

4️⃣  Creating stations...
   ✅ 5 stations created

5️⃣  Creating products...
   ✅ 10 products created

6️⃣  Creating zones and tables...
   ✅ 2 zones, 10 tables created

7️⃣  Creating terminals...
   ✅ 3 terminals created

8️⃣  Creating terminal devices...
   ✅ 3 terminal devices created

============================================================
✅ PRODUCTION DATABASE SEEDED SUCCESSFULLY!
============================================================

📋 Summary:
   • Tenant: a1b2c3d4-e5f6-7890-abcd-ef1234567890
   • Location: loc-00000000-0000-0000-0000-000000000001
   • Admin Employee: Admin Principal
   • Login PIN: 1234
   • Products: 10
   • Tables: 10
   • Terminals: 3

🚀 You can now login to the admin panel with PIN: 1234
```

### Opción 2: Crear API endpoint (Alternativa más segura)

Si prefieres no exponer tu DATABASE_URL localmente, puedes crear un endpoint API:

#### 1. Crear endpoint `/api/admin/seed-initial`

```typescript
// src/app/api/admin/seed-initial/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";
import { DEFAULT_TENANT_ID, DEFAULT_LOCATION_ID } from "@/src/core/config/location";
import { DEFAULT_EMPLOYEE_IDS } from "@/src/core/config/employees";

const prisma = new PrismaClient();
const SALT = 'PARK_POS_2026_';

function hashPin(pin: string): string {
    return createHash("sha256").update(SALT + pin).digest("hex");
}

export async function POST(request: Request) {
    try {
        // Verificar que no exista ya un admin
        const existingAdmin = await prisma.employees.findFirst({
            where: { tenant_id: DEFAULT_TENANT_ID, role: "ADMIN" }
        });

        if (existingAdmin) {
            return NextResponse.json(
                { error: "Admin already exists" },
                { status: 400 }
            );
        }

        // Crear admin employee
        await prisma.employees.create({
            data: {
                id: DEFAULT_EMPLOYEE_IDS.ADMIN,
                tenant_id: DEFAULT_TENANT_ID,
                name: "Admin Principal",
                role: "ADMIN",
                pin_hash: hashPin("1234"),
                is_active: true,
            },
        });

        return NextResponse.json({
            success: true,
            message: "Admin created successfully. PIN: 1234"
        });
    } catch (error) {
        console.error("Error creating admin:", error);
        return NextResponse.json(
            { error: "Failed to create admin" },
            { status: 500 }
        );
    }
}
```

#### 2. Llamar al endpoint desde Vercel

```bash
curl -X POST https://tu-app.vercel.app/api/admin/seed-initial
```

## 🔒 Seguridad

### ⚠️ IMPORTANTE: Proteger .env.production

El archivo `.env.production` contiene credenciales sensibles. **NUNCA** lo subas a Git:

```bash
# Verificar que está en .gitignore
echo ".env.production" >> .gitignore
```

### 🗑️ Eliminar después de usar

Una vez que hayas ejecutado el seed, **elimina** el archivo `.env.production`:

```bash
rm .env.production
```

## 🧪 Verificar que funcionó

1. Ve a tu app en Vercel: `https://tu-app.vercel.app/admin`
2. Selecciona rol: **ADMIN**
3. Ingresa PIN: **1234**
4. Deberías poder acceder al panel de administración

## 📝 Datos Creados

### Empleado Admin
- **Nombre:** Admin Principal
- **Rol:** ADMIN
- **PIN:** 1234
- **ID:** `00000000-0000-0000-0000-000000000001`

### Productos (10)
- Pollo Entero (S/55.00)
- 1/2 Pollo (S/28.00)
- 1/4 Pollo (S/15.00)
- Papas Fritas Grande (S/12.00)
- Papas Fritas Mediana (S/8.00)
- Ensalada (S/6.00)
- Inca Kola 1.5L (S/9.00)
- Coca Cola 1.5L (S/9.00)
- Agua 500ml (S/2.50)
- Chicha Morada Jarra (S/12.00)

### Mesas (10)
- Zona Salón Principal: Mesas 1-6
- Zona Terraza: Mesas 7-10

### Terminales (3)
- CAJA_01 (Cashier)
- SPC_HORNO (KDS)
- MOZO_01 (Waiter)

## 🆘 Troubleshooting

### Error: "Connection refused"

Verifica que tu DATABASE_URL sea correcta y que incluya `?sslmode=require` al final.

### Error: "Admin already exists"

Si ya ejecutaste el seed antes, el script actualizará el PIN del admin existente en lugar de crear uno nuevo.

### Error: "Permission denied"

Asegúrate de que tu usuario de base de datos tenga permisos de escritura.

## 📚 Archivos Relacionados

- **Script de seed:** `scripts/seed-production.ts`
- **Configuración de empleados:** `src/core/config/employees.ts`
- **Configuración de location:** `src/core/config/location.ts`
- **Package.json:** Script `seed:prod` agregado

## 🔄 Agregar más datos después

Si necesitas agregar más datos (más productos, empleados, etc.), puedes:

1. Usar el panel de administración (una vez que puedas acceder)
2. Modificar `scripts/seed-production.ts` y ejecutarlo de nuevo
3. Usar el seed completo de desarrollo: `npm run seed` (pero esto creará MUCHOS datos de prueba)

---

**Última actualización:** 26 Enero 2026  
**Autor:** Kiro AI Assistant
