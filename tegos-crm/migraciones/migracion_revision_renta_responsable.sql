-- Migración: responsable en avisos automáticos + aviso anual de Revisión de renta
-- Fecha: 2026-06-17
--
-- 1) Los avisos automáticos heredan el responsable del inquilino (responsable_id).
-- 2) Se genera un aviso "Revisión de renta" en cada aniversario del inicio de
--    devengo (o de la firma si no hay devengo), un aviso por año hasta el
--    vencimiento (años 1 .. duracion_contrato-1), solo si aviso_fin = true.

-- 1) Responsable en los avisos de vencimiento ya existentes
UPDATE accion_inquilino a
SET responsable_id = i.responsable_id
FROM inquilinos i
WHERE a.inquilino_id = i.id
  AND a.proxima_accion LIKE 'Vencimiento de contrato%';

-- 2) Regenerar avisos de Revisión de renta (idempotente)
DELETE FROM accion_inquilino WHERE proxima_accion LIKE 'Revisión de renta%';

INSERT INTO accion_inquilino (inquilino_id, fecha, proxima_fecha, proxima_accion, indicaciones, completada, responsable_id)
SELECT
  i.id,
  (COALESCE(i.fecha_inicio_devengo, i.fecha_contrato) + (g.y || ' years')::interval)::date,
  (COALESCE(i.fecha_inicio_devengo, i.fecha_contrato) + (g.y || ' years')::interval)::date,
  'Revisión de renta',
  'Aviso automático: revisión anual de renta',
  false,
  i.responsable_id
FROM inquilinos i
CROSS JOIN LATERAL generate_series(1, GREATEST(i.duracion_contrato - 1, 0)) AS g(y)
WHERE i.aviso_fin = true
  AND i.fecha_fin_contrato IS NULL
  AND i.fecha_contrato IS NOT NULL
  AND i.duracion_contrato IS NOT NULL;
