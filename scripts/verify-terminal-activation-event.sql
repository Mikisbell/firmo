-- Verificar eventos de activación de terminal
SELECT 
  type,
  entity_id,
  actor_id,
  actor_role_snapshot,
  payload,
  occurred_at
FROM events 
WHERE type = 'TERMINAL_ACTIVATED_SIMPLE'
ORDER BY occurred_at DESC 
LIMIT 5;
