# FIRMO POS — Checklist de Produccion

## Antes del Primer Uso

### Credenciales

- [ ] DATABASE_URL configurado en Vercel Environment Variables
- [ ] JWT_SECRET (min 32 chars, generado con `openssl rand -base64 32`)
- [ ] PARK_API_SECRET (min 16 chars)
- [ ] CRON_SECRET (para proteger cron jobs)
- [ ] REDIS_URL (Upstash o similar)
- [ ] NEXT_PUBLIC_APP_URL (URL publica de la app)

### SUNAT (Facturacion Electronica)

- [ ] Certificado digital (.pfx) de SUNAT
- [ ] SUNAT_SOL_USER y SUNAT_SOL_PASSWORD (credenciales SOL)
- [ ] SUNAT_CERT_PATH o SUNAT_CERT_BASE64 (certificado digital)
- [ ] SUNAT_CERT_PASSWORD (password del certificado .pfx)
- [ ] SUNAT_MODE: `BETA` para pruebas, `PRODUCCION` para real
- [ ] Configurar en /admin/facturacion > Configuracion
- [ ] Probar emision contra SUNAT BETA antes de ir a produccion

### Pagos Digitales

- [ ] Yape Business: numero + QR configurado
- [ ] Plin Business: numero + QR configurado
- [ ] Configurar en /admin/configuracion/yape-plin

### Impresoras

- [ ] Epson conectada a red LAN (puerto 9100)
- [ ] Registrar en /admin/impresoras (IP + estacion)
- [ ] Test print desde admin

### Datos Iniciales

- [ ] Completar onboarding (/admin/onboarding)
- [ ] Cargar productos (/admin/productos)
- [ ] Crear recetas (/admin/recetas)
- [ ] Configurar estaciones KDS (/admin/estaciones)
- [ ] Configurar mesas y zonas (/admin/mesas)
- [ ] Crear empleados (/admin/equipo/nuevo)
- [ ] Asignar roles y PINs
- [ ] Imprimir QR de mesas (/admin/mesas/qr)

### WhatsApp (Opcional)

- [ ] Twilio cuenta + numero WhatsApp Business
- [ ] TWILIO_ACCOUNT_SID en env
- [ ] TWILIO_AUTH_TOKEN en env
- [ ] TWILIO_WHATSAPP_FROM (numero Twilio con formato whatsapp:+1...)
- [ ] Templates aprobados por WhatsApp

### Monitoring

- [ ] SENTRY_DSN configurado (opcional pero recomendado)
- [ ] NEXT_PUBLIC_SENTRY_DSN (para client-side)
- [ ] Vercel Analytics habilitado
- [ ] VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY (push notifications, generar con `npx web-push generate-vapid-keys`)

## Operacion Diaria

1. Abrir turno en POS (/pos/shift)
2. Verificar impresoras (test print)
3. Al cerrar: Z-Report (/pos/shift/z-report)
4. Revisar dashboard (/admin/dashboard)

## Verificacion Post-Deploy

- [ ] Health check: GET /api/health — debe retornar 200
- [ ] Cron SUNAT: GET /api/cron/sunat-queue ejecuta cada 2 min
- [ ] Cron resumen diario: GET /api/cron/sunat-daily-summary ejecuta 6:00 AM Lima
- [ ] Login de admin funciona
- [ ] POS abre turno correctamente
- [ ] Impresion de ticket funciona

## Soporte

- Health check: /api/health
- Logs: Vercel > Logs
- Backup: automatico diario (Supabase + GitHub Artifacts)
- Dashboard de metricas: /admin/dashboard
