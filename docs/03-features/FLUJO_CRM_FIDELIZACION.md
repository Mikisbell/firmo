# 🎯 FLUJO CRM Y FIDELIZACIÓN — Diseño con IA

> **Documento:** Sistema de CRM autónomo con IA  
> **Fecha:** Enero 2026  
> **Estado:** Diseño completo — Listo para implementación

---

## 📋 ÍNDICE

1. [Contexto del Negocio](#contexto-del-negocio)
2. [Arquitectura de IA Multi-Provider](#arquitectura-de-ia-multi-provider)
3. [Funcionalidades del CRM](#funcionalidades-del-crm)
4. [Escenarios Reales](#escenarios-reales)
5. [Modelo de Datos](#modelo-de-datos)
6. [Implementación](#implementación)

---

## CONTEXTO DEL NEGOCIO

### Perfil del Cliente

```
CADENA DE POLLERÍAS:
- 4-5 locales (marca)
- Dueño tiene 2 locales (franquiciado)
- Dueño es INVERSIONISTA, no operador
- Necesita sistema que funcione SOLO

REQUISITOS:
- CRM 100% autónomo con IA
- Mínima intervención humana
- Reportes ejecutivos automáticos
- ROI medible
```

### Por qué CRM con IA en 2026

```
ANTES (2020-2023):
- IA costaba $$$
- Requería equipo de data science
- Solo para empresas grandes

AHORA (2026):
- IA es GRATIS (múltiples APIs)
- Modelos open source de calidad GPT-4
- Cualquier negocio puede usarlo
- El que NO usa IA, pierde
```

---

## ARQUITECTURA DE IA MULTI-PROVIDER

### Estrategia: Múltiples APIs con Fallback

```
┌─────────────────────────────────────────────────────────────────┐
│              ESTRATEGIA MULTI-PROVIDER                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PRIORIDAD 1: Google Gemini (gratis, confiable)                │
│       │                                                         │
│       ▼ Si llega al límite...                                  │
│  PRIORIDAD 2: DeepSeek (10M tokens/mes gratis)                 │
│       │                                                         │
│       ▼ Si llega al límite...                                  │
│  PRIORIDAD 3: SiliconFlow Qwen (gratis ilimitado 7B)           │
│       │                                                         │
│       ▼ Si llega al límite...                                  │
│  PRIORIDAD 4: Groq (14,400 req/día gratis)                     │
│       │                                                         │
│       ▼ Si TODO falla...                                       │
│  FALLBACK: Templates estáticos (sin IA)                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### APIs Disponibles (Enero 2026)

| Provider | Modelo | Límite Gratis | Costo si excede | Calidad |
|----------|--------|---------------|-----------------|---------|
| **Google Gemini** | Gemini 2.0 Flash | 1,500 req/día | $0.075/1M tokens | ⭐⭐⭐⭐⭐ |
| **DeepSeek** | DeepSeek-V3, R1 | 10M tokens/mes | $0.14/1M tokens | ⭐⭐⭐⭐⭐ |
| **SiliconFlow** | Qwen2.5-7B | ILIMITADO | - | ⭐⭐⭐⭐ |
| **Groq** | Llama, Mixtral | 14,400 req/día | - | ⭐⭐⭐⭐ |
| **Baidu ERNIE** | ERNIE 4.5 | GRATIS (open source) | - | ⭐⭐⭐⭐ |
| **Mistral** | Mistral 7B | 1B tokens/mes | - | ⭐⭐⭐⭐ |

### Implementación del Router de IA

```typescript
// src/core/ai/ai-router.ts

interface AIProvider {
  name: string;
  endpoint: string;
  apiKey: string;
  model: string;
  dailyLimit: number;
  monthlyLimit: number;
  currentUsage: { daily: number; monthly: number };
  priority: number;
  isAvailable: () => boolean;
}

const AI_PROVIDERS: AIProvider[] = [
  {
    name: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.0-flash",
    dailyLimit: 1500,
    monthlyLimit: 45000,  // ~1500 × 30
    priority: 1,
    isAvailable: function() {
      return this.currentUsage.daily < this.dailyLimit * 0.9;
    }
  },
  {
    name: "deepseek",
    endpoint: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    dailyLimit: Infinity,
    monthlyLimit: 10_000_000,  // 10M tokens
    priority: 2,
    isAvailable: function() {
      return this.currentUsage.monthly < this.monthlyLimit * 0.9;
    }
  },
  {
    name: "siliconflow",
    endpoint: "https://api.siliconflow.cn/v1",
    model: "Qwen/Qwen2.5-7B-Instruct",
    dailyLimit: Infinity,
    monthlyLimit: Infinity,  // Gratis ilimitado
    priority: 3,
    isAvailable: () => true
  },
  {
    name: "groq",
    endpoint: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    dailyLimit: 14400,
    monthlyLimit: Infinity,
    priority: 4,
    isAvailable: function() {
      return this.currentUsage.daily < this.dailyLimit * 0.9;
    }
  }
];

class AIRouter {
  private providers: AIProvider[];
  private usageTracker: Map<string, { daily: number; monthly: number }>;
  
  constructor() {
    this.providers = AI_PROVIDERS.sort((a, b) => a.priority - b.priority);
    this.usageTracker = new Map();
    this.loadUsageFromDB();
  }

  async chat(prompt: string, context?: string): Promise<AIResponse> {
    for (const provider of this.providers) {
      if (!provider.isAvailable()) {
        console.log(`[AI] ${provider.name} al límite, probando siguiente...`);
        continue;
      }

      try {
        const response = await this.callProvider(provider, prompt, context);
        this.trackUsage(provider.name, response.tokensUsed);
        
        // Alertar si estamos cerca del límite
        this.checkAndAlertLimits(provider);
        
        return response;
      } catch (error) {
        console.error(`[AI] Error con ${provider.name}:`, error);
        continue;
      }
    }

    // Fallback: respuesta sin IA
    return this.fallbackResponse(prompt);
  }

  private checkAndAlertLimits(provider: AIProvider) {
    const usage = this.usageTracker.get(provider.name);
    if (!usage) return;

    const dailyPercent = (usage.daily / provider.dailyLimit) * 100;
    const monthlyPercent = (usage.monthly / provider.monthlyLimit) * 100;

    if (dailyPercent >= 80) {
      this.sendAlert({
        type: "AI_LIMIT_WARNING",
        provider: provider.name,
        message: `⚠️ ${provider.name}: ${dailyPercent.toFixed(0)}% del límite diario usado`,
        level: dailyPercent >= 95 ? "critical" : "warning"
      });
    }

    if (monthlyPercent >= 80) {
      this.sendAlert({
        type: "AI_LIMIT_WARNING", 
        provider: provider.name,
        message: `⚠️ ${provider.name}: ${monthlyPercent.toFixed(0)}% del límite mensual usado`,
        level: monthlyPercent >= 95 ? "critical" : "warning"
      });
    }
  }

  private async sendAlert(alert: AIAlert) {
    // Guardar en eventos
    await this.emitEvent("AI_LIMIT_ALERT", alert);
    
    // Notificar al admin por WhatsApp si es crítico
    if (alert.level === "critical") {
      await this.notifyAdmin(alert.message);
    }
  }

  private fallbackResponse(prompt: string): AIResponse {
    // Templates estáticos cuando no hay IA disponible
    const templates = {
      birthday: "🎂 ¡Feliz cumpleaños! Te esperamos con un regalo especial.",
      reactivation: "¡Te extrañamos! Vuelve pronto y disfruta de nuestro delicioso pollo.",
      welcome: "¡Bienvenido! Gracias por preferirnos.",
    };
    
    // Detectar tipo de mensaje y usar template
    const type = this.detectMessageType(prompt);
    return {
      content: templates[type] || templates.welcome,
      provider: "fallback",
      tokensUsed: 0
    };
  }
}

export const aiRouter = new AIRouter();
```

### Dashboard de Uso de IA

```
┌─────────────────────────────────────────────────────────────────┐
│  🤖 USO DE IA - Enero 2026                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GEMINI (Principal)                                             │
│  ████████████████████░░░░░░░░░░  67% del límite diario         │
│  1,005 / 1,500 requests hoy                                     │
│  Costo: $0                                                      │
│                                                                 │
│  DEEPSEEK (Backup 1)                                            │
│  ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░  8% del límite mensual         │
│  800K / 10M tokens este mes                                     │
│  Costo: $0                                                      │
│                                                                 │
│  SILICONFLOW (Backup 2)                                         │
│  Sin límite - 0 requests (no necesario aún)                    │
│  Costo: $0                                                      │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  📊 RESUMEN DEL MES:                                            │
│  - Mensajes generados: 4,250                                    │
│  - Tokens consumidos: 2.1M                                      │
│  - Costo total: $0.00                                           │
│  - Ahorro vs OpenAI: ~$63                                       │
│                                                                 │
│  ⚠️ ALERTAS:                                                    │
│  - Ninguna este mes                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```


---

## FUNCIONALIDADES DEL CRM

### 1. Base de Clientes

```
DATOS QUE CAPTURAMOS:
- Teléfono (identificador único)
- Nombre
- Cumpleaños (día/mes)
- Direcciones de delivery
- Historial de compras (automático)
- Preferencias detectadas por IA
- Saldo acumulado
- Segmento (calculado por IA)
```

### 2. Programa de Saldo (Simple)

```
REGLAS:
- Por cada S/10 de compra → S/0.50 de saldo (5%)
- Saldo se puede usar en cualquier momento
- Saldo expira a los 90 días sin comprar
- Saldo NO es dinero, es descuento

EJEMPLO:
- Cliente compra S/80 → Gana S/4 de saldo
- Próxima visita: "Tienes S/4 de saldo, ¿lo usas?"
- Si dice sí → Descuento de S/4 en la cuenta

VENTAJA vs PUNTOS:
- Fácil de entender (es dinero)
- No hay conversiones confusas
- El cliente sabe exactamente cuánto tiene
```

### 3. Cumpleaños Automático

```
FLUJO:
1. Sistema detecta cumpleaños del día
2. IA genera mensaje personalizado:
   - Usa nombre del cliente
   - Menciona su producto favorito
   - Incluye regalo según valor del cliente
3. Envía por WhatsApp a las 9am
4. Regalo se activa automáticamente en el sistema
5. Cuando viene, cajero ve: "🎂 CUMPLEAÑOS - Regalo: 1/4 Pollo"

REGALO SEGÚN VALOR:
- Cliente VIP (>20 visitas): Pollo entero gratis
- Cliente frecuente (10-20): 1/2 pollo gratis
- Cliente regular (5-10): 1/4 pollo gratis
- Cliente nuevo (<5): 15% descuento
```

### 4. Reactivación Automática

```
FLUJO:
1. Sistema detecta: "Carlos no viene hace 25 días"
2. IA analiza:
   - Frecuencia normal: cada 10 días
   - Última compra: S/65
   - Producto favorito: 1/2 pollo + chicha
3. IA genera mensaje personalizado:
   "Hola Carlos! 🍗 Hace tiempo no te vemos. 
   Tu 1/2 pollo con chicha te extraña. 
   Vuelve esta semana y te damos S/10 de descuento.
   Solo muestra este mensaje. Te esperamos!"
4. Envía por WhatsApp
5. Si viene en 7 días → Éxito, registrar
6. Si no viene → Segundo intento con oferta mayor
```

### 5. Campañas Inteligentes

```
IA DETECTA PATRONES Y SUGIERE:

Ejemplo 1: Día flojo
- IA: "Los martes tienes 40% menos ventas"
- Sugiere: "Campaña Martes de Pollo: 20% descuento"
- Segmento: Clientes que viven cerca, no vienen en martes
- Admin aprueba con 1 click

Ejemplo 2: Producto nuevo
- Admin: "Lanzamos alitas BBQ"
- IA genera campaña:
  - Mensaje: "🆕 Nuevas Alitas BBQ! Los primeros 50 
    clientes las prueban a mitad de precio"
  - Segmento: Clientes que piden pollo frito
  - Timing: Viernes 11am (antes del almuerzo)

Ejemplo 3: Clima
- IA detecta: "Pronóstico de lluvia el domingo"
- Sugiere: "Campaña delivery: Delivery gratis hoy"
- Segmento: Clientes de delivery en zona cercana
```

### 6. Resumen Ejecutivo para Dueño

```
TODOS LOS LUNES 8AM, WHATSAPP AL DUEÑO:

"📊 Resumen semanal - Tus 2 locales

💰 VENTAS
- Total: S/45,200 (+8% vs semana pasada)
- Local 1: S/24,100
- Local 2: S/21,100
- Mejor día: Domingo S/9,800

👥 CLIENTES
- Nuevos: 45
- Reactivados: 12 (S/780 recuperados)
- Cumpleaños atendidos: 8

🎯 CRM AUTOMÁTICO
- Mensajes enviados: 156
- Tasa de respuesta: 23%
- Cupones canjeados: 34

⚠️ ATENCIÓN
- Local 1: Chicha agotada 2 veces
- Local 2: 3 reclamos por demora delivery

📈 RECOMENDACIÓN IA:
Subir precio de pollo entero S/2 (demanda alta)
[Ver detalle] [Aprobar] [Ignorar]"
```

---

## ESCENARIOS REALES

### ESCENARIO C1: Cumpleaños de Cliente Frecuente

```
SITUACIÓN:
- Hoy es cumpleaños de María García
- Ha venido 15 veces en 6 meses
- Siempre pide 1/2 pollo + ensalada

FLUJO AUTOMÁTICO:
1. 9:00 AM - Sistema detecta cumpleaños
2. IA genera mensaje:
   "🎂 ¡Feliz cumpleaños María! 
   En [Pollería] queremos celebrar contigo.
   Tu 1/2 pollo favorito te espera GRATIS hoy.
   Solo muestra este mensaje al llegar.
   ¡Te esperamos! 🍗"
3. WhatsApp enviado automáticamente
4. María llega a las 7pm
5. Cajero busca por teléfono
6. Sistema muestra: 
   "🎂 CUMPLEAÑOS - Regalo: 1/2 Pollo GRATIS"
7. Cajero aplica descuento
8. María viene con 3 familiares
9. Venta total: S/120 (regalo costó S/29)
10. ROI: +S/91

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO C2: Cliente Inactivo Reactivado

```
SITUACIÓN:
- Juan no viene hace 35 días
- Antes venía cada 2 semanas
- Ticket promedio: S/55

FLUJO AUTOMÁTICO:
1. Sistema detecta inactividad (>30 días)
2. IA analiza perfil:
   - Riesgo de pérdida: ALTO
   - Valor del cliente: S/1,430/año
   - Producto favorito: Pollo entero
3. IA genera mensaje:
   "Hola Juan! 👋 
   Hace tiempo no nos visitas y te extrañamos.
   Sabemos que te encanta nuestro pollo entero.
   Esta semana, te damos S/15 de descuento 
   en tu próxima compra. 
   Solo muestra este mensaje. ¡Te esperamos!"
4. WhatsApp enviado
5. Juan responde: "Gracias! Voy el domingo"
6. Sistema registra interacción
7. Juan viene el domingo
8. Cajero ve: "CUPÓN REACTIVACIÓN: S/15"
9. Aplica descuento
10. Cliente reactivado ✓

MÉTRICAS:
- Costo del cupón: S/15
- Venta generada: S/65
- Valor futuro recuperado: ~S/700/año

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO C3: Campaña de Día Flojo

```
SITUACIÓN:
- IA detecta: Martes = 40% menos ventas
- Sugiere campaña automática

FLUJO:
1. Domingo 6pm - IA genera sugerencia:
   "📊 Oportunidad detectada:
   Los martes tienes 40% menos ventas.
   
   Campaña sugerida:
   - Nombre: Martes de Pollo
   - Oferta: 20% en pollos enteros
   - Segmento: 234 clientes cercanos
   - Envío: Lunes 6pm
   
   [Aprobar] [Editar] [Rechazar]"

2. Admin aprueba desde WhatsApp
3. Lunes 6pm - Sistema envía:
   "🍗 MARTES DE POLLO 🍗
   Mañana, tu pollo entero con 20% OFF.
   De S/58 a solo S/46.40
   Solo en [Local]. ¡Te esperamos!"

4. Martes - 45 clientes usan la promo
5. Ventas martes: +65% vs martes normal
6. Sistema registra éxito de campaña

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO C4: Alerta de Límite de IA

```
SITUACIÓN:
- Es fin de mes
- Gemini llegó al 90% del límite

FLUJO AUTOMÁTICO:
1. Sistema detecta: Gemini al 90%
2. Envía alerta al admin:
   "⚠️ ALERTA IA
   Gemini está al 90% del límite diario.
   
   Acciones automáticas:
   ✓ Cambiando a DeepSeek como respaldo
   ✓ Priorizando mensajes críticos
   
   Uso este mes:
   - Gemini: 40,500 / 45,000 (90%)
   - DeepSeek: 2.1M / 10M (21%)
   
   No se requiere acción. El sistema 
   continuará funcionando normalmente."

3. Sistema cambia a DeepSeek automáticamente
4. Operación continúa sin interrupción
5. Próximo mes, Gemini se resetea

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO C5: Cliente Pregunta por WhatsApp

```
SITUACIÓN:
- Cliente escribe: "Cuánto tengo de saldo?"
- Bot debe responder automáticamente

FLUJO:
1. Cliente envía mensaje a WhatsApp del negocio
2. Sistema detecta intención: CONSULTA_SALDO
3. Busca cliente por número de teléfono
4. IA genera respuesta:
   "Hola Carlos! 👋
   Tu saldo actual es S/12.50
   
   Puedes usarlo en tu próxima compra.
   Solo dile al cajero que quieres usar tu saldo.
   
   Recuerda: Tu saldo vence el 15 de marzo
   si no realizas ninguna compra.
   
   ¿Te esperamos hoy? 🍗"

5. Respuesta enviada en <3 segundos

ESTADO ACTUAL: ❌ NO EXISTE
```

### ESCENARIO C6: Sugerencia de Precio por IA

```
SITUACIÓN:
- IA analiza datos de 3 meses
- Detecta oportunidad de ajuste de precio

FLUJO:
1. IA genera análisis:
   "📈 OPORTUNIDAD DE PRECIO
   
   Producto: Pollo Entero
   Precio actual: S/58
   
   Análisis:
   - Demanda estable (no baja con precio)
   - Competencia cobra S/62 promedio
   - Costo del pollo subió 5%
   - Margen actual: 35%
   
   Recomendación:
   Subir a S/62 (+7%)
   
   Impacto estimado:
   - Ingreso adicional: +S/2,400/mes
   - Pérdida de clientes: ~3% (bajo)
   - Nuevo margen: 38%
   
   [Aprobar] [Aprobar S/60] [Rechazar]"

2. Dueño aprueba S/60 (punto medio)
3. Sistema actualiza precio en todos los locales
4. Registra decisión para análisis futuro

ESTADO ACTUAL: ❌ NO EXISTE
```



---

## MODELO DE DATOS

### Cliente

```typescript
interface Customer {
  customer_id: string;          // UUID
  tenant_id: string;
  
  // Identificación
  phone: string;                // Único por tenant
  name: string;
  email?: string;
  
  // Cumpleaños
  birthday_day?: number;        // 1-31
  birthday_month?: number;      // 1-12
  birthday_gift_used_year?: number;  // Para no repetir regalo
  
  // Saldo
  balance_cents: number;        // Saldo actual
  balance_expires_at?: string;  // Fecha de expiración
  total_earned_cents: number;   // Total histórico ganado
  total_redeemed_cents: number; // Total histórico canjeado
  
  // Métricas (calculadas)
  total_orders: number;
  total_spent_cents: number;
  avg_ticket_cents: number;
  first_order_at?: string;
  last_order_at?: string;
  days_since_last_order: number;
  
  // Segmentación (calculada por IA)
  segment: "VIP" | "FREQUENT" | "REGULAR" | "NEW" | "AT_RISK" | "LOST";
  lifetime_value_cents: number;
  churn_risk: number;           // 0-100
  
  // Preferencias (detectadas por IA)
  favorite_products: string[];  // product_ids
  preferred_order_type: "DINE_IN" | "TAKEOUT" | "DELIVERY";
  preferred_day?: string;       // "SUNDAY", "FRIDAY", etc.
  preferred_time?: string;      // "LUNCH", "DINNER"
  
  // Delivery
  addresses: CustomerAddress[];
  default_address_id?: string;
  
  // Comunicación
  whatsapp_opted_in: boolean;
  last_message_at?: string;
  messages_sent: number;
  messages_responded: number;
  
  // Metadata
  notes?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface CustomerAddress {
  address_id: string;
  label?: string;
  address_text: string;
  reference?: string;
  district?: string;
  zone_id?: string;
  delivery_fee_cents: number;
}
```

### Campaña

```typescript
interface Campaign {
  campaign_id: string;
  tenant_id: string;
  
  // Básico
  name: string;
  description?: string;
  type: "BIRTHDAY" | "REACTIVATION" | "PROMOTION" | "ANNOUNCEMENT" | "CUSTOM";
  
  // Estado
  status: "DRAFT" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "COMPLETED";
  
  // Segmentación
  segment_rules: SegmentRule[];
  estimated_reach: number;
  
  // Contenido
  message_template: string;     // Con variables: {{name}}, {{product}}, etc.
  ai_personalize: boolean;      // IA personaliza cada mensaje
  
  // Oferta
  offer?: {
    type: "PERCENT_DISCOUNT" | "FIXED_DISCOUNT" | "FREE_PRODUCT" | "BALANCE";
    value: number;              // Porcentaje o centavos
    product_id?: string;        // Si es FREE_PRODUCT
    min_purchase_cents?: number;
    max_discount_cents?: number;
  };
  
  // Programación
  scheduled_at?: string;
  send_time?: string;           // "09:00"
  recurring?: {
    frequency: "DAILY" | "WEEKLY" | "MONTHLY";
    days?: number[];            // Para WEEKLY: [1,5] = Lunes y Viernes
  };
  
  // Vigencia de la oferta
  offer_valid_from?: string;
  offer_valid_until?: string;
  
  // Métricas
  messages_sent: number;
  messages_delivered: number;
  messages_read: number;
  messages_responded: number;
  coupons_redeemed: number;
  revenue_generated_cents: number;
  
  // Metadata
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface SegmentRule {
  field: string;                // "days_since_last_order", "total_orders", etc.
  operator: "eq" | "gt" | "lt" | "gte" | "lte" | "in" | "not_in";
  value: any;
}
```

### Mensaje

```typescript
interface Message {
  message_id: string;
  tenant_id: string;
  customer_id: string;
  campaign_id?: string;
  
  // Contenido
  channel: "WHATSAPP" | "SMS" | "PUSH";
  content: string;
  content_generated_by: "AI" | "TEMPLATE" | "MANUAL";
  ai_provider?: string;         // "gemini", "deepseek", etc.
  
  // Estado
  status: "PENDING" | "SENT" | "DELIVERED" | "READ" | "RESPONDED" | "FAILED";
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  responded_at?: string;
  response_content?: string;
  
  // Cupón asociado
  coupon_code?: string;
  coupon_redeemed: boolean;
  coupon_redeemed_at?: string;
  
  // Metadata
  created_at: string;
}
```

### Uso de IA

```typescript
interface AIUsage {
  usage_id: string;
  tenant_id: string;
  
  // Provider
  provider: "gemini" | "deepseek" | "siliconflow" | "groq" | "fallback";
  model: string;
  
  // Uso
  date: string;                 // YYYY-MM-DD
  requests: number;
  tokens_input: number;
  tokens_output: number;
  tokens_total: number;
  
  // Costos
  cost_cents: number;           // Usualmente 0
  
  // Límites
  daily_limit: number;
  monthly_limit: number;
  daily_used: number;
  monthly_used: number;
  
  // Alertas
  alert_sent_80: boolean;
  alert_sent_95: boolean;
}
```

### Eventos Nuevos

```typescript
// Eventos de CRM para Event Sourcing

// Cliente
const CustomerCreatedPayload = z.object({
  customer_id: uuidSchema,
  phone: z.string(),
  name: z.string(),
  birthday_day: z.number().optional(),
  birthday_month: z.number().optional(),
});

const CustomerBalanceAdjustedPayload = z.object({
  customer_id: uuidSchema,
  delta_cents: centsSchema,     // Positivo = ganó, Negativo = usó
  reason: z.enum(["PURCHASE", "REDEMPTION", "BIRTHDAY", "CAMPAIGN", "MANUAL", "EXPIRATION"]),
  order_id: uuidSchema.optional(),
  new_balance_cents: positiveCentsSchema,
});

// Campañas
const CampaignCreatedPayload = z.object({
  campaign_id: uuidSchema,
  name: z.string(),
  type: z.enum(["BIRTHDAY", "REACTIVATION", "PROMOTION", "ANNOUNCEMENT", "CUSTOM"]),
  segment_rules: z.array(z.any()),
  message_template: z.string(),
});

const CampaignMessageSentPayload = z.object({
  campaign_id: uuidSchema,
  message_id: uuidSchema,
  customer_id: uuidSchema,
  channel: z.enum(["WHATSAPP", "SMS", "PUSH"]),
  content: z.string(),
  ai_provider: z.string().optional(),
});

const CouponRedeemedPayload = z.object({
  coupon_code: z.string(),
  customer_id: uuidSchema,
  order_id: uuidSchema,
  campaign_id: uuidSchema.optional(),
  discount_cents: positiveCentsSchema,
});

// IA
const AILimitAlertPayload = z.object({
  provider: z.string(),
  limit_type: z.enum(["DAILY", "MONTHLY"]),
  usage_percent: z.number(),
  action_taken: z.string(),
});
```

---

## IMPLEMENTACIÓN

### Estructura de Archivos

```
src/
├── core/
│   ├── ai/
│   │   ├── ai-router.ts           # Router multi-provider
│   │   ├── providers/
│   │   │   ├── gemini.ts
│   │   │   ├── deepseek.ts
│   │   │   ├── siliconflow.ts
│   │   │   └── groq.ts
│   │   ├── prompts/
│   │   │   ├── birthday.ts
│   │   │   ├── reactivation.ts
│   │   │   ├── campaign.ts
│   │   │   └── analysis.ts
│   │   └── usage-tracker.ts
│   │
│   └── crm/
│       ├── customer.service.ts
│       ├── campaign.service.ts
│       ├── message.service.ts
│       ├── balance.service.ts
│       └── segment.service.ts
│
├── app/
│   ├── admin/
│   │   └── crm/
│   │       ├── page.tsx           # Dashboard CRM
│   │       ├── customers/
│   │       │   ├── page.tsx       # Lista clientes
│   │       │   └── [id]/page.tsx  # Detalle cliente
│   │       ├── campaigns/
│   │       │   ├── page.tsx       # Lista campañas
│   │       │   ├── new/page.tsx   # Nueva campaña
│   │       │   └── [id]/page.tsx  # Detalle campaña
│   │       └── ai-usage/
│   │           └── page.tsx       # Uso de IA
│   │
│   └── api/
│       ├── crm/
│       │   ├── customers/route.ts
│       │   ├── campaigns/route.ts
│       │   └── messages/route.ts
│       ├── ai/
│       │   ├── generate/route.ts
│       │   └── usage/route.ts
│       └── webhooks/
│           └── whatsapp/route.ts
│
└── jobs/                          # Cron jobs
    ├── birthday-check.ts          # Diario 8am
    ├── reactivation-check.ts      # Diario 10am
    ├── campaign-sender.ts         # Cada hora
    ├── balance-expiration.ts      # Diario medianoche
    └── ai-usage-reset.ts          # Diario/Mensual
```

### Fases de Implementación

```
FASE 1: Base de Clientes (1 semana)
─────────────────────────────────────
- Modelo Customer en Prisma
- Captura de teléfono + nombre en POS
- Campo de cumpleaños opcional
- Búsqueda por teléfono

FASE 2: Saldo Simple (1 semana)
─────────────────────────────────────
- Acumulación automática (5%)
- Canje en POS
- Expiración a 90 días
- UI en ticket: "Saldo: S/X"

FASE 3: AI Router (1 semana)
─────────────────────────────────────
- Integración Gemini
- Integración DeepSeek
- Integración SiliconFlow
- Fallback a templates
- Tracking de uso
- Alertas de límite

FASE 4: Cumpleaños Automático (1 semana)
─────────────────────────────────────
- Job diario de detección
- Generación de mensaje con IA
- Envío por WhatsApp (manual primero)
- Aplicación de regalo en POS

FASE 5: Reactivación (1 semana)
─────────────────────────────────────
- Detección de inactividad
- Generación de mensaje con IA
- Cupones de reactivación
- Tracking de conversión

FASE 6: Campañas (2 semanas)
─────────────────────────────────────
- CRUD de campañas
- Segmentación
- Programación
- Envío masivo
- Métricas

FASE 7: WhatsApp Bot (2 semanas)
─────────────────────────────────────
- Webhook de WhatsApp Business
- Respuestas automáticas
- Consulta de saldo
- Pedidos por WhatsApp

FASE 8: Dashboard Ejecutivo (1 semana)
─────────────────────────────────────
- Resumen semanal automático
- Envío a dueño por WhatsApp
- Sugerencias de IA
- Aprobación desde WhatsApp
```

### UI: Dashboard CRM

```
┌─────────────────────────────────────────────────────────────────┐
│  🎯 CRM                                          Enero 2026     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────┐│
│  │ CLIENTES     │ │ MENSAJES     │ │ CUPONES      │ │ ROI     ││
│  │              │ │ ENVIADOS     │ │ CANJEADOS    │ │         ││
│  │    1,245     │ │    456       │ │     89       │ │ +S/2,340││
│  │   +45 nuevos │ │   este mes   │ │   este mes   │ │ este mes││
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────┘│
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  📊 SEGMENTOS                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ VIP (>20 visitas)      ████████████████         156 (13%)  ││
│  │ Frecuente (10-20)      ██████████████████████   289 (23%)  ││
│  │ Regular (5-10)         ████████████████████████ 345 (28%)  ││
│  │ Nuevo (<5)             ██████████████           234 (19%)  ││
│  │ En riesgo (>30 días)   ████████                 156 (13%)  ││
│  │ Perdido (>90 días)     ████                      65 (5%)   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  🎂 CUMPLEAÑOS HOY                          [Ver todos]         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ María García    │ VIP      │ Regalo: 1/2 Pollo │ ✅ Enviado ││
│  │ Juan Pérez      │ Regular  │ Regalo: 15% OFF   │ ✅ Enviado ││
│  │ Ana Torres      │ Nuevo    │ Regalo: 10% OFF   │ ⏳ Pendiente││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  🤖 USO DE IA                               [Ver detalle]       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Gemini     ████████████████░░░░░░░░░░  67% diario          ││
│  │ DeepSeek   ██░░░░░░░░░░░░░░░░░░░░░░░░   8% mensual         ││
│  │ Costo total este mes: $0.00                                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### UI: Detalle de Cliente

```
┌─────────────────────────────────────────────────────────────────┐
│  👤 CARLOS PÉREZ                                    [Editar]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📱 987654321                    🎂 15 de Marzo                 │
│  📧 carlos@email.com             🏷️ VIP                        │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  💰 SALDO                                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Saldo actual: S/ 24.50                                      ││
│  │ Vence: 15 de Marzo 2026 (si no compra)                     ││
│  │                                                             ││
│  │ Histórico:                                                  ││
│  │ - Total ganado: S/ 156.00                                   ││
│  │ - Total canjeado: S/ 131.50                                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  📊 MÉTRICAS                                                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ 23 visitas   │ │ S/ 1,495     │ │ S/ 65        │            │
│  │ total        │ │ gastado      │ │ ticket prom  │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                 │
│  Última visita: Hace 5 días                                    │
│  Frecuencia: Cada 10 días promedio                             │
│  Riesgo de pérdida: 15% (bajo)                                 │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ❤️ FAVORITOS (detectado por IA)                               │
│  1. 1/2 Pollo a la brasa (85% de visitas)                      │
│  2. Chicha Morada 1L (70% de visitas)                          │
│  3. Papas fritas grandes (60% de visitas)                      │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  📨 ÚLTIMOS MENSAJES                                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 05/01 │ Cumpleaños    │ ✅ Leído   │ Cupón canjeado        ││
│  │ 20/12 │ Reactivación  │ ✅ Respondió│ "Gracias, voy mañana" ││
│  │ 01/12 │ Promoción     │ ✅ Leído   │ No canjeó             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  📋 HISTORIAL DE COMPRAS                        [Ver todas]     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 31/12 │ #1234 │ 1/2 Pollo + Chicha    │ S/ 45  │ Delivery  ││
│  │ 22/12 │ #1198 │ Pollo entero + Papas  │ S/ 72  │ Local     ││
│  │ 15/12 │ #1156 │ 1/2 Pollo + Ensalada  │ S/ 52  │ Local     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│                    [Enviar mensaje]  [Agregar saldo manual]     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## CONSIDERACIONES TÉCNICAS

### Privacidad y Datos

```
CUMPLIMIENTO:
- Ley de Protección de Datos Personales (Perú)
- Consentimiento explícito para WhatsApp
- Opción de opt-out en cada mensaje
- Datos encriptados en reposo
- No compartir con terceros

RETENCIÓN:
- Datos de cliente: Indefinido (mientras sea cliente)
- Mensajes: 2 años
- Métricas agregadas: Indefinido
- Logs de IA: 90 días
```

### Offline Support

```
CRM requiere conexión para:
- Envío de mensajes
- Generación con IA
- Sincronización de métricas

Funciona offline:
- Consulta de saldo (cacheado)
- Aplicación de descuentos
- Registro de compras (sync después)
```

### Escalabilidad

```
Para múltiples locales:
- Clientes compartidos por marca
- Campañas pueden ser por local o globales
- Métricas agregadas y por local
- Saldo válido en cualquier local de la marca
```

---

**Última actualización:** Enero 2026  
**Estado:** Diseño completo — Listo para implementación Fase 1
**Dependencias:** Requiere MVP estable (bugs críticos resueltos)
