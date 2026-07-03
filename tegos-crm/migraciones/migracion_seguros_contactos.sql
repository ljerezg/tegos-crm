-- Ampliar la tabla "seguro" (compañías de seguros) a una ficha completa,
-- igual que la de administrador_finca. Renombramos las columnas antiguas
-- para que coincidan con el resto de fichas (se conservan los datos).
alter table seguro rename column telefono_1 to telefono;
alter table seguro rename column telefono_2 to movil;
alter table seguro rename column correo_1 to email;
alter table seguro rename column correo_2 to email_2;

alter table seguro add column if not exists calle text;
alter table seguro add column if not exists numero text;
alter table seguro add column if not exists piso text;
alter table seguro add column if not exists municipio text;
alter table seguro add column if not exists provincia text;
alter table seguro add column if not exists cod_postal text;
alter table seguro add column if not exists fecha_baja date;
-- "observaciones" ya existía en la tabla, no hace falta añadirla.

-- El antiguo campo de texto libre "seguro.persona_contacto" deja de usarse
-- (los contactos ahora se gestionan en la pestaña "Contactos", ligados a
-- persona_contacto.seguro_id). Se mantiene sin borrar para no perder datos.

-- Contactos de administradores de fincas y aseguradoras: añadimos el cargo
-- y el enlace a la ficha de seguro (ya existía administrador_finca_id).
alter table persona_contacto add column if not exists cargo text;
alter table persona_contacto add column if not exists seguro_id integer references seguro(id) on delete cascade;
