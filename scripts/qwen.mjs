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

const SYSTEM =
  'Eres un programador TypeScript senior, estricto. Devuelves SOLO el código pedido: ' +
  'tipado fuerte, sin any, sin explicaciones. Sigue las convenciones de park-pos: ' +
  'dinero SIEMPRE en centavos (integer), español en comentarios, inglés en código. ' +
  'Si la spec es ambigua, asume la opción más simple y segura.';

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
