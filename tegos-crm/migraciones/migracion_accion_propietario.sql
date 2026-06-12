-- Acciones para Propietarios (YA EJECUTADA en Supabase el 2026-06-12)
CREATE TABLE IF NOT EXISTS accion_propietario (
  id serial PRIMARY KEY,
  propietario_id integer REFERENCES propietarios(id) ON DELETE CASCADE,
  tipo_contacto_id integer REFERENCES tipo_contacto(id),
  responsable_id integer REFERENCES responsable(id),
  fecha date,
  hora time,
  indicaciones text,
  proxima_fecha date,
  proxima_accion text,
  documento text,
  created_at timestamp with time zone DEFAULT now(),
  completada boolean DEFAULT false
);
ALTER TABLE accion_propietario ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_total ON accion_propietario FOR ALL TO authenticated USING (true) WITH CHECK (true);
