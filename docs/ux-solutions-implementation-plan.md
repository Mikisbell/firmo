# UX Solutions Implementation Plan

> 21 validated solutions → Real UI integration
> Started: April 9, 2026

---

## Week 1: Core POS Fixes (High Impact, Low Risk)

### Fix 1: Auto-calculate Change with Breakdown
**Status**: 🔄 In Progress  
**Files**: `PaymentModal.tsx`  
**Lines**: 73-75, 368-382  
**What**: Show optimal bill/coin breakdown for change

### Fix 2: Validate Discount <= Total
**Status**: 📋 Pending  
**Files**: `DiscountModal.tsx`  
**Lines**: 18-35  
**What**: Block discounts exceeding order total

### Fix 3: Allergen Detection in KDS
**Status**: 📋 Pending  
**Files**: `KDSTicket.tsx`  
**Lines**: 143-200  
**What**: Highlight allergens in RED on kitchen tickets

### Fix 4: Auto-prioritize Station Queue
**Status**: 📋 Pending  
**Files**: `cocina/page.tsx`  
**Lines**: 59-72  
**What**: Sort orders by priority + age automatically

### Fix 5: Alert Ready Items Not Picked Up
**Status**: 📋 Pending  
**Files**: `KDSTicket.tsx`  
**Lines**: 110-117  
**What**: Warning after 3 minutes in READY status

### Fix 6: Block Expired Lots on Receive
**Status**: 📋 Pending  
**Files**: `EntryModal.tsx`  
**Lines**: 102-150  
**What**: Block receiving expired products, warn < 3 days

### Fix 7: Warning at Stock 0
**Status**: 📋 Pending  
**Files**: `StockView.tsx`  
**Lines**: 474-486  
**What**: Alert when stock reaches zero

### Fix 8: Force FEFO
**Status**: 📋 Pending  
**Files**: `EntryModal.tsx`  
**Lines**: 183-253  
**What**: Show "USE OLDEST LOT FIRST" guidance

### Fix 9: Quick Waste Button
**Status**: 📋 Pending  
**Files**: `inventario/page.tsx`  
**Lines**: 260-279  
**What**: 1-click waste recording

### Fix 10: Lock Item During Count
**Status**: 📋 Pending  
**Files**: Inventory count component  
**Lines**: TBD  
**What**: Prevent concurrent adjustments

---

## Week 2: Advanced Fixes (Medium Impact, Medium Complexity)

### Fix 11-21: Remaining fixes
(To be planned after Week 1 completion)

---

## Progress Tracking

| Week | Fixes | Status |
|------|-------|--------|
| 1 | 1-10 | 🔄 0/10 |
| 2 | 11-21 | 📋 0/11 |
| **TOTAL** | **21** | **0/21** |
