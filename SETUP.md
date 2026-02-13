# 🛠️ PARK POS - Guía de Instalación y Configuración

> Guía completa paso a paso para configurar PARK POS en tu entorno local o producción

---

## 📋 Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Instalación Local](#instalación-local)
3. [Configuración de Base de Datos](#configuración-de-base-de-datos)
4. [Variables de Entorno](#variables-de-entorno)
5. [Configuración de Supabase](#configuración-de-supabase)
6. [Primer Arranque](#primer-arranque)
7. [Configuración de Terminales](#configuración-de-terminales)
8. [Solución de Problemas](#solución-de-problemas)

---

## 1. Requisitos Previos

### Software Requerido

| Software | Versión Mínima | Versión Recomendada | Propósito |
|----------|----------------|---------------------|-----------|
| **Node.js** | 18.x | 20.x LTS | Runtime de JavaScript |
| **npm** | 9.x | 10.x | Gestor de paquetes |
| **PostgreSQL** | 14.x | 15.x | Base de datos |
| **Git** | 2.x | Latest | Control de versiones |

### Herramientas Opcionales

- **VS Code** - Editor recomendado con extensiones:
  - Prisma
  - ESLint
  - Tailwind CSS IntelliSense
  - TypeScript and JavaScript Language Features
- **Postman** - Para probar APIs
- **TablePlus** o **pgAdmin** - Para gestionar PostgreSQL

### Verificar Instalaciones

```bash
# Verificar Node.js
node --version
# Debe mostrar: v20.x.x o superior

# Verificar npm
npm --version
# Debe mostrar: 10.x.x o superior

# Verificar PostgreSQL
psql --version
# Debe mostrar: psql (PostgreSQL) 15.x o superior

# Verificar Git
git --version
# Debe mostrar: git version 2.x.x o superior
```

---

## 2. Instalación Local

### Paso 1: Clonar el Repositorio

```bash
# Clonar el proyecto
git clone https://github.com/tu-usuario/park.git

# Entrar al directorio
cd park

# Verificar que estás en la rama correcta
git branch
# Debe mostrar: * main
```

### Paso 2: Instalar Dependencias

```bash
# Instalar todas las dependencias
npm install

# Esto instalará:
# - Next.js 16
# - Prisma 6
# - React 19
# - Y todas las demás dependencias (ver package.json)
```

**Tiempo estimado:** 2-5 minutos dependiendo de tu conexión.

### Paso 3: Verificar Instalación

```bash
# Verificar que TypeScript funciona
npm run typecheck

# Debe completar sin errores
```

---

## 3. Configuración de Base de Datos

### Opción A: PostgreSQL Local

#### Instalar PostgreSQL

**En Windows:**
```bash
# Descargar desde: https://www.postgresql.org/download/windows/
# Ejecutar el instalador y seguir el asistente
```

**En macOS:**
```bash
# Usando Homebrew
brew install postgresql@15
brew services start postgresql@15
```

**En Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql-15 postgresql-contrib
sudo systemctl start postgresql
```

#### Crear Base de Datos

```bash
# Conectar a PostgreSQL
psql -U postgres

# Crear base de datos
CREATE DATABASE park_pos;

# Crear usuario (opcional)
CREATE USER park_user WITH PASSWORD 'tu_password_seguro';
GRANT ALL PRIVILEGES ON DATABASE park_pos TO park_user;

# Salir
\q
```

### Opción B: Supabase (Recomendado para Producción)

1. Ir a [https://supabase.com](https://supabase.com)
2. Crear una cuenta o iniciar sesión
3. Crear un nuevo proyecto:
   - **Name:** park-pos
   - **Database Password:** (genera uno seguro)
   - **Region:** South America (São Paulo) - más cercano a Perú
4. Esperar a que el proyecto se cree (~2 minutos)
5. Ir a **Settings** → **Database**
6. Copiar las cadenas de conexión:
   - **Connection string** (para DATABASE_URL)
   - **Direct connection** (para DIRECT_URL)

---

## 4. Variables de Entorno

### Paso 1: Crear Archivo de Configuración

```bash
# Copiar el archivo de ejemplo
cp .env.example .env.local

# Abrir con tu editor favorito
code .env.local  # VS Code
# o
nano .env.local  # Terminal
```

### Paso 2: Configurar Variables

```env
# ============================================
# BASE DE DATOS
# ============================================

# PostgreSQL Local
DATABASE_URL="postgresql://postgres:password@localhost:5432/park_pos?schema=public"
DIRECT_URL="postgresql://postgres:password@localhost:5432/park_pos?schema=public"

# O Supabase (reemplazar con tus valores)
DATABASE_URL="postgresql://postgres.xxxxx:password@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20"
DIRECT_URL="postgresql://postgres.xxxxx:password@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"

# ============================================
# AUTENTICACIÓN
# ============================================

# Secret para JWT (generar uno único)
JWT_SECRET="tu-secret-super-seguro-cambiar-en-produccion"

# Salt para PINs (NO cambiar después de crear empleados)
PIN_SALT="PARK_POS_2026_"

# ============================================
# SUPABASE (si usas Supabase)
# ============================================

NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# ============================================
# REDIS (Opcional - para multi-node)
# ============================================

# REDIS_URL="redis://localhost:6379"

# ============================================
# CONFIGURACIÓN DE APLICACIÓN
# ============================================

# URL base de la aplicación
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Modo de desarrollo
NODE_ENV="development"

# ============================================
# NOTIFICACIONES PUSH (Opcional)
# ============================================

# VAPID_PUBLIC_KEY="..."
# VAPID_PRIVATE_KEY="..."
# VAPID_SUBJECT="mailto:admin@parkpos.com"
```

### Generar JWT Secret Seguro

```bash
# Opción 1: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Opción 2: OpenSSL
openssl rand -hex 32

# Opción 3: Online (usar con precaución)
# https://generate-secret.vercel.app/32
```

---

## 5. Configuración de Supabase

### Paso 1: Habilitar Row Level Security (RLS)

```sql
-- Conectar a tu base de datos Supabase
-- SQL Editor → New Query

-- Habilitar RLS en todas las tablas principales
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS (ver prisma/migrations para políticas completas)
```

### Paso 2: Crear Usuario de Aplicación

```sql
-- Crear usuario para la aplicación
CREATE USER park_app WITH PASSWORD 'password_seguro_aqui';

-- Otorgar permisos
GRANT USAGE ON SCHEMA public TO park_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO park_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO park_app;

-- Configurar búsqueda de esquema
ALTER USER park_app SET search_path TO public;
```

### Paso 3: Configurar Realtime (Opcional)

En Supabase Dashboard:
1. Ir a **Database** → **Replication**
2. Habilitar replicación para tablas que necesitan updates en tiempo real:
   - `orders`
   - `events`
   - `delivery_orders`

---

## 6. Primer Arranque

### Paso 1: Ejecutar Migraciones

```bash
# Aplicar todas las migraciones de Prisma
npx prisma migrate dev

# Esto creará todas las tablas necesarias (63 tablas)
```

**Salida esperada:**
```
✔ Generated Prisma Client
✔ Applied 25 migrations
```

### Paso 2: Generar Cliente de Prisma

```bash
# Generar el cliente de Prisma
npx prisma generate

# Esto genera los tipos TypeScript para acceso a BD
```

### Paso 3: Sembrar Datos de Prueba

```bash
# Ejecutar seed script
npx prisma db seed

# Esto creará:
# - 1 tenant de prueba
# - 3 empleados (Admin, Cajero, Mesero)
# - 20 productos de ejemplo
# - 5 estaciones de cocina
# - 3 terminales
```

**Credenciales creadas:**
- **Admin:** PIN `1234`
- **Cajero:** PIN `5678`
- **Mesero:** PIN `9012`

### Paso 4: Iniciar Servidor de Desarrollo

```bash
# Iniciar Next.js en modo desarrollo
npm run dev

# El servidor estará disponible en:
# http://localhost:3000
```

**Salida esperada:**
```
▲ Next.js 16.1.6
- Local:        http://localhost:3000
- Network:      http://192.168.1.100:3000

✓ Ready in 2.5s
```

### Paso 5: Verificar Instalación

Abre tu navegador y visita:

1. **Página Principal:** [http://localhost:3000](http://localhost:3000)
2. **Login:** Ingresa PIN `1234` para acceder como Admin
3. **Admin Dashboard:** Deberías ver el panel de administración

---

## 7. Configuración de Terminales

### Crear Terminal desde Admin Panel

1. Ir a **Admin** → **Terminales**
2. Click en **Nuevo Terminal**
3. Completar formulario:
   - **Nombre:** Terminal 1
   - **Tipo:** CASHIER / WAITER / KDS
   - **Estación:** (si es KDS, seleccionar estación)
4. Click en **Guardar**
5. Copiar el **Código de Activación** generado

### Activar Terminal

1. En el dispositivo terminal, abrir la app
2. Ir a **Configuración** → **Activar Terminal**
3. Ingresar el código de activación
4. El terminal quedará registrado y listo para usar

### Configuración de Impresora Térmica (Opcional)

```bash
# Instalar print server local
npm install -g park-print-server

# Configurar impresora
park-print-server config

# Iniciar servicio
park-print-server start
```

Ver [docs/03-features/FLUJO_CONFIGURACION.md](./docs/03-features/FLUJO_CONFIGURACION.md) para más detalles.

---

## 8. Solución de Problemas

### Problema: Error de Conexión a Base de Datos

**Síntoma:**
```
Error: P1001: Can't reach database server
```

**Solución:**
1. Verificar que PostgreSQL está corriendo:
   ```bash
   # Windows
   sc query postgresql-x64-15
   
   # macOS/Linux
   sudo systemctl status postgresql
   ```

2. Verificar credenciales en `.env.local`
3. Verificar que el puerto 5432 no está bloqueado por firewall

### Problema: Migraciones Fallan

**Síntoma:**
```
Error: Migration failed to apply
```

**Solución:**
```bash
# Resetear base de datos (CUIDADO: borra todos los datos)
npx prisma migrate reset

# Aplicar migraciones nuevamente
npx prisma migrate dev
```

### Problema: Puerto 3000 en Uso

**Síntoma:**
```
Error: Port 3000 is already in use
```

**Solución:**
```bash
# Opción 1: Usar otro puerto
PORT=3001 npm run dev

# Opción 2: Matar proceso en puerto 3000
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

### Problema: Prisma Client No Generado

**Síntoma:**
```
Error: @prisma/client did not initialize yet
```

**Solución:**
```bash
# Generar cliente de Prisma
npx prisma generate

# Reiniciar servidor
npm run dev
```

### Problema: TypeScript Errors

**Síntoma:**
```
Type error: Cannot find module...
```

**Solución:**
```bash
# Limpiar caché de Next.js
rm -rf .next

# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install

# Verificar tipos
npm run typecheck
```

### Problema: Build Falla en Producción

**Síntoma:**
```
Error: Build failed
```

**Solución:**
```bash
# Probar build localmente ANTES de push
npm run build

# Si falla, revisar errores de TypeScript
npm run typecheck

# Verificar que todas las variables de entorno están configuradas
```

---

## 📚 Próximos Pasos

Una vez que tengas el sistema funcionando:

1. **Configurar tu Tenant:**
   - Ir a **Admin** → **Configuración**
   - Actualizar nombre de negocio, RUC, dirección
   - Subir logo

2. **Crear Empleados:**
   - Ir a **Admin** → **Empleados**
   - Crear empleados con sus roles y PINs

3. **Configurar Productos:**
   - Ir a **Admin** → **Productos**
   - Crear categorías y productos
   - Asignar estaciones de cocina

4. **Configurar Estaciones KDS:**
   - Ir a **Admin** → **Estaciones**
   - Configurar estaciones de cocina (Parrilla, Bar, etc.)

5. **Leer Documentación:**
   - [API.md](./API.md) - Endpoints disponibles
   - [ARCHITECTURE.md](./docs/02-architecture/ARCHITECTURE.md) - Arquitectura del sistema
   - [docs/03-features/](./docs/03-features/) - Flujos de funcionalidades

---

## 🆘 Soporte

Si encuentras problemas no cubiertos en esta guía:

- 📧 Email: soporte@parkpos.com
- 💬 Discord: [Únete a nuestra comunidad](https://discord.gg/parkpos)
- 🐛 Issues: [GitHub Issues](https://github.com/tu-usuario/park/issues)
- 📖 Docs: [https://docs.parkpos.com](https://docs.parkpos.com)

---

**Última actualización:** 13 Febrero 2026  
**Versión:** 2.0.0
