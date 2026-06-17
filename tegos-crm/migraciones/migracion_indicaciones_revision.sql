-- Migración: la indicación del aviso "Revisión de renta" incluye la fecha de la
-- última revisión y el importe actual de la renta (último registro de renta_inquilino).
-- Fecha: 2026-06-17

-- Inquilinos con historial de renta
UPDATE accion_inquilino a
SET indicaciones = 'Revisión anual de renta. Última revisión: '
  || COALESCE(to_char(lr.fecha, 'DD/MM/YYYY'), '—')
  || ' · Renta actual: '
  || COALESCE(replace(trim(to_char(lr.importe, 'FM999999990.00')), '.', ',') || ' €', '—')
FROM (
  SELECT DISTINCT ON (inquilino_id) inquilino_id, fecha, importe
  FROM renta_inquilino
  ORDER BY inquilino_id, fecha DESC
) lr
WHERE a.inquilino_id = lr.inquilino_id
  AND a.proxima_accion LIKE 'Revisión de renta%';

-- Inquilinos sin historial de renta
UPDATE accion_inquilino
SET indicaciones = 'Revisión anual de renta. Última revisión: — · Renta actual: —'
WHERE proxima_accion LIKE 'Revisión de renta%'
  AND inquilino_id NOT IN (SELECT DISTINCT inquilino_id FROM renta_inquilino);
