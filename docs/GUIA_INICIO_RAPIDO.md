# Guia de Inicio Rapido — PARK POS

Bienvenido a **PARK POS**, el sistema de punto de venta disenado para pollerias peruanas.

Esta guia te ayudara a configurar tu negocio paso a paso para que puedas empezar a vender lo antes posible. No necesitas conocimientos tecnicos — solo sigue las instrucciones.

---

## Que necesitas para empezar

Antes de comenzar, asegurate de tener lo siguiente:

- **Credenciales de acceso** — Tu administrador de PARK POS te habra proporcionado:
  - Un enlace para acceder al sistema
  - Un PIN de administrador (4 digitos)
- **Un dispositivo con navegador** — Computadora, tablet o celular con Chrome, Firefox o Safari
- **Conexion a internet** — Para la configuracion inicial (luego el sistema funciona offline)

> **Consejo:** El sistema incluye un **asistente de configuracion** en `/admin/onboarding` que te guia paso a paso y muestra tu progreso. Te recomendamos usarlo.

---

## Paso 1: Configurar informacion del negocio

**Donde:** Panel de Administracion > Configuracion (`/admin/config`)

Lo primero es ingresar los datos de tu polleria:

1. Inicia sesion con tu PIN de administrador
2. Ve a **Configuracion** en el menu lateral
3. Completa los datos de tu negocio:
   - **Nombre legal** — El nombre registrado de tu negocio (ejemplo: "Polleria El Buen Sabor S.A.C.")
   - **RUC** — Tu numero de RUC para facturacion SUNAT
   - **Direccion** — La direccion fisica de tu local
   - **Texto de pie de recibo** — Lo que aparecera al final de cada boleta (ejemplo: "Gracias por su preferencia")
4. Guarda los cambios

> Estos datos apareceran en tus boletas y facturas.

---

## Paso 2: Crear empleados

**Donde:** Panel de Administracion > Empleados (`/admin/employees`)

Agrega a las personas que trabajaran en tu negocio:

1. Haz clic en **Nuevo Empleado**
2. Para cada empleado, ingresa:
   - **Nombre** — Nombre completo del empleado
   - **Rol** — Selecciona segun su funcion:
     - **Cajero** — Cobra y cierra ventas
     - **Mesero** — Toma pedidos de las mesas
     - **Cocina** — Recibe pedidos en la cocina (pantalla KDS)
     - **Cocinero** — Similar a Cocina, para la preparacion
     - **Empacador** — Prepara pedidos para delivery
     - **Bar** — Atiende el area de bebidas
     - **Repartidor** — Realiza entregas a domicilio
     - **Supervisor** — Puede aprobar descuentos y anulaciones
     - **Gerente** — Acceso completo al panel de administracion
   - **PIN** — Un codigo de 4 digitos que el empleado usara para ingresar al sistema
3. Haz clic en **Guardar**

> **Importante:** Cada empleado necesita su propio PIN. No compartan PINs entre empleados para mantener el registro de quien hizo cada operacion.

---

## Paso 3: Crear productos y categorias

**Donde:** Panel de Administracion > Productos (`/admin/products`)

Agrega todo lo que vendes en tu polleria:

1. Primero crea las **categorias** (ejemplo: Pollos, Bebidas, Extras, Postres)
2. Luego agrega los **productos** dentro de cada categoria:
   - **Nombre** — Como aparecera en el POS (ejemplo: "1/4 Pollo a la brasa")
   - **Precio** — El precio de venta al publico
   - **Categoria** — A que categoria pertenece
   - **Estacion de cocina** — A donde se envia el pedido (Parrilla, Cocina, Bar, etc.)
3. Repite para todos tus productos

> **Consejo:** Empieza con tus productos mas vendidos. Siempre puedes agregar mas despues.

---

## Paso 4: Configurar estaciones de cocina

**Donde:** Panel de Administracion > Estaciones (`/admin/stations`)

