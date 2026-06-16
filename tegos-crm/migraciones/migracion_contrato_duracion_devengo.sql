-- Duración del contrato y fecha de inicio de devengo (YA EJECUTADA en Supabase el 2026-06-12)
ALTER TABLE inquilinos ADD COLUMN IF NOT EXISTS duracion_contrato integer DEFAULT 5;
ALTER TABLE inquilinos ADD COLUMN IF NOT EXISTS fecha_inicio_devengo date;
-- Duración inicial de inquilinos existentes según tipo de inmueble: Vivienda 5, Oficina 2, Plaza garaje 1
UPDATE inquilinos i SET duracion_contrato = CASE ti.tipo
  WHEN 'Oficina' THEN 2 WHEN 'Plaza garaje' THEN 1 ELSE 5 END
FROM inmuebles inm JOIN tipo_inmueble ti ON ti.id = inm.tipo_inmueble_id
WHERE i.inmueble_id = inm.id;
