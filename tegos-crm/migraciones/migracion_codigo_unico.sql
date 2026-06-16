-- Código de inmueble único, insensible a mayúsculas (YA EJECUTADA en Supabase el 2026-06-12)
CREATE UNIQUE INDEX IF NOT EXISTS inmuebles_codigo_unico ON inmuebles (lower(codigo));
