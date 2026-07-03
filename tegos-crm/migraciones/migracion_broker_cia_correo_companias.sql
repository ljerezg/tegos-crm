-- Campo Broker/Cía. en los contactos (a veces no se trabaja directamente
-- con la compañía, sino con un mediador/broker).
alter table persona_contacto add column if not exists broker_cia text;

-- Gestión de correo por compañía (Adm. Fincas y Seguros), igual que con
-- Inquilinos/Propietarios: la ficha empareja correos propios (Datos) y los
-- de cualquiera de sus Contactos asociados.
alter table correo add column if not exists administrador_finca_id integer references administrador_finca(id) on delete cascade;
alter table correo add column if not exists seguro_id integer references seguro(id) on delete cascade;
