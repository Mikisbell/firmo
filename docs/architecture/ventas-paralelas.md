# Documentación Arquitectónica: Ventas Paralelas y UI Premium (POS)

## 1. Problema Original (Bug de Facturación)
En la versión inicial, la caja funcionaba bajo un patrón **Singleton** para la orden activa (`singleton_sale`). 
El hook `useProjections` descargaba el delta de eventos de IndexedDB (`db.events`) pero solo mantenía en memoria una única orden activa globalmente. 
Esto provocaba que:
- Solo se pudiera cobrar a un cliente a la vez.
- Si el cliente demoraba (buscando dinero, tarjeta rechazada), toda la caja se bloqueaba.
- Si se cambiaba de pantalla, se forzaba un cierre o anulación de la venta.

## 2. Nueva Arquitectura: Proyecciones Reactivas O(1)
Se refactorizó el motor de proyecciones para separar el estado global del turno (`shift`) del estado individual de cada orden.

**Nuevo Hook: `useOrderProjection(orderId)`**
- En lugar de reconstruir todas las órdenes, este hook consulta directamente al índice `aggregate_id` de Dexie.
- Complejidad: **O(1)**. Solo trae los eventos de esa orden en particular.
- Permite la técnica de **"Parked Sales"** (Ventas Estacionadas / Paralelas).

### Flujo de Ventas Paralelas:
1. El cajero abre una orden (Orden A) y agrega items.
2. El cliente demora. El cajero selecciona "Pendientes" o el mapa de mesas y abre la Orden B.
3. El componente `page.tsx` actualiza el estado local `currentOrder`.
4. `useOrderProjection` re-hidrata instantáneamente la vista con la Orden B. 
5. La Orden A queda guardada en el event store local (con sus posibles pagos parciales) sin bloquear a los demás clientes.

## 3. Interfaz Premium (Glassmorphism & Framer Motion)
Para estar a la altura de un POS de alto nivel, se actualizaron los componentes visuales en `CheckDetail.tsx`:

- **Framer Motion (`<AnimatePresence>`):** Los ítems de la orden ahora tienen transiciones de entrada y salida (`layout animations`) que eliminan el efecto brusco al agregar o anular productos.
- **Glassmorphism:** La barra inferior de totales utiliza propiedades avanzadas de CSS:
  - `backdrop-blur-xl` para desenfoque de fondo.
  - Colores base `bg-zinc-950/90` con bordes difuminados (`border-white/10`).
  - Sombras intensas (`shadow-[0_-20px...`) para darle profundidad y destacar el total a cobrar.
- **Micro-interacciones:** Los botones de "Efectivo", "Tarjeta" y "Pre-Cuenta" ahora tienen feedback táctil y visual al presionar (`active:scale-95`).

## 4. Notas para QA y Soporte
- La caja ahora soporta múltiples cobros simultáneos. Se debe instruir al personal que **ya no es necesario anular** una cuenta si el cliente no puede pagar en el momento.
- Todo pago parcial (ej: cliente dio un billete pero le falta) se queda persistido localmente y la orden queda como "PENDIENTE" con un porcentaje pagado visible en la barra de progreso verde.
