-- Punto 8: campo tipo_inmueble_id en inmuebles
-- Ejecutar en el SQL Editor de Supabase. Es idempotente: si la columna ya existe, no hace nada.
ALTER TABLE inmuebles
  ADD COLUMN IF NOT EXISTS tipo_inmueble_id bigint REFERENCES tipo_inmueble(id);
