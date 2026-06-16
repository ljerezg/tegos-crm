-- Migración: aviso de fin de contrato controlado por tick (aviso_fin)
-- Fecha: 2026-06-16
--
-- Añade el campo booleano `aviso_fin` a inquilinos. Si está marcado (true),
-- al guardar el inquilino se genera automáticamente en accion_inquilino un
-- aviso de "Vencimiento de contrato" con fecha 5 meses antes del vencimiento.
-- Vencimiento = fecha_contrato (firma) + duracion_contrato años - 1 día.
-- Por defecto true; las plazas de garaje quedan en false (no generan aviso).
-- Las oficinas de Neptuno (locales B, C, D, E, G, H) son a 5 años con aviso.

ALTER TABLE inquilinos ADD COLUMN IF NOT EXISTS aviso_fin boolean DEFAULT true;

-- Plazas de garaje: sin aviso
UPDATE inquilinos i
SET aviso_fin = false
FROM inmuebles inm
JOIN tipo_inmueble ti ON ti.id = inm.tipo_inmueble_id
WHERE i.inmueble_id = inm.id AND ti.tipo = 'Plaza garaje';

-- Oficinas Neptuno (locales B, C, D, E, G, H): 5 años con aviso
UPDATE inquilinos i
SET duracion_contrato = 5, aviso_fin = true
FROM inmuebles inm
WHERE i.inmueble_id = inm.id
  AND inm.codigo IN ('NPTN57B','NPTN57C','NPTN57D','NPTN57E','NPTN59G','NPTN59H');

-- Regenerar avisos de vencimiento (borrar y recrear solo para aviso_fin=true)
DELETE FROM accion_inquilino WHERE proxima_accion LIKE 'Vencimiento de contrato%';

INSERT INTO accion_inquilino (inquilino_id, fecha, proxima_fecha, proxima_accion, indicaciones, completada)
SELECT
  i.id,
  to_char((i.fecha_contrato + (i.duracion_contrato || ' years')::interval - interval '1 day' - interval '5 months')::date, 'YYYY-MM-DD'),
  to_char((i.fecha_contrato + (i.duracion_contrato || ' years')::interval - interval '1 day' - interval '5 months')::date, 'YYYY-MM-DD'),
  'Vencimiento de contrato el ' || to_char((i.fecha_contrato + (i.duracion_contrato || ' years')::interval - interval '1 day')::date, 'DD/MM/YYYY'),
  'Aviso automático: el contrato vence en 5 meses',
  false
FROM inquilinos i
WHERE i.aviso_fin = true
  AND i.fecha_fin_contrato IS NULL
  AND i.fecha_contrato IS NOT NULL
  AND i.duracion_contrato IS NOT NULL;
