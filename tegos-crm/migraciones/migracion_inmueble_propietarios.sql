-- Punto 6: múltiples propietarios por inmueble (YA EJECUTADA en Supabase el 2026-06-11)
-- La tabla guarda SOLO los propietarios ADICIONALES; el principal sigue en inmuebles.propietario_id
CREATE TABLE IF NOT EXISTS inmueble_propietarios (
  id serial PRIMARY KEY,
  inmueble_id integer NOT NULL REFERENCES inmuebles(id) ON DELETE CASCADE,
  propietario_id integer NOT NULL REFERENCES propietarios(id) ON DELETE CASCADE,
  UNIQUE(inmueble_id, propietario_id)
);
ALTER TABLE inmueble_propietarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY acceso_total_v2 ON inmueble_propietarios FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
-- Nota: la tabla ya existía con un volcado de los propietarios principales; se vació el 2026-06-11