Las estaciones determinan a que pantalla de cocina (KDS) llega cada pedido. Tu sistema ya viene con 4 estaciones predeterminadas:

| Estacion | Para que sirve |
|----------|---------------|
| **Parrilla** | Pollos a la brasa, anticuchos |
| **Cocina** | Platos calientes, guarniciones |
| **Bar** | Bebidas, jugos, postres frios |
| **Empaque** | Pedidos para llevar y delivery |

Puedes:
- Renombrar las estaciones segun tu operacion
- Activar o desactivar las que no uses
- Ajustar el tiempo estimado de preparacion

> Si tu polleria es pequena y todo se prepara en un solo lugar, puedes usar solo la estacion "Cocina".

---

## Paso 5: Activar terminal

**Donde:** Panel de Administracion > Terminales (`/admin/terminals`) o Activacion Rapida (`/simple-activate`)

Un "terminal" es cada dispositivo que usaras para vender (tablet del mesero, computadora de caja, etc.):

1. En el panel de administracion, ve a **Terminales**
2. Haz clic en **Nuevo Terminal**
3. Asigna un nombre descriptivo (ejemplo: "Caja Principal", "Tablet Mesero 1")
4. Se generara un **codigo de activacion** de 6 digitos
5. En el dispositivo donde quieres usar el POS, abre el navegador e ingresa el codigo de activacion

> **Nota:** Los codigos de activacion son validos por 15 minutos. Si expira, puedes regenerar uno nuevo desde el panel.

---

## Paso 6: Tu primera venta en el POS

**Donde:** Punto de Venta (`/pos`)

Ya esta todo listo. Asi se hace una venta:

1. El mesero o cajero inicia sesion con su PIN
2. Si hay un turno abierto, el sistema los lleva directo al POS. Si no, deben abrir turno primero
3. Para crear un pedido:
   - Selecciona los productos tocando en la pantalla
   - Ajusta cantidades si es necesario
   - Agrega notas especiales (ejemplo: "sin ensalada", "extra papas")
4. Envia el pedido — Llegara automaticamente a la pantalla de cocina (KDS)
5. Cuando el cliente quiera pagar:
   - Selecciona el metodo de pago (efectivo, tarjeta, Yape, Plin)
   - Ingresa el monto recibido
   - Confirma el pago
6. Se genera la boleta automaticamente

> **Felicidades!** Ya completaste tu primera venta. El sistema registra todo automaticamente para tus reportes.

---

## El asistente de configuracion

El sistema incluye un **asistente de configuracion** disponible en:

**Panel de Administracion > Configuracion Inicial** (`/admin/onboarding`)

Este asistente:
- Te muestra los 6 pasos de configuracion en orden
- Marca automaticamente los pasos que ya completaste
- Te indica que falta para estar listo
- Te lleva directo a la seccion que necesitas configurar

Puedes volver al asistente en cualquier momento para verificar tu progreso.

---

## Soporte

Si tienes problemas o preguntas:

1. **Revisa esta guia** — La mayoria de preguntas se resuelven siguiendo los pasos
2. **Usa el asistente** — El asistente en `/admin/onboarding` te indica que falta configurar
3. **Contacta a tu proveedor** — La persona que te instalo PARK POS puede ayudarte con problemas tecnicos
4. **Documentacion tecnica** — Si tienes un equipo tecnico, la documentacion completa esta en la carpeta `docs/` del proyecto

---

## Resumen rapido

| Paso | Que hacer | Donde |
|------|-----------|-------|
| 1 | Datos del negocio (nombre, RUC, direccion) | `/admin/config` |
| 2 | Agregar empleados con sus roles y PINs | `/admin/employees` |
| 3 | Crear productos con precios y categorias | `/admin/products` |
| 4 | Verificar estaciones de cocina | `/admin/stations` |
| 5 | Activar dispositivos con codigo | `/admin/terminals` |
| 6 | Hacer tu primera venta | `/pos` |

> **Tiempo estimado de configuracion:** 30-60 minutos, dependiendo de la cantidad de productos.
