#!/usr/bin/env node
/**
 * Delegación a Qwen2.5-Coder local (LM Studio · localhost:1234).
 *
 * Flujo híbrido (táctica #6 de docs/TOKEN-DIET-PLAN.md):
 *   Claude orquesta y redacta la spec → Qwen ejecuta lo mecánico (local, $0, ~8s) → Claude revisa.
 *
 * Uso:
 *   node scripts/qwen.mjs "tu spec precisa aquí"
 *   echo "spec" | node scripts/qwen.mjs
 *
 * Env opcionales:
 *   LMSTUDIO_URL    (default http://localhost:1234/v1/chat/completions)
 *   LMSTUDIO_MODEL  (default qwen2.5-coder-7b-instruct)
 */
const API = process.env.LMSTUDIO_URL || 'http://localhost:1234/v1/chat/completions';
const MODEL = process.env.LMSTUDIO_MODEL || 'qwen2.5-coder-7b-instruct';

const argPrompt = process.argv.slice(2).join(' ').trim();
const prompt = argPrompt || await new Promise((res) => {
  let d = '';
  process.stdin.on('data', (c) => (d += c));
  process.stdin.on('end', () => res(d.trim()));
});

if (!prompt) {
  console.error('Uso: node scripts/qwen.mjs "spec"   (o pasá la spec por stdin)');
  process.exit(1);
}

// Contexto de park-pos inyectado en CADA llamada (in-context learning): el modelo NO
// aprende entre sesiones, pero con estas reglas respeta las convenciones del sistema.
// NO reemplaza la revisión de Claude — el 7B no ve todos los edge cases.
const SYSTEM = [
  'Eres un programador TypeScript senior, estricto, para "park-pos": POS event-sourced,',
  'multi-tenant, offline-first (Next.js 16 / Prisma / PostgreSQL). Devuelves SOLO el código',
  'pedido (sin explicaciones, sin markdown salvo que se pida).',
  '',
  'REGLAS NO-NEGOCIABLES de park-pos:',
  '- Dinero SIEMPRE en centavos (integer), NUNCA float/decimal. Redondear con Math.round.',
  '- tenant_id SIEMPRE desde el parámetro/JWT del server, NUNCA del body/query del cliente.',
  '- El status VIVO de un item se lee de `order_item_projections` (proyección), NUNCA del',
  '  JSON `orders.items[]` (queda congelado en la creación — ADR-010).',
  '- Prisma: usar el singleton `import prisma from "@/src/core/db/prisma"`. Cleanup en tests',
  '  con `where: { tenant_id }`, NUNCA `deleteMany({})`.',
  '- Edge/Cloudflare: PROHIBIDO C++ bindings (usar bcryptjs/WebCrypto) y TCP sockets.',
  '- Reducers de event sourcing: retornan `{ state, warnings }`, NUNCA hacen throw.',
  '- Tipado fuerte, sin `any`. Comentarios en español, código en inglés.',
  'Si la spec es ambigua, asume la opción más simple y segura.',
].join('\n');

const t0 = Date.now();
const res = await fetch(API, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 1024,
  }),
}).catch((e) => {
  console.error(`ERROR conectando a LM Studio (${API}): ${e.message}`);
  console.error('¿Está el modelo cargado? → lms load qwen2.5-coder-7b-instruct --gpu max');
  process.exit(1);
});

const j = await res.json();
const out = j.choices?.[0]?.message?.content ?? '(sin respuesta del modelo)';
const dt = ((Date.now() - t0) / 1000).toFixed(1);

console.log(out);
console.error(`\n[qwen ${MODEL} · ${dt}s · ${j.usage?.total_tokens ?? '?'} tok · $0 · 0 tokens de Claude]`);
