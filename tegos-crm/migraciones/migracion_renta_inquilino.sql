-- Historial de renta por inquilino (YA EJECUTADA en Supabase el 2026-06-12)
CREATE TABLE IF NOT EXISTS renta_inquilino (
  id serial PRIMARY KEY,
  inquilino_id integer REFERENCES inquilinos(id) ON DELETE CASCADE,
  fecha date,
  importe numeric,
  observaciones text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE renta_inquilino ENABLE ROW LEVEL SECURITY;
CREATE POLICY acceso_total_v2 ON renta_inquilino FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
