# PLAN DE DIETA DE TOKENS — Workflow Claude Code (Belico)

> Objetivo: reducir el consumo de tokens sin cambiar cómo programamos, solo cómo
> gestionamos el contexto. Basado en investigación de prácticas 2026 (ver Engram
> obs #2240). Modo senior: priorizado por ROI, medible, con checklist.

## Diagnóstico (medido el 2026-06-29)

Baseline que se paga EN CADA TURNO (constante permanente, no se amortiza solo):

| Archivo | ~Tokens/turno | Estado |
|---|---|---|
| `~/.claude/CLAUDE.md` (global) | ~3.970 | 🔴 Gordo — protocolo Engram + SDD orchestrator inline |
| `park/CLAUDE.md` (proyecto) | ~2.673 | 🟡 Mezcla reglas duras (valiosas) + SDD pattern (movible) |
| `MEMORY.md` (auto-memoria) | ~2.043 | 🟡 Útil pero comprimible |
| `belico.md` (output-style) | ~1.500 | 🟢 Identidad — se queda |
| **TOTAL BASELINE** | **~10.200** | |

Costo oculto: en una sesión de ~100 turnos = ~1M tokens solo en repetir el baseline.

**Meta**: bajar el baseline de ~10.200 a **~4.500 tokens/turno** (−56%) sin perder
ninguna regla no-negociable (dinero en centavos, auth, edge, roles).

## Principio rector

> Lo que se necesita SIEMPRE → CLAUDE.md (se paga cada turno, que sea mínimo).
> Lo que se necesita A VECES → Skill (carga on-demand, $0 hasta que se invoca).
> Lo que es referencia/historial → Memoria Engram (se busca cuando hace falta).

Cada línea en CLAUDE.md debe ganarse su lugar. Si no se usa en >50% de las
sesiones, va a un skill.

## FASE 0 — Quick wins (HOY, 0 esfuerzo, aplicar ya)

- [ ] **Model tiering**: Sonnet por defecto (`/model sonnet`); subir a Opus solo
      para razonamiento profundo, arquitectura o bugs sutiles. Mecánico = Sonnet/Qwen.
- [ ] **`/clear` al cambiar de tema**: no arrastrar contexto viejo a un problema nuevo.
- [ ] **Sesiones cálidas**: el prompt-cache de Anthropic dura 5 min (90% off en
      cache reads). Trabajar en ráfagas continuas; evitar dejar la sesión fría.
- [ ] **`/context` al arrancar**: glance al % antes de cada tarea grande.

ROI: inmediato, sin tocar archivos. Solo disciplina.

## FASE 1 — Adelgazar el baseline (EL GOLPE GRANDE)

### 1.1 Global `~/.claude/CLAUDE.md` (~3.970) — ❌ DESCARTADO [decisión Belico 2026-06-29]
- [x] NO se toca: afecta TODOS los proyectos de Belico, no solo PARK. La dieta se
      limita a archivos PARK. Si en el futuro se quiere atacar, hacerlo aparte.

### 1.2 Proyecto `park/CLAUDE.md` (~2.673 → ✅ LOGRADO ~998, −62%) [2026-06-29]
- [x] **CONSERVADAS intactas** las Project Rules no-negociables: Dinero (centavos),
      Seguridad (tenant_id/JWT/auth), Edge (no C++ bindings), Database, Roles,
      Tests, Event Sourcing/ADR-010. Verificado 6/6 reglas clave presentes.
- [x] **MOVIDO a skill `sdd-orchestrator`** el bloque SDD Orchestrator +
      Command→Skill mapping + Sub-Agent Launching Pattern + Skills Registry.
- [x] **COMPRIMIDO** el Memory Protocol → referencia al skill `engram-recall`.
- RESULTADO: 220→68 lineas, ~2.673→~998 tok, −1.675 tok/turno. Mejor que meta (~1.500).

### 1.3 `MEMORY.md` (~2.043 → ✅ LOGRADO ~872, −57%) [2026-06-29]
- [x] Comprimido: métricas/SUNAT/módulos → líneas índice + referencia a Engram #116-126.
- [x] Conservados: Identidad, Estado Actual, Bugs Abiertos CRÍTICOS, Archivos Clave, gotchas.
- [x] Corregido dato stale: ingest canonical es `data-sync/ingest`, NO `events/ingest`.
- RESULTADO: 106→48 lineas, ~2.043→~872 tok, −1.171 tok/turno.

ROI Fase 1 (solo PARK): ~2.846 tok/turno recuperados (park/CLAUDE.md + MEMORY.md).

## FASE 2 — Delegación al Qwen local (✅ FLUJO MONTADO Y PROBADO) [2026-06-29]

- [x] **Contrato**: Qwen-Coder hace boilerplate, funciones puras, tests por patrón,
      refactors mecánicos, regex, conversiones. Claude hace arquitectura, diseño,
      bugs sutiles, **y SIEMPRE revisa el output del Qwen**.
- [x] **Helper**: `scripts/qwen.mjs` → delegar = `node scripts/qwen.mjs "spec"`.
      Llama a la API local (localhost:1234), $0, 0 tokens de Claude.
- [x] **Estrenado** con tarea real (formatSoles). LECCIÓN CLAVE: el Qwen-7B produjo
      código plausible pero CON BUG (confundió separador de miles/decimales). Claude
      lo cazó en review. Por eso el patrón es "Qwen ejecuta + Claude revisa", NUNCA
      "Qwen reemplaza a Claude". El 7B solo no es confiable para lógica sutil.
- [x] Setup: Qwen2.5-Coder-7B en VRAM, API localhost:1234.

ROI: cada tarea mecánica delegada = 0 tokens de Claude. Regla de oro: SIEMPRE revisar.

## FASE 3 — Disciplina de contexto (sostener el ahorro)

- [ ] **`/compact` a ~60%** de context, con instrucción explícita de qué preservar.
- [ ] **Subagents para "investigá X across codebase"**: aíslan la verborrea, vuelve
      solo el resumen (~9K vs ~15K tokens medidos).
- [ ] **Plan mode** antes de tareas multi-archivo: planear barato evita reescribir caro.
- [ ] Nunca usar el último 20% del context para tareas complejas.

## FASE 4 — Medición continua

- [ ] Re-medir el baseline tras Fase 1 (mismo comando del diagnóstico).
- [ ] Glance a `/context` al inicio de cada sesión.
- [ ] Objetivo de control: baseline < 4.500 tokens/turno sostenido.

## Orden de ataque recomendado

1. **Fase 0** (hoy, gratis) → 2. **Fase 1** (el golpe grande, ~5.700 tok) →
3. **Fase 2** (delegación, ya casi armada) → 4. **Fases 3-4** (sostener).

## Métrica de éxito

| | Antes | Meta | Logrado |
|---|---|---|---|
| Baseline tokens/turno | ~10.200 | ~7.340 | ✅ ~7.340 (−28%) |
| └ park/CLAUDE.md | ~2.673 | ~1.500 | ✅ ~998 (−62%) |
| └ MEMORY.md | ~2.043 | ~1.200 | ✅ ~872 (−57%) |
| └ global CLAUDE.md | ~3.970 | — | ❌ no se toca (solo PARK) |
| └ output-style belico.md | ~1.500 | — | se queda (identidad) |
| Tareas mecánicas en Qwen | 0% | 30-50% | _por medir_ |
| Modelo default | Opus | Sonnet | _por medir_ |
