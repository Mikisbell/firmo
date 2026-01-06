# 🚀 PARK POS 2026 — Design Document: World-Class Architecture

## Executive Vision

**Objetivo:** Crear el POS más avanzado de Latinoamérica, comparable con Toast, Square, y Lightspeed, pero optimizado para el contexto peruano (offline-heavy, SUNAT, pollerías).

**Benchmark mundial:**
- **Toast (USA)**: $1.2B revenue, líder en restaurantes, IA predictiva
- **Square (USA)**: Ecosystem completo, hardware+software integrado
- **Lightspeed (Canada)**: Multi-location, analytics avanzados
- **Meituan (China)**: 600M usuarios, super-app de restaurantes

**Nuestra ventaja:** Offline-native + SUNAT nativo + IA con APIs gratuitas 2026

---

## Architecture: Edge-First with CRDT

### Paradigm Shift: De "Offline-First" a "Edge-Native"

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PARK POS 2026 - EDGE-NATIVE ARCHITECTURE             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      EDGE LAYER (Device)                         │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │   │
│  │  │ Waiter  │  │ Waiter  │  │ Cashier │  │   KDS   │            │   │
│  │  │ Tab 1   │  │ Tab 15  │  │   POS   │  │ Screen  │            │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘            │   │
│  │       │            │            │            │                  │   │
│  │       ▼            ▼            ▼            ▼                  │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │              LOCAL MESH NETWORK (WebRTC P2P)             │   │   │
│  │  │         Devices sync directly without server             │   │   │
│  │  │              Latency: <10ms between devices              │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                              │                                  │   │
│  │                              ▼                                  │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │                    CRDT STATE STORE                      │   │   │
│  │  │  • Yjs/Automerge for conflict-free merging               │   │   │
│  │  │  • No conflicts, ever - mathematically guaranteed        │   │   │
│  │  │  • IndexedDB + OPFS for 100GB+ local storage            │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼ (when online)                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                       CLOUD LAYER (Backup)                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │   │
│  │  │  Supabase   │  │   SUNAT     │  │  Analytics  │              │   │
│  │  │  Realtime   │  │    OSE      │  │   (Tinybird)│              │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why CRDT over Event Sourcing for Sync?

| Aspecto | Event Sourcing (actual) | CRDT (propuesto) |
|---------|------------------------|------------------|
| Conflictos | Requiere resolución manual | Matemáticamente imposibles |
| Latencia sync | 100-500ms | <10ms (P2P) |
| Offline duration | Horas | Semanas sin problema |
| Complejidad | Alta (outbox, idempotencia) | Baja (merge automático) |
| Bibliotecas | Custom | Yjs, Automerge (battle-tested) |

