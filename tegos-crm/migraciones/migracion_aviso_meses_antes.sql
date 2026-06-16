-- Migración: meses de antelación configurable para el aviso de fin de contrato
-- Fecha: 2026-06-16
--
-- Añade `aviso_meses_antes` (entero, por defecto 5). Cuando aviso_fin = true,
-- el aviso de "Vencimiento de contrato" se genera ese número de meses antes
-- del vencimiento (vencimiento = fecha_contrato + duracion_contrato años - 1 día).

ALTER TABLE inquilinos ADD COLUMN IF NOT EXISTS aviso_meses_antes integer DEFAULT 5;
UPDATE inquilinos SET aviso_meses_antes = 5 WHERE aviso_meses_antes IS NULL;

-- Regenerar avisos usando los meses configurados por inquilino
DELETE FROM accion_inquilino WHERE proxima_accion LIKE 'Vencimiento de contrato%';

INSERT INTO accion_inquilino (inquilino_id, fecha, proxima_fecha, proxima_accion, indicaciones, completada)
SELECT
  i.id,
  to_char((i.fecha_contrato + (i.duracion_contrato || ' years')::interval - interval '1 day' - (COALESCE(i.aviso_meses_antes,5) || ' months')::interval)::date, 'YYYY-MM-DD'),
  to_char((i.fecha_contrato + (i.duracion_contrato || ' years')::interval - interval '1 day' - (COALESCE(i.aviso_meses_antes,5) || ' months')::interval)::date, 'YYYY-MM-DD'),
  'Vencimiento de contrato el ' || to_char((i.fecha_contrato + (i.duracion_contrato || ' years')::interval - interval '1 day')::date, 'DD/MM/YYYY'),
  'Aviso automático: el contrato vence en ' || COALESCE(i.aviso_meses_antes,5) || ' meses',
  false
FROM inquilinos i
WHERE i.aviso_fin = true
  AND i.fecha_fin_contrato IS NULL
  AND i.fecha_contrato IS NOT NULL
  AND i.duracion_contrato IS NOT NULL;
