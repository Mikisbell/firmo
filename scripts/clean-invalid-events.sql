-- Limpiar eventos con product_id inválidos (no UUID)
DELETE FROM events 
WHERE payload::text LIKE '%"product_id":"p%';

-- También limpiar de event_outbox si existe
DELETE FROM event_outbox 
WHERE payload::text LIKE '%"product_id":"p%';

-- Limpiar processed_events relacionados
DELETE FROM processed_events 
WHERE event_id IN (
    SELECT event_id FROM events 
    WHERE payload::text LIKE '%"product_id":"p%'
);
