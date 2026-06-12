-- Compañías de suministros como tablas maestras (YA EJECUTADA en Supabase el 2026-06-12)
CREATE TABLE IF NOT EXISTS cia_energia (id serial PRIMARY KEY, nombre text NOT NULL);
ALTER TABLE cia_energia ENABLE ROW LEVEL SECURITY;
CREATE POLICY acceso_total_v2 ON cia_energia FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
INSERT INTO cia_energia (nombre) VALUES ('Iberdrola'),('Fenosa'),('Endesa'),('Hola'),('No hay'),('Visalia');
CREATE TABLE IF NOT EXISTS cia_agua (id serial PRIMARY KEY, nombre text NOT NULL);
ALTER TABLE cia_agua ENABLE ROW LEVEL SECURITY;
CREATE POLICY acceso_total_v2 ON cia_agua FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
INSERT INTO cia_agua (nombre) VALUES ('Canal Isabel II'),('Acometida Comunidad'),('Otros'),('No hay');
