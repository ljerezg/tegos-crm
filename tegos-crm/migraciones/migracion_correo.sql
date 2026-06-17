-- Migración: tabla `correo` para registrar correos enviados/recibidos
-- de inquilinos, propietarios y contactos. Fecha: 2026-06-17
--
-- Cada fila enlaza a UNA entidad (inquilino_id / propietario_id / contacto_id).
-- sentido: 'enviado' | 'recibido'. Adjunto opcional en bucket documentos-tegos.
-- Añadida a TABLAS_BACKUP en Configuracion.jsx.

create table if not exists correo (
  id serial primary key,
  inquilino_id integer references inquilinos(id) on delete cascade,
  propietario_id integer references propietarios(id) on delete cascade,
  contacto_id integer references persona_contacto(id) on delete cascade,
  sentido text not null default 'enviado',
  fecha date not null default current_date,
  asunto text,
  cuerpo text,
  archivo_url text,
  archivo_nombre text,
  created_at timestamptz default now()
);

alter table correo enable row level security;
create policy acceso_total_v2 on correo for all to anon, authenticated using (true) with check (true);
