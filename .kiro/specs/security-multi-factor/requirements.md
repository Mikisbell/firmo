# Security: Multi-Factor Authentication & Session Management

## Problema

Mi solución de Device ID tiene vulnerabilidades críticas:

1. **Acceso simultáneo**: Dos usuarios con mismo PIN en dispositivos diferentes
2. **Hacker remoto**: Hacker con PIN robado accede desde IP diferente
3. **Sin detección**: No hay forma de detectar acceso sospechoso
4. **Sin auditoría**: No se registra quién accedió, cuándo, desde dónde
5. **Sin límites**: Hacker puede hacer transacciones ilimitadas

## Problema Adicional: IP Validation es Demasiado Agresiva

**Contexto:** Pollería con tráfico intenso. Empleados necesitan acceso INMEDIATO.

**Problema Real:** Validación de IP en cada login causa fricción innecesaria:
- IP cambia cada 24h (DHCP lease)
- IP cambia si router se reinicia
- IP cambia si empleado se conecta a WiFi diferente
- Resultado: Empleados bloqueados cada día → Negocio pierde dinero

**Solución:** Usar MAC address como identificador principal (estable, hardware-bound)

## Requisitos

### 1. Sesiones Activas (Requirement 1.1-1.5)

**1.1 Tabla de Sesiones**
- Registrar cada login con: device_id, MAC address, IP, timestamp
- Marcar sesiones como activas/inactivas
- Auditoría completa de acceso

**1.2 Detección de Acceso Simultáneo**
- Si empleado ya tiene sesión activa en otro dispositivo
- Rechazar nuevo login O cerrar sesión anterior
- Alertar al admin

**1.3 Validación de MAC Address (REEMPLAZA IP Validation)**
- Registrar MAC address de cada sesión
- Si MAC es desconocido → requiere confirmación
- Si MAC pertenece a otro empleado → alerta
- MAC es estable (no cambia cada día)

**1.4 Validación de Ubicación (OPCIONAL)**
- Calcular distancia entre ubicaciones
- Si viaje es imposible (>900 km/h) → rechazar
- Registrar ubicación en cada sesión
- **NOTA:** Usar solo como validación secundaria, no primaria

**1.5 Auditoría de Sesiones**
- Registrar: quién, cuándo, desde dónde (MAC), qué hizo
- Historial completo de accesos
- Exportable para auditoría

### 2. Rate Limiting (Requirement 2.1-2.3)

**2.1 Límites por Usuario**
- Máximo X transacciones por hora
- Máximo Y transacciones por día
- Máximo Z monto por transacción

**2.2 Límites por Terminal**
- Máximo transacciones simultáneas
- Máximo cambios de precio por hora
- Máximo devoluciones por día

**2.3 Alertas de Límites**
- Notificar cuando se alcanza 80% del límite
- Bloquear cuando se alcanza 100%
- Alertar al admin

### 3. Alertas de Seguridad (Requirement 3.1-3.3)

**3.1 Alertas en Tiempo Real**
- Acceso simultáneo
- IP sospechosa
- Viaje imposible
- Límites excedidos
- Cambios de precio masivos

**3.2 Notificaciones al Admin**
- Email inmediato
- Dashboard en tiempo real
- Historial de alertas

**3.3 Acciones Automáticas**
- Bloquear sesión sospechosa
- Requerir confirmación del admin
- Registrar evento para auditoría

### 4. Dashboard de Seguridad (Requirement 4.1-4.3)

**4.1 Sesiones Activas**
- Listar todas las sesiones activas
- Mostrar: usuario, dispositivo, IP, ubicación, hora
- Opción para cerrar sesión remotamente

**4.2 Alertas**
- Historial de alertas
- Filtrar por tipo, usuario, fecha
- Marcar como resueltas

**4.3 Reportes**
- Accesos por usuario
- Accesos por IP
- Accesos por ubicación
- Transacciones sospechosas

## Aceptación

- ✅ Detecta acceso simultáneo
- ✅ Rechaza IP sospechosa
- ✅ Rechaza viaje imposible
- ✅ Rate limiting funciona
- ✅ Alertas en tiempo real
- ✅ Dashboard completo
- ✅ Auditoría completa
