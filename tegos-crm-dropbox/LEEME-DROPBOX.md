# Tegos CRM, versión sin Supabase (datos en Dropbox)

Es la misma aplicación, con las mismas pantallas. Lo único que cambia es dónde se guardan los datos:

- **Datos:** un fichero JSON por tabla en `Dropbox/Tegos CRM/datos/`.
- **Documentos y adjuntos de correo:** `Dropbox/Tegos CRM/archivos/`.
- **Entrada:** cada persona entra con su propia cuenta de Dropbox. La carpeta `Tegos CRM` se comparte con quien tenga que usar el CRM.
- **Tareas automáticas:** el sondeo de correos y el informe del día 1 se ejecutan en GitHub Actions (gratis, porque el repositorio es público).

Supabase sigue funcionando mientras tanto. Las dos versiones pueden convivir.

## 1. Crear la app de Dropbox (una sola vez)

La consola de desarrolladores de Dropbox puede salirte en español o en inglés. Por eso cada botón lleva primero su nombre en español y, entre paréntesis, el nombre en inglés.

1. Entra en https://www.dropbox.com/developers/apps con tu cuenta de Dropbox y pulsa **Crear app** (*Create app*).
2. Rellena las tres preguntas:
   - **Tipo de acceso:** *Acceso por ámbitos* (*Scoped access*).
   - **Acceso que necesita:** *Dropbox completo* (*Full Dropbox*). No elijas *Carpeta de la app* (*App folder*), porque esa no se puede compartir con Carmen y Lorena.
   - **Nombre:** por ejemplo `Tegos CRM Luis`. Tiene que ser único en todo Dropbox; si ya existe, añádele algo.
   - Pulsa **Crear app** (*Create app*).
3. Abre la pestaña **Permisos** (*Permissions*), marca estas casillas y pulsa **Enviar** (*Submit*), abajo del todo:
   - `account_info.read`
   - `files.metadata.read` y `files.metadata.write`
   - `files.content.read` y `files.content.write`
   - `sharing.read` y `sharing.write`

   Los nombres de los permisos están siempre en inglés.
4. Vuelve a la pestaña **Configuración** (*Settings*):
   - En el apartado **OAuth 2**, busca **URI de redirección** (*Redirect URIs*). Escribe la dirección de la web nueva con `/` al final y pulsa **Añadir** (*Add*). Por ejemplo, `https://tegos-crm-dropbox.vercel.app/`. Esa dirección la tendrás después del paso 2; puedes volver aquí a añadirla.
   - En **Permitir clientes públicos** (*Allow public clients (Implicit Grant & PKCE)*), elige **Permitir** (*Allow*).
   - Arriba, en **Estado** (*Status*: *Development*), pulsa **Habilitar usuarios adicionales** (*Enable additional users*). Si no lo haces, solo podrás entrar tú y Carmen y Lorena no tendrán acceso.
   - Copia la **Clave de la app** (*App key*). El *Secreto de la app* (*App secret*) no hace falta.

## 2. Publicar la web en Vercel (un proyecto nuevo, sin tocar el actual)

Vercel solo está en inglés.

1. Entra en https://vercel.com y pulsa **Add New…** y después **Project** (añadir proyecto).
2. Junto a `ljerezg/tegos-crm`, pulsa **Import** (importar). Es el mismo repositorio que ya usas.
3. En **Root Directory** (carpeta raíz), pulsa **Edit** (editar), elige `tegos-crm-dropbox` y pulsa **Continue**.
4. No hace falta añadir variables de entorno: la clave de la app (`whovvet6t39u1yp`) ya va escrita en el código.
5. Pulsa **Deploy** (publicar). Al terminar, Vercel te da la dirección de la web, por ejemplo `https://tegos-crm-dropbox.vercel.app`. Añádela con `/` al final en las URI de redirección de Dropbox (punto 1.4).

## 3. Primera entrada e importación

1. Abre la web nueva, pulsa **Entrar con Dropbox** y autoriza.
2. La primera vez te dirá que no encuentra la carpeta. Pulsa **Crear carpeta**.
3. En el menú, entra en **Importar de Supabase**. Escribe el usuario y la contraseña del CRM antiguo y pulsa **Importar ahora**.
   - Se copian todas las tablas.
   - Dropbox descarga los documentos directamente desde Supabase. Solo se copian los que usa el CRM (unos 60 documentos y los adjuntos de 154 correos). Los otros 7.000 ficheros que hay en Supabase son copias repetidas de adjuntos: el sondeo antiguo los volvía a subir cada 15 minutos. La versión nueva ya no lo hace.
   - Se puede repetir mientras convivan las dos versiones. Cada importación **sustituye** los datos de la versión Dropbox por los de Supabase. Los documentos que ya estén en Dropbox no se vuelven a copiar.
4. En **Usuarios**, revisa el correo de Dropbox de cada persona. Para compartirle la carpeta, marca **Compartirle ahora la carpeta del CRM en Dropbox**. Le llegará una invitación por correo.

## 4. Tareas automáticas en GitHub

GitHub solo está en inglés.

1. En la web nueva, entra en **Importar de Supabase** y pulsa **Generar clave para GitHub**. Autoriza en Dropbox y copia los dos valores que aparecen.
2. En GitHub, abre el repositorio `ljerezg/tegos-crm` y ve a **Settings** (configuración), luego **Secrets and variables** (secretos y variables) y luego **Actions**.
3. En la pestaña **Secrets**, pulsa **New repository secret** (nuevo secreto) una vez por cada uno. En **Name** va el nombre y en **Secret** el valor. Pulsa **Add secret** (añadir) cada vez.
   - `DROPBOX_REFRESH_TOKEN`: el valor del paso 1. `DROPBOX_APP_KEY` no hace falta, porque ya va en el código.
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` y `SMTP_PASS`: los datos del correo de acens con el que se envía el informe (info@tegos.es). Son los mismos que usa ahora la tarea de Supabase.
   - Los secretos `IMAP_*` ya existen y se reutilizan.
4. *(Opcional, mientras convivan las dos versiones)* En la pestaña **Variables**, pulsa **New repository variable** (nueva variable) y crea `INFORME_ASUNTO_PREFIJO` con el valor `[Dropbox] `. Así distinguirás los dos informes del día 1.
5. Para probar el informe, ve a la pestaña **Actions** del repositorio. Elige **Informe mensual de acciones — Tegos CRM (Dropbox)** y pulsa **Run workflow** (ejecutar). Por defecto se envía marcado como [PRUEBA].

GitHub desactiva las tareas programadas de un repositorio público cuando pasan 60 días sin cambios en el código. Si ocurre, vuelve a activarlas en **Actions** (botón **Enable workflow**) o sube cualquier cambio.

## 5. Cuando todo esté comprobado

1. Haz una última importación desde Supabase.
2. Desde ese momento, trabaja solo en la versión Dropbox.
3. Desactiva el workflow `IMAP Poll — Tegos CRM` y la tarea programada de Supabase.
4. Quita `INFORME_ASUNTO_PREFIJO`.
5. Pausa o elimina el proyecto de Supabase y baja la organización al plan Free para dejar de pagar.

## Permisos y privacidad

Quien tenga la carpeta compartida puede abrir todos los ficheros en su Dropbox, aunque en el CRM solo vea lo suyo. Por eso solo se comparte con personas que puedan ver todos los datos. Si un propietario externo necesita acceso, hay que prepararle una carpeta aparte, solo con sus datos.
