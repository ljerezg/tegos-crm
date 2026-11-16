# Tegos CRM, versión sin Supabase (datos en Dropbox)

Es la misma aplicación, con las mismas pantallas. Lo único que cambia es dónde se guardan los datos:

- **Datos:** un fichero JSON por tabla en `Dropbox/Tegos CRM/datos/`.
- **Documentos y adjuntos de correo:** `Dropbox/Tegos CRM/archivos/`.
- **Entrada:** cada persona entra con su propia cuenta de Dropbox. La carpeta `Tegos CRM` se comparte con quien tenga que usar el CRM.
- **Tareas automáticas:** el sondeo de correos y el informe del día 1 se ejecutan en GitHub Actions (gratis, porque el repositorio es público).

Supabase sigue funcionando mientras tanto. Las dos versiones pueden convivir.

## 1. Crear la app de Dropbox (una sola vez)

1. Entra en https://www.dropbox.com/developers/apps y pulsa **Create app**.
2. Elige **Scoped access**, luego **Full Dropbox**, y ponle de nombre, por ejemplo, `Tegos CRM Luis`.
3. En la pestaña **Permissions**, marca estos permisos y pulsa **Submit**:
   - `account_info.read`
   - `files.metadata.read` y `files.metadata.write`
   - `files.content.read` y `files.content.write`
   - `sharing.read` y `sharing.write`
4. En la pestaña **Settings**:
   - En **OAuth 2 → Redirect URIs**, añade la dirección de la web nueva con `/` al final (por ejemplo `https://tegos-crm-dropbox.vercel.app/`). Si vas a probar en local, añade también `http://localhost:5173/`.
   - En **Allow public clients (Implicit Grant & PKCE)**, elige **Allow**.
   - Pulsa **Enable additional users**. Si no lo haces, solo podrás entrar tú y Carmen y Lorena no tendrán acceso.
   - Copia el **App key**. El *App secret* no hace falta.

## 2. Publicar la web en Vercel (un proyecto nuevo, sin tocar el actual)

1. En Vercel, pulsa **Add New → Project** e importa el mismo repositorio `ljerezg/tegos-crm`.
2. En **Root Directory**, pon `tegos-crm-dropbox`.
3. En **Environment Variables**, añade `VITE_DROPBOX_APP_KEY` con el App key que has copiado.
4. Pulsa **Deploy**. Cuando termine, comprueba que la dirección que te da Vercel está en las Redirect URIs de Dropbox (punto 1.4).

## 3. Primera entrada e importación

1. Abre la web nueva, pulsa **Entrar con Dropbox** y autoriza.
2. La primera vez te dirá que no encuentra la carpeta. Pulsa **Crear carpeta**.
3. En el menú, entra en **Importar de Supabase**. Escribe el usuario y la contraseña del CRM antiguo y pulsa **Importar ahora**.
   - Se copian todas las tablas.
   - Dropbox descarga los documentos directamente desde Supabase (unos 1,8 GB). La primera vez tarda.
   - Se puede repetir mientras convivan las dos versiones. Cada importación **sustituye** los datos de la versión Dropbox por los de Supabase. Los documentos que ya estén en Dropbox no se vuelven a copiar.
4. En **Usuarios**, revisa el correo de Dropbox de cada persona. Para compartirle la carpeta, marca **Compartirle ahora la carpeta del CRM en Dropbox**. Le llegará una invitación por correo.

## 4. Tareas automáticas en GitHub

1. En **Importar de Supabase**, pulsa **Generar clave para GitHub**, autoriza en Dropbox y copia los dos valores que aparecen.
2. En GitHub, ve a **Settings → Secrets and variables → Actions** y crea estos secretos:
   - `DROPBOX_APP_KEY` y `DROPBOX_REFRESH_TOKEN`, con los valores del paso anterior.
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` y `SMTP_PASS`, con los mismos datos de acens que usa ahora la Edge Function de Supabase.
   - Los secretos `IMAP_*` ya existen y se reutilizan.
3. *(Opcional, mientras convivan las dos versiones)* En la pestaña **Variables**, crea `INFORME_ASUNTO_PREFIJO` con el valor `[Dropbox] `. Así distinguirás los dos informes del día 1.
4. Para probar, ve a **Actions → Informe mensual de acciones — Tegos CRM (Dropbox) → Run workflow**. Por defecto se envía marcado como [PRUEBA].

GitHub desactiva las tareas programadas de un repositorio público cuando pasan 60 días sin cambios en el código. Si ocurre, vuelve a activarlas en **Actions** o sube cualquier cambio.

## 5. Cuando todo esté comprobado

1. Haz una última importación desde Supabase.
2. Desde ese momento, trabaja solo en la versión Dropbox.
3. Desactiva el workflow `IMAP Poll — Tegos CRM` y la tarea programada de Supabase.
4. Quita `INFORME_ASUNTO_PREFIJO`.
5. Pausa o elimina el proyecto de Supabase y baja la organización al plan Free para dejar de pagar.

## Permisos y privacidad

Quien tenga la carpeta compartida puede abrir todos los ficheros en su Dropbox, aunque en el CRM solo vea lo suyo. Por eso solo se comparte con personas que puedan ver todos los datos. Si un propietario externo necesita acceso, hay que prepararle una carpeta aparte, solo con sus datos.
