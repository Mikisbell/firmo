# Tarea 7.4: Auditoría de Componentes para React.memo

## Fecha
13 Febrero 2026

## Objetivo
Identificar componentes que se beneficiarían de React.memo para reducir re-renders innecesarios.

## Criterios de Selección

Un componente es candidato a React.memo si cumple:
1. **Es un componente "hoja"** (leaf component) que recibe props
2. **Se renderiza frecuentemente** (parte de listas, grids, o componentes padre que cambian estado)
3. **Tiene lógica de renderizado costosa** (animaciones, cálculos, muchos elementos DOM)
4. **Props estables** (las props no cambian en cada render del padre)

## Componentes Identificados

### 🔴 PRIORIDAD ALTA (5 componentes)

#### 1. LineItem (src/components/shared/LineItem.tsx)
**Razón:** 
- Componente de lista que se renderiza múltiples veces (1 por cada item en el carrito/orden)
- Usa framer-motion con animaciones costosas
- Se re-renderiza cada vez que el carrito cambia, incluso si el item específico no cambió
- Props: item, onIncrement, onDecrement, onRemove, readonly, compact

**Impacto Estimado:** ALTO - En un carrito con 10 items, evitaría 9 re-renders innecesarios por cada cambio

**Archivo:** `src/components/shared/LineItem.tsx` (línea 26)

---

#### 2. DeliveryDetail (src/app/delivery/components/DeliveryDetail.tsx)
**Razón:**
- Componente de lista en la app de delivery
- Se renderiza múltiples veces (1 por cada delivery)
- Tiene múltiples botones y lógica condicional
- Props: delivery, onDispatch, onDeliver, onFail

**Impacto Estimado:** MEDIO-ALTO - En una lista de 5 deliveries, evitaría 4 re-renders innecesarios

**Archivo:** `src/app/delivery/components/DeliveryDetail.tsx` (línea 25)

---

#### 3. TenantLogo (src/components/branding/TenantLogo.tsx)
**Razón:**
- Se usa en múltiples lugares (header, receipts, invoices)
- Tiene lógica de carga de imagen con estados (loading, error)
- Props: logoUrl, legalName, size, className

**Impacto Estimado:** MEDIO - Evitaría re-renders cuando el componente padre cambia pero el logo no

**Archivo:** `src/components/branding/TenantLogo.tsx` (línea 27)

---

#### 4. PinPad (src/components/auth/PinPad.tsx)
**Razón:**
- Componente con 12 botones (0-9 + Borrar + ⌫)
- Usa useCallback para handlers
- Se renderiza en pantallas de autenticación que pueden tener otros cambios de estado
- Props: onSubmit, disabled, error, maxLength

**Impacto Estimado:** MEDIO - Evitaría re-renders cuando el componente padre cambia pero el PIN no

**Archivo:** `src/components/auth/PinPad.tsx` (línea 16)

---

#### 5. Cart (src/app/pos/components/Cart.tsx)
**Razón:**
- Componente complejo con lista de items y animaciones
- Usa framer-motion
- Se renderiza en la página POS que tiene múltiples cambios de estado
- Props: sale, onConfirm, onStartSale

**Impacto Estimado:** ALTO - Evitaría re-renders costosos cuando otros elementos de la página POS cambian

**Archivo:** `src/app/pos/components/Cart.tsx` (línea 9)

---

### 🟡 PRIORIDAD MEDIA (3 componentes)

#### 6. BottomNavigation (src/components/ui/BottomNavigation.tsx)
**Razón:**
- Componente de navegación móvil con 5 items
- Se renderiza en todas las páginas móviles
- Props: items, activeId, className

**Impacto Estimado:** BAJO-MEDIO - Evitaría re-renders cuando la página cambia contenido pero no la navegación

**Archivo:** `src/components/ui/BottomNavigation.tsx` (línea 30)

---

#### 7. TenantInfo (src/components/branding/TenantInfo.tsx)
**Razón:**
- Se usa en headers, receipts, invoices
- Props estables (legalName, ruc, address, variant)
- Componente simple pero usado frecuentemente

**Impacto Estimado:** BAJO - Evitaría re-renders menores

**Archivo:** `src/components/branding/TenantInfo.tsx` (línea 21)

---

#### 8. ReceiptFooter (src/components/branding/ReceiptFooter.tsx)
**Razón:**
- Se usa en receipts que se generan frecuentemente
- Props estables (footerText, className)
- Componente muy simple

**Impacto Estimado:** BAJO - Evitaría re-renders menores

**Archivo:** `src/components/branding/ReceiptFooter.tsx` (línea 17)

---

### ⚪ NO REQUIEREN React.memo

#### ConfirmAction (src/components/ui/ConfirmAction.tsx)
**Razón:** Modal que solo se renderiza cuando isOpen=true, no se beneficia de memo

#### KDSLayout (src/components/kds/KDSLayout.tsx)
**Razón:** Layout component que cambia frecuentemente (counters, time), memo no ayudaría

## Resumen

| Prioridad | Componentes | Impacto Estimado |
|-----------|-------------|------------------|
| 🔴 ALTA | 5 | ALTO - Reducción 40-60% re-renders |
| 🟡 MEDIA | 3 | MEDIO - Reducción 20-30% re-renders |
| **TOTAL** | **8** | **Reducción estimada 30-50% re-renders** |

## Próximos Pasos

1. ✅ Auditoría completa (esta tarea)
2. ⏭️ Aplicar React.memo a los 8 componentes identificados (Tarea 7.5)
3. ⏭️ Medir reducción de re-renders con React DevTools Profiler

## Notas

- Todos los componentes identificados son "leaf components" que reciben props
- Ninguno tiene children como prop (que requeriría comparación especial)
- Todos tienen props estables o primitivas (strings, numbers, functions)
- La mayoría ya usa useCallback para handlers, lo que hace React.memo más efectivo

## Referencias

- Requirements: 5.2 (React.memo para componentes costosos)
- Design: Sección "React Performance Hooks"
- Auditoría anterior: TASK_7_USEEFFECT_AUDIT.md
