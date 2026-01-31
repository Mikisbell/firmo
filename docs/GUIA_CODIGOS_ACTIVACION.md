# 📱 Guía: Generación de Códigos de Activación

## 🎯 Panel de Administración

### URL: `/admin/terminales`

---

## 🔐 Paso 1: Acceso al Panel

1. **Inicia sesión como Admin o Manager:**
   - Admin: PIN `1234`
   - Manager: PIN `0000`

2. **Navega a:** `http://localhost:3000/admin/terminales`

---

## ✅ Opción 1: Crear Nuevo Terminal (Genera código automáticamente)

### Pasos:

1. **Haz clic en el botón "Nuevo Terminal"** (esquina superior derecha)

2. **Completa el formulario:**
   ```
   ┌─────────────────────────────────────┐
   │  Crear Nuevo Terminal               │
   ├─────────────────────────────────────┤
   │  ID del Terminal: MOZO_06           │
   │  Rol: Mesero                        │
   │  Nombre: Tablet Mesero Juan         │
   │  Ubicación: MAIN                    │
   │                                     │
   │  [Cancelar]  [Crear Terminal]      │
   └─────────────────────────────────────┘
   ```

3. **Haz clic en "Crear Terminal"**

4. **¡Código generado automáticamente!**
   ```
   ┌─────────────────────────────────────┐
   │  ✅ Terminal creado exitosamente!   │
   │                                     │
   │  Código de activación: 456-789     │
   │  Expira: 19/1/2026 4:15 PM        │
   └─────────────────────────────────────┘
   ```

5. **Comparte el código con el usuario**

---

## 🔄 Opción 2: Regenerar Código para Terminal Existente

### Pasos:

1. **Busca el terminal en la lista**
   - Usa el filtro "Pendientes" para ver solo terminales sin activar

2. **Haz clic en "Ver Detalles"** del terminal

3. **Se abre el panel lateral:**
   ```
   ┌─────────────────────────────────────────────┐
   │  Terminal: MOZO_03                    [✕]  │
   ├─────────────────────────────────────────────┤
   │  📱 Información General                     │
   │     Estado: Pendiente                       │
   │     Rol: Mesero                            │
   │                                             │
   │  🔑 Código de Activación Actual            │
   │     ┌─────────────────────────────┐        │
   │     │ Código: 793-196       [📋] │        │
   │     │ Expira: 19/1/2026 3:33 PM  │        │
   │     │ Intentos: 0/5               │        │
   │     └─────────────────────────────┘        │
   │                                             │
   │  📜 Historial de Códigos                   │
   │     • 628-893 - Expirado                   │
   │     • 793-196 - Activo                     │
   │                                             │
   │  [🔄 Regenerar Código]  [Cerrar]          │
   └─────────────────────────────────────────────┘
   ```

4. **Haz clic en "Regenerar Código"** (botón amarillo con ícono 🔄)

5. **Confirma la acción:**
   ```
   ¿Generar un nuevo código de activación?
   El código anterior será invalidado.
   
   [Cancelar]  [Aceptar]
   ```

6. **Nuevo código generado:**
   ```
   ┌─────────────────────────────────────┐
   │  Nuevo código generado:             │
   │                                     │
   │  456-789                           │
   │                                     │
   │  Expira: 19/1/2026 4:30 PM        │
   └─────────────────────────────────────┘
   ```

7. **Copia el código** (botón 📋) y compártelo

---

## 📋 Opción 3: Copiar Código Existente

Si el terminal ya tiene un código válido:

1. **En la lista de terminales**, los terminales pendientes muestran su código:
   ```
   ┌─────────────────────────────────────┐
   │  📱 MOZO_03 - Mesero 3  [Pendiente] │
   │     Rol: Mesero | Offline           │
   │     ┌────────────────────────┐      │
   │     │ Código de Activación   │      │
   │     │ 793-196          [📋]  │      │
   │     │ Expira: 3:33 PM        │      │
   │     └────────────────────────┘      │
   │     [Ver Detalles]                  │
   └─────────────────────────────────────┘
   ```

2. **Haz clic en el botón de copiar** 📋

3. **El código se copia al portapapeles** en formato `XXX-XXX`

---

## 🎯 Casos de Uso

### Caso 1: Nuevo Empleado
```
Admin → Crear Terminal → Código generado → Compartir con empleado
```

### Caso 2: Código Expirado
```
Admin → Ver Detalles → Regenerar Código → Compartir nuevo código
```

### Caso 3: Código Perdido
```
Admin → Ver Detalles → Ver código actual → Copiar y compartir
```

### Caso 4: Dispositivo Robado
```
Admin → Ver Detalles → Deshabilitar Terminal → Crear nuevo terminal
```

---

## ⚠️ Importante

- ✅ **Códigos válidos por 15 minutos**
- ✅ **Máximo 5 intentos por código**
- ✅ **Un código usado no puede reutilizarse**
- ✅ **Regenerar invalida el código anterior**
- ✅ **Solo Admin y Manager pueden generar códigos**

---

## 🔧 Solución de Problemas

### "No veo el botón Regenerar Código"
- ✅ Verifica que el terminal esté en estado "Pendiente"
- ✅ Los terminales "Activos" no muestran este botón
- ✅ Los terminales "Deshabilitados" tampoco

### "El código no funciona"
- ✅ Verifica que no haya expirado (15 minutos)
- ✅ Verifica que no se hayan usado los 5 intentos
- ✅ Regenera un nuevo código

### "Error al generar código"
- ✅ Verifica que el servidor esté corriendo
- ✅ Verifica que la base de datos esté conectada
- ✅ Revisa los logs del servidor

---

## 🚀 Acceso Rápido

### Desde la terminal:
```bash
# Ver códigos activos
npx tsx scripts/get-activation-codes.ts

# Generar código para un terminal específico
npx tsx scripts/generate-activation-code.ts MOZO_03
```

### Desde el navegador:
```
http://localhost:3000/admin/terminales
```

---

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs del servidor
2. Verifica la conexión a la base de datos
3. Consulta la documentación en `docs/03-features/FLUJO_AUTENTICACION.md`