**Implementación recomendada:** [Yjs](https://github.com/yjs/yjs) - 15K+ stars, usado por Notion, Figma


---

## Component 1: AI-Powered Everything

### 1.1 Voice-First Interface (Como Alexa para restaurantes)

```typescript
// Comandos de voz naturales - sin entrenar
const VOICE_COMMANDS = {
  // Cajero
  "cobra mesa cinco": () => openPayment(5),
  "agrega un cuarto de pollo": () => addItem("POL-025"),
  "descuento diez por ciento": () => applyDiscount(0.10),
  "imprime la última boleta": () => reprintLast(),
  
  // Mesero
  "mesa doce pide dos pollos enteros": () => addOrder(12, [{sku: "POL-100", qty: 2}]),
  "la ocho quiere la cuenta": () => requestBill(8),
  
  // KDS
  "listo pedido cuarenta y cinco": () => markReady(45),
  "siguiente": () => nextTicket(),
};

// Implementación con Web Speech API + Whisper fallback
interface VoiceEngine {
  provider: 'native' | 'whisper' | 'google';
  language: 'es-PE';
  hotword: 'Park' | 'Oye Park';
  confidence_threshold: 0.85;
  
  // Contexto adaptativo
  context: {
    current_screen: string;
    recent_items: string[];
    frequent_commands: string[];
  };
}
```

### 1.2 Predictive AI (Gemini/DeepSeek gratuito)

```typescript
interface PredictiveFeatures {
  // Predicción de demanda
  demand_forecast: {
    // "Mañana es feriado, necesitarás 40% más pollos"
    predict_daily_demand(date: Date): Promise<DemandForecast>;
    
    // "A las 7PM tendrás pico, prepara 20 pollos extra"
    predict_hourly_rush(): Promise<HourlyPrediction[]>;
  };
  
  // Detección de anomalías
  anomaly_detection: {
    // "Mesa 5 lleva 2 horas, ¿todo bien?"
    detect_long_tables(): Promise<Alert[]>;
    
    // "Hoy vendiste 30% menos que el promedio del martes"
    detect_sales_anomaly(): Promise<Alert[]>;
    
    // "El cajero Juan tiene 5% más anulaciones que el promedio"
    detect_fraud_patterns(): Promise<Alert[]>;
  };
  
  // Recomendaciones automáticas
  recommendations: {
    // "Sube el precio del 1/4 pollo S/2, la demanda aguanta"
    suggest_price_optimization(): Promise<PriceSuggestion[]>;
    
    // "Promociona la ensalada, tienes exceso de lechuga"
    suggest_promotions(): Promise<PromotionSuggestion[]>;
  };
}

// Multi-provider con fallback automático
const AI_PROVIDERS = [
  { name: 'gemini', limit: 1500, cost: 0 },      // 1500 req/día gratis
  { name: 'deepseek', limit: 10_000_000, cost: 0 }, // 10M tokens/mes gratis
  { name: 'groq', limit: 14400, cost: 0 },       // 14400 req/día gratis
  { name: 'siliconflow', limit: Infinity, cost: 0 }, // Qwen ilimitado gratis
];
```

### 1.3 Computer Vision (Opcional pero poderoso)

```typescript
interface VisionFeatures {
  // Reconocimiento de platos para KDS
  dish_recognition: {
    // Cámara sobre expedición verifica que el plato es correcto
    verify_order(image: Blob, expected: OrderItem[]): Promise<VerificationResult>;
  };
  
  // Conteo de personas
  occupancy_tracking: {
    // Cámara cuenta personas en el local
    get_current_occupancy(): Promise<number>;
    
    // Predice tiempo de espera basado en ocupación
    estimate_wait_time(): Promise<number>;
  };
  
  // Reconocimiento de clientes frecuentes (opt-in)
  customer_recognition: {
    // "Bienvenido de vuelta, Sr. García. ¿Lo de siempre?"
    identify_customer(image: Blob): Promise<Customer | null>;
  };
}
```

---

## Component 2: Zero-Latency UX

### 2.1 Optimistic UI with Instant Feedback

```typescript
// ANTES (tradicional): Usuario espera respuesta del servidor
// click → loading... → success/error

// AHORA (optimistic): Feedback instantáneo, rollback si falla
// click → instant success → background sync → rollback if error

interface OptimisticAction<T> {
  // Ejecuta inmediatamente en UI
  optimistic_update: (state: State) => State;
  
  // Ejecuta en background
  server_action: () => Promise<T>;
  
  // Si falla, revierte
  rollback: (state: State, error: Error) => State;
  
  // Notifica al usuario solo si hay problema
  on_conflict: (conflict: Conflict) => void;
}

// Ejemplo: Agregar item a orden
const addItemOptimistic: OptimisticAction<OrderItem> = {
  optimistic_update: (state) => ({
    ...state,
    items: [...state.items, newItem],
    total: state.total + newItem.price,
  }),
  
  server_action: async () => {
    return await api.addItem(orderId, newItem);
  },
  
  rollback: (state, error) => ({
    ...state,
    items: state.items.filter(i => i.id !== newItem.id),
    total: state.total - newItem.price,
  }),
  
  on_conflict: (conflict) => {
    toast.error(`No se pudo agregar: ${conflict.reason}`);
  },
};
```

### 2.2 Gesture-Based Navigation

```typescript
interface GestureConfig {
  // Swipe gestures
  swipe_left: 'next_table' | 'void_item' | 'custom';
  swipe_right: 'previous_table' | 'add_item' | 'custom';
  swipe_up: 'open_menu' | 'scroll' | 'custom';
  swipe_down: 'close' | 'refresh' | 'custom';
  
  // Multi-touch
  pinch: 'zoom_layout' | 'none';
  two_finger_swipe: 'switch_view' | 'none';
  
  // Long press
  long_press: 'context_menu' | 'edit_mode' | 'custom';
  
  // Shake (para emergencias)
  shake: 'call_manager' | 'sos' | 'none';
}

// Implementación con Hammer.js o native touch events
```

### 2.3 Adaptive UI (Se adapta al contexto)

```typescript
interface AdaptiveUI {
  // Por rol
  role_based: {
    cashier: { layout: 'payment_focused', shortcuts: ['cobrar', 'anular'] },
    waiter: { layout: 'table_focused', shortcuts: ['agregar', 'cuenta'] },
    kitchen: { layout: 'ticket_focused', shortcuts: ['listo', 'siguiente'] },
    admin: { layout: 'dashboard_focused', shortcuts: ['reportes', 'config'] },
  };
  
  // Por hora del día
  time_based: {
    morning: { brightness: 'high', font_size: 'normal' },
    lunch_rush: { brightness: 'high', font_size: 'large', animations: 'minimal' },
    evening: { brightness: 'medium', font_size: 'normal' },
    night: { brightness: 'low', font_size: 'normal', theme: 'dark' },
  };
  
  // Por carga de trabajo
  load_based: {
    idle: { show_tips: true, animations: 'full' },
    busy: { show_tips: false, animations: 'minimal', shortcuts_visible: true },
    critical: { emergency_mode: true, only_essentials: true },
  };
}
```


---

## Component 3: Real-Time Everything

### 3.1 WebRTC Mesh for P2P Sync

```typescript
// Los dispositivos se sincronizan entre sí SIN pasar por servidor
// Latencia: <10ms vs 100-500ms tradicional

interface MeshNetwork {
  // Cada dispositivo es un nodo
  nodes: Map<DeviceId, PeerConnection>;
  
  // Topología: Full mesh para <20 dispositivos (tu caso: 17)
  topology: 'full_mesh' | 'star' | 'hybrid';
  
  // Protocolo de descubrimiento
  discovery: {
    method: 'mdns' | 'signaling_server' | 'bluetooth';
    fallback: 'supabase_realtime';
  };
  
  // Sincronización
  sync: {
    protocol: 'yjs' | 'automerge';
    compression: 'lz4' | 'zstd';
    encryption: 'aes-256-gcm';
  };
}

// Ejemplo de sync P2P
class P2PSync {
  private doc: Y.Doc;
  private provider: WebrtcProvider;
  
  constructor(roomId: string) {
    this.doc = new Y.Doc();
    this.provider = new WebrtcProvider(roomId, this.doc, {
      signaling: ['wss://park-pos-signaling.fly.dev'],
      password: tenantSecret,
      awareness: new awarenessProtocol.Awareness(this.doc),
    });
  }
  
  // Cambios se propagan automáticamente a todos los peers
  addOrder(order: Order) {
    const orders = this.doc.getMap('orders');
    orders.set(order.id, order);
    // Automáticamente sincronizado a todos los dispositivos conectados
  }
}
```

### 3.2 Live Cursors & Presence (Como Figma)

```typescript
// Ver en tiempo real qué está haciendo cada terminal
interface Presence {
  device_id: string;
  user_name: string;
  role: 'cashier' | 'waiter' | 'kitchen';
  
  // Qué está viendo/haciendo
  current_view: string;
  current_table?: number;
  current_order?: string;
  
  // Estado
  status: 'active' | 'idle' | 'offline';
  last_activity: Date;
}

// UI muestra: "María está editando Mesa 5" en tiempo real
// Evita conflictos antes de que ocurran
```

### 3.3 Instant Notifications (Push + In-App)

```typescript
interface NotificationSystem {
  channels: {
    // In-app (siempre)
    in_app: {
      toast: boolean;      // Notificaciones pequeñas
      modal: boolean;      // Alertas importantes
      sound: boolean;      // Sonidos
      vibration: boolean;  // Vibración en tablets
    };
    
    // Push (cuando app cerrada)
    push: {
      provider: 'firebase' | 'onesignal';
      priority: 'high' | 'normal';
    };
    
    // WhatsApp (para dueño/admin)
    whatsapp: {
      enabled: boolean;
      phone: string;
      alerts: ('sales_summary' | 'anomaly' | 'low_stock')[];
    };
  };
  
  // Tipos de notificación
  types: {
    // Operacionales (in-app)
    order_ready: { sound: 'ding', vibrate: true };
    table_waiting: { sound: 'alert', vibrate: true };
    payment_received: { sound: 'cash', vibrate: false };
    
    // Alertas (push + whatsapp)
    low_stock: { push: true, whatsapp: true };
    anomaly_detected: { push: true, whatsapp: true };
    shift_ending: { push: true, whatsapp: false };
    
    // Críticas (todo)
    system_error: { push: true, whatsapp: true, sms: true };
    security_alert: { push: true, whatsapp: true, sms: true };
  };
}
```

---

## Component 4: Smart Inventory (AI-Driven)

### 4.1 Predictive Stock Management

```typescript
interface SmartInventory {
  // Predicción de consumo
  predict_consumption: {
    // "Mañana necesitarás 45 pollos basado en histórico + clima + eventos"
    daily_forecast(date: Date): Promise<{
      sku: string;
      predicted_qty: number;
      confidence: number;
      factors: string[]; // ["feriado", "lluvia", "partido_peru"]
    }[]>;
  };
  
  // Auto-reorden
  auto_reorder: {
    enabled: boolean;
    
    // Cuando stock < punto_reorden, crear orden automática
    rules: {
      sku: string;
      reorder_point: number;
      reorder_qty: number;
      supplier_id: string;
      auto_approve_under: number; // Monto máximo sin aprobación
    }[];
    
    // Integración con proveedores
    supplier_integration: {
      type: 'email' | 'whatsapp' | 'api';
      auto_send: boolean;
    };
  };
  
  // Detección de merma
  waste_detection: {
    // Compara consumo teórico vs real
    detect_discrepancy(): Promise<{
      sku: string;
      theoretical: number;
      actual: number;
      variance: number;
      variance_cost: number;
      likely_cause: 'theft' | 'waste' | 'recipe_error' | 'counting_error';
    }[]>;
  };
}
```

### 4.2 Recipe-Based Auto-Decrement

```typescript
interface RecipeEngine {
  // Recetas con variantes
  recipes: Map<ProductSKU, Recipe>;
  
  // Cuando se vende un producto, descuenta ingredientes automáticamente
  async onSale(item: OrderItem): Promise<StockMovement[]> {
    const recipe = this.recipes.get(item.sku);
    if (!recipe) return [];
    
    const movements: StockMovement[] = [];
    
    for (const ingredient of recipe.ingredients) {
      // Considera modificadores (sin ensalada, extra papas, etc.)
      let qty = ingredient.qty * item.quantity;
      
      if (item.modifiers) {
        qty = this.applyModifiers(qty, ingredient, item.modifiers);
      }
      
      movements.push({
        sku: ingredient.sku,
        qty: -qty,
        reason: 'SALE',
        reference: item.order_id,
      });
    }
    
    return movements;
  };
  
  // Calcula costo de receta en tiempo real
  calculateCOGS(sku: string): number {
    const recipe = this.recipes.get(sku);
    return recipe.ingredients.reduce((sum, ing) => {
      const stock = this.getStock(ing.sku);
      return sum + (ing.qty * stock.avg_cost);
    }, 0);
  };
}
```


---

## Component 5: SUNAT 2026 (Facturación Inteligente)

### 5.1 Predictive Invoicing

```typescript
interface SmartInvoicing {
  // Predicción de tipo de comprobante
  predict_document_type: {
    // Basado en monto, hora, cliente frecuente
    // "Este cliente siempre pide factura, ¿la preparo?"
    suggest(order: Order): Promise<{
      type: 'boleta' | 'factura';
      confidence: number;
      reason: string;
    }>;
  };
  
  // Auto-completado de RUC
  ruc_autocomplete: {
    // Cache local de RUCs frecuentes
    frequent_customers: Map<string, CustomerData>;
    
    // Consulta SUNAT en background
    async lookup(ruc: string): Promise<CustomerData>;
    
    // Sugiere basado en historial
    suggest(partial: string): CustomerData[];
  };
  
  // Contingencia inteligente
  smart_contingency: {
    // Detecta problemas antes de que fallen
    health_check(): Promise<{
      ose_status: 'ok' | 'degraded' | 'down';
      sunat_status: 'ok' | 'degraded' | 'down';
      recommendation: 'normal' | 'prepare_contingency' | 'activate_contingency';
    }>;
    
    // Activa contingencia proactivamente
    auto_activate: boolean;
  };
}
```

### 5.2 Multi-OSE Failover

```typescript
interface OSEFailover {
  providers: [
    { name: 'nubefact', priority: 1, status: 'active' },
    { name: 'efact', priority: 2, status: 'standby' },
    { name: 'sunat_pse', priority: 3, status: 'standby' }, // Directo a SUNAT
  ];
  
  // Failover automático
  async send(invoice: Invoice): Promise<CDR> {
    for (const provider of this.providers.sort(p => p.priority)) {
      try {
        return await provider.send(invoice);
      } catch (error) {
        this.markDegraded(provider);
        continue;
      }
    }
    // Si todos fallan, modo contingencia
    return this.activateContingency(invoice);
  };
  
  // Health monitoring
  async monitorHealth(): Promise<void> {
    for (const provider of this.providers) {
      const health = await provider.healthCheck();
      if (health.latency > 5000 || health.error_rate > 0.05) {
        this.notifyAdmin(`${provider.name} degradado`);
      }
    }
  };
}
```

---

## Component 6: Smart Tables & Reservations

### 6.1 AI-Powered Table Assignment

```typescript
interface SmartTableAssignment {
  // Asignación óptima automática
  async assignTable(party: {
    size: number;
    preferences?: ('window' | 'quiet' | 'outdoor')[];
    reservation_id?: string;
    vip?: boolean;
  }): Promise<Table> {
    const available = await this.getAvailableTables();
    
    // Scoring basado en múltiples factores
    const scored = available.map(table => ({
      table,
      score: this.calculateScore(table, party, {
        // Factores
        capacity_fit: 0.3,      // Mesa del tamaño correcto
        preference_match: 0.25, // Cumple preferencias
        server_balance: 0.2,   // Balancear carga de meseros
        turnover_optimization: 0.15, // Optimizar rotación
        vip_priority: 0.1,     // Prioridad VIP
      }),
    }));
    
    return scored.sort((a, b) => b.score - a.score)[0].table;
  };
  
  // Predicción de tiempo de mesa
  predictTableDuration(table: Table): Promise<{
    estimated_minutes: number;
    confidence: number;
    based_on: ('party_size' | 'order_type' | 'historical')[];
  }>;
}
```

### 6.2 WhatsApp-Native Reservations

```typescript
interface WhatsAppReservations {
  // Chatbot para reservas
  chatbot: {
    // Conversación natural
    // Cliente: "Quiero reservar para 6 personas el sábado"
    // Bot: "¡Perfecto! Tengo disponible 7pm, 8pm o 9pm. ¿Cuál prefieres?"
    
    intents: {
      'make_reservation': ReservationFlow;
      'modify_reservation': ModifyFlow;
      'cancel_reservation': CancelFlow;
      'check_availability': AvailabilityFlow;
    };
    
    // NLU con Gemini/DeepSeek
    nlu_provider: 'gemini' | 'deepseek';
  };
  
  // Confirmaciones automáticas
  auto_confirm: {
    // 24h antes
    reminder_24h: {
      template: 'reservation_reminder';
      include_directions: true;
      include_menu: true;
    };
    
    // 2h antes
    reminder_2h: {
      template: 'reservation_confirm';
      require_response: true;
      timeout_minutes: 60;
      on_no_response: 'call' | 'release';
    };
  };
  
  // Waitlist con notificación
  waitlist: {
    // Cuando se libera mesa, notifica automáticamente
    auto_notify: true;
    response_timeout_minutes: 15;
    max_position: 10;
  };
}
```

---

## Component 7: Employee Management 2026

### 7.1 Biometric + Geofence Clock-In

```typescript
interface SmartAttendance {
  // Métodos de marcación
  clock_methods: {
    // PIN (básico)
    pin: { enabled: true, digits: 4 };
    
    // Biométrico (Face ID / Fingerprint)
    biometric: {
      enabled: true;
      types: ['face', 'fingerprint'];
      fallback: 'pin';
    };
    
    // Geofence (automático al llegar)
    geofence: {
      enabled: true;
      radius_meters: 50;
      auto_clock_in: false; // Solo notifica
      auto_clock_out: true; // Clock out si sale del área
    };
    
    // NFC (tarjeta/pulsera)
    nfc: {
      enabled: true;
      device: 'reader' | 'phone';
    };
  };
  
  // Anti-fraude
  fraud_prevention: {
    // No permitir clock-in desde casa
    require_location: true;
    
    // Foto al marcar (opcional)
    selfie_verification: false;
    
    // Detectar patrones sospechosos
    anomaly_detection: {
      // "Juan siempre marca a las 8:00:00 exactas" → sospechoso
      detect_too_precise: true;
      
      // "María marcó entrada pero no hay actividad en POS"
      detect_no_activity: true;
    };
  };
}
```

### 7.2 AI Schedule Optimization

```typescript
interface SmartScheduling {
  // Generación automática de horarios
  auto_generate: {
    // Input: demanda predicha + disponibilidad empleados
    // Output: horario óptimo
    
    async generate(week: Date): Promise<Schedule[]> {
      const demand = await this.predictDemand(week);
      const availability = await this.getAvailability(week);
      const preferences = await this.getPreferences();
      
      // Optimización con restricciones
      return this.optimize({
        demand,
        availability,
        preferences,
        constraints: {
          max_hours_week: 48,
          min_rest_between_shifts: 11, // horas
          max_consecutive_days: 6,
          fair_distribution: true,
        },
      });
    };
  };
  
  // Swap automático
  auto_swap: {
    // Empleado solicita cambio → sistema encuentra reemplazo
    async findReplacement(shift: Shift): Promise<Employee[]> {
      return this.employees.filter(e => 
        e.isAvailable(shift.date) &&
        e.hasSkills(shift.required_skills) &&
        e.wantsExtraHours
      );
    };
    
    // Notifica y confirma automáticamente
    auto_notify: true;
    require_manager_approval: false; // Solo para turnos críticos
  };
}
```


---

## Component 8: Analytics & Insights (Real-Time)

### 8.1 Live Dashboard (Como Bloomberg Terminal)

```typescript
interface LiveDashboard {
  // Métricas en tiempo real (actualización <1s)
  realtime_metrics: {
    // Ventas
    sales_today: number;
    sales_vs_yesterday: number; // %
    sales_vs_last_week: number; // %
    
    // Operación
    tables_occupied: number;
    avg_table_time: number;
    orders_in_kitchen: number;
    avg_kitchen_time: number;
    
    // Staff
    employees_present: number;
    tips_today: number;
  };
  
  // Gráficos live
  live_charts: {
    sales_by_hour: TimeSeriesChart;
    orders_by_category: PieChart;
    table_heatmap: HeatmapChart;
    kitchen_queue: BarChart;
  };
  
  // Alertas inteligentes
  smart_alerts: {
    // "Ventas 20% abajo del promedio para esta hora"
    sales_anomaly: boolean;
    
    // "Cocina saturada, tiempo promedio 25min (normal: 15min)"
    kitchen_bottleneck: boolean;
    
    // "Mesa 12 lleva 2h sin pedir, ¿todo bien?"
    idle_table: boolean;
  };
}
```

### 8.2 Predictive Analytics

```typescript
interface PredictiveAnalytics {
  // Forecasting
  forecasts: {
    // Ventas próximos 7 días
    sales_forecast: {
      date: Date;
      predicted: number;
      confidence_low: number;
      confidence_high: number;
      factors: string[];
    }[];
    
    // Demanda por producto
    product_demand: Map<SKU, DemandForecast>;
    
    // Staffing recomendado
    staffing_recommendation: {
      date: Date;
      hour: number;
      recommended_staff: {
        role: string;
        count: number;
      }[];
    }[];
  };
  
  // What-if analysis
  simulations: {
    // "¿Qué pasa si subo precios 10%?"
    price_change_impact(sku: string, change: number): Promise<{
      revenue_change: number;
      volume_change: number;
      profit_change: number;
    }>;
    
    // "¿Qué pasa si abro una hora más temprano?"
    hours_change_impact(new_hours: OpeningHours): Promise<{
      additional_revenue: number;
      additional_cost: number;
      net_impact: number;
    }>;
  };
}
```

---

## Data Models (Optimized for 2026)

### Core Entities with CRDT Support

```typescript
// Usando Yjs para sync conflict-free
import * as Y from 'yjs';

// Order con CRDT
interface CRDTOrder {
  // Yjs Map para campos que pueden cambiar
  _ymap: Y.Map<any>;
  
  // Campos inmutables
  readonly id: string;
  readonly tenant_id: string;
  readonly created_at: Date;
  readonly created_by: string;
  
  // Campos mutables (via CRDT)
  get items(): Y.Array<OrderItem>;
  get status(): OrderStatus;
  get table_id(): string | null;
  get total(): number; // Calculado
  
  // Métodos que modifican el CRDT
  addItem(item: OrderItem): void;
  removeItem(itemId: string): void;
  updateStatus(status: OrderStatus): void;
  
  // Observadores
  observe(callback: (event: Y.YMapEvent<any>) => void): void;
}

// Stock con CRDT (para sync entre locales)
interface CRDTStock {
  _ymap: Y.Map<any>;
  
  readonly sku: string;
  readonly location_id: string;
  
  // Counter CRDT para cantidad (nunca conflicta)
  get quantity(): Y.Counter;
  
  // Métodos
  increment(amount: number): void;
  decrement(amount: number): void;
}
```

### Money: Always Cents, Type-Safe

```typescript
// Branded type para evitar errores
type Cents = number & { readonly __brand: 'cents' };

// Helper functions
const Money = {
  fromCents: (cents: number): Cents => cents as Cents,
  fromSoles: (soles: number): Cents => Math.round(soles * 100) as Cents,
  toCents: (money: Cents): number => money,
  toSoles: (money: Cents): number => money / 100,
  format: (money: Cents): string => `S/ ${(money / 100).toFixed(2)}`,
  
  // Operaciones seguras
  add: (a: Cents, b: Cents): Cents => (a + b) as Cents,
  subtract: (a: Cents, b: Cents): Cents => (a - b) as Cents,
  multiply: (a: Cents, factor: number): Cents => Math.round(a * factor) as Cents,
  
  // Validación
  isValid: (value: unknown): value is Cents => 
    typeof value === 'number' && Number.isInteger(value) && value >= 0,
};

// Uso
const price: Cents = Money.fromSoles(25.50); // 2550
const total: Cents = Money.multiply(price, 3); // 7650
console.log(Money.format(total)); // "S/ 76.50"
```

---

## Correctness Properties

*Una propiedad es una característica que debe mantenerse verdadera en todas las ejecuciones válidas del sistema.*

### Property 1: CRDT Convergence
*For any* set of concurrent operations on the same document from different devices, all devices MUST eventually converge to the same state without manual conflict resolution.
**Validates: Requirements 1.7, 2.8 (offline behavior)**

### Property 2: Money Integrity
*For any* financial calculation, the result MUST be an integer (cents) and the sum of all line items MUST equal the order total.
**Validates: Requirements 1.8, 4.3, 5.2**

### Property 3: Stock Consistency
*For any* sale event, the stock decrement MUST equal the sum of recipe ingredients multiplied by quantity sold.
**Validates: Requirements 1.4, 1.5**

### Property 4: Invoice Completeness
*For any* completed payment, exactly one valid SUNAT document (boleta/factura) MUST be generated within 7 days.
**Validates: Requirements 2.1, 2.4, 2.8**

### Property 5: Table State Machine
*For any* table, the state transitions MUST follow: AVAILABLE → OCCUPIED → (CLEANING) → AVAILABLE, with no invalid transitions.
**Validates: Requirements 3.2, 3.5**

### Property 6: Attendance Integrity
*For any* employee shift, clock_out time MUST be >= clock_in time, and worked_hours MUST equal the difference minus breaks.
**Validates: Requirements 7.2, 7.3**

### Property 7: Tip Distribution
*For any* tip pool distribution, the sum of individual distributions MUST equal the total pool amount (no money lost or created).
**Validates: Requirements 5.2, 5.3**

---

## Error Handling Strategy

### Self-Healing System

```typescript
interface SelfHealing {
  // Detección automática de problemas
  health_checks: {
    interval_ms: 5000;
    checks: [
      'database_connection',
      'sync_status',
      'ose_connection',
      'disk_space',
      'memory_usage',
    ];
  };
  
  // Recuperación automática
  auto_recovery: {
    // Si sync falla, reintentar con backoff
    sync_failure: {
      action: 'retry_with_backoff';
      max_retries: 10;
      backoff: 'exponential';
    };
    
    // Si OSE falla, cambiar proveedor
    ose_failure: {
      action: 'failover_to_backup';
      notify_admin: true;
    };
    
    // Si disco lleno, limpiar cache
    disk_full: {
      action: 'cleanup_cache';
      threshold_gb: 1;
    };
    
    // Si memoria alta, reiniciar workers
    memory_high: {
      action: 'restart_workers';
      threshold_percent: 90;
    };
  };
  
  // Notificación solo cuando no puede auto-recuperar
  escalation: {
    after_retries: 3;
    channels: ['push', 'whatsapp', 'sms'];
  };
}
```

---

## Testing Strategy

### Property-Based Testing con fast-check

```typescript
import fc from 'fast-check';

describe('Money Properties', () => {
  // Property: Suma de items = total
  it('order total equals sum of items', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          price: fc.integer({ min: 100, max: 100000 }),
          quantity: fc.integer({ min: 1, max: 100 }),
        })),
        (items) => {
          const order = createOrder(items);
          const expectedTotal = items.reduce(
            (sum, item) => sum + item.price * item.quantity, 
            0
          );
          return order.total === expectedTotal;
        }
      )
    );
  });
  
  // Property: CRDT convergence
  it('concurrent edits converge', () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(
          fc.record({ type: fc.constant('add'), item: fc.string() }),
          fc.record({ type: fc.constant('remove'), index: fc.nat() }),
        )),
        (operations) => {
          const doc1 = new Y.Doc();
          const doc2 = new Y.Doc();
          
          // Apply operations in different orders
          applyOperations(doc1, operations);
          applyOperations(doc2, shuffle(operations));
          
          // Sync
          Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));
          Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));
          
          // Must converge
          return deepEqual(doc1.toJSON(), doc2.toJSON());
        }
      )
    );
  });
});
```

---

## Implementation Timeline (Realistic 2026)

| Fase | Módulo | Días | Herramientas |
|------|--------|------|--------------|
| 1 | CRDT Setup (Yjs) | 3 | Cursor + Copilot |
| 2 | P2P Mesh (WebRTC) | 4 | v0.dev + manual |
| 3 | Voice Commands | 2 | Web Speech API |
| 4 | Smart Inventory | 5 | Gemini API |
| 5 | SUNAT Integration | 4 | Nubefact SDK |
| 6 | Smart Tables | 3 | React DnD |
| 7 | WhatsApp Bot | 3 | Twilio/Meta API |
| 8 | Employee Mgmt | 4 | Biometric.js |
| 9 | Analytics Dashboard | 3 | Tremor + Tinybird |
| 10 | Testing & Polish | 4 | fast-check + Playwright |

**Total: 35 días** (vs 76 días del diseño anterior)

Con IA generativa y herramientas 2026, el desarrollo es 2x más rápido.

---

*Última actualización: Enero 2026*
*Versión: 2.0 - World-Class Architecture*
