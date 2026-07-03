// .github/scripts/imap-poll.js
// Sondeo IMAP contra acens — inserta correos en Supabase directamente.
// Monitoriza INBOX (no leídos) + Sent (últimas 24h) de cada cuenta configurada.

'use strict';

const Imap = require('imap');
const { simpleParser } = require('mailparser');
const { createClient } = require('@supabase/supabase-js');

// ── Config ────────────────────────────────────────────────────────────────────
const IMAP_HOST = process.env.IMAP_HOST;
const IMAP_PORT = parseInt(process.env.IMAP_PORT || '993', 10);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Cuentas a monitorizar: info@tegos.es siempre; ljerezg@tegos.es si tiene credenciales
const ACCOUNTS = [
  { user: process.env.IMAP_USER,  password: process.env.IMAP_PASS  },
  { user: process.env.IMAP_USER2, password: process.env.IMAP_PASS2 },
].filter(a => a.user && a.password);

// Cuentas propias: ignorar al emparejar para que busquemos al interlocutor externo
const OWN_EMAILS = new Set([
  'info@tegos.es',
  'ljerezg@yahoo.es',
  'ljerezg@tegos.es',
]);

// Columnas de email por tabla
const TABLAS_EMAIL = {
  inquilinos:      ['email','email_2','email_conyuge','email_2_conyuge','email_inq2','email_2_inq2','email_inq3','email_2_inq3','email_otra_persona'],
  propietarios:    ['email','email_2','email_conyuge','email_2_conyuge','email_otra_persona'],
  persona_contacto:['email','email_2','email_conyuge','email_2_conyuge'],
  // Compañías: administradores de fincas y aseguradoras (correo propio, de la pestaña
  // Datos). El de sus Contactos casa por persona_contacto de arriba (administrador_finca_id
  // / seguro_id) y la ficha en la app junta ambos.
  administrador_finca: ['email','email_2'],
  seguro:               ['email','email_2'],
};

const TABLA_TIPO = { inquilinos:'inquilino', propietarios:'propietario', persona_contacto:'contacto', administrador_finca:'administrador_finca', seguro:'seguro' };
const FK_COL     = { inquilinos:'inquilino_id', propietarios:'propietario_id', persona_contacto:'contacto_id', administrador_finca:'administrador_finca_id', seguro:'seguro_id' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractAddresses(field) {
  if (!field) return [];
  const text = typeof field === 'string' ? field : (field.text || '');
  const matches = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
  return matches ? [...new Set(matches.map(e => e.toLowerCase()))] : [];
}

// Extrae todos los emails externos del cuerpo (cabeceras citadas en reenvíos)
function extractExternalAddressesFromBody(body) {
  if (!body) return [];
  // Busca patrones De/From/Para/To en cabeceras citadas del reenvío
  const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const HEADER_RE = /(?:De|From|Desde|Para|To|A|Cc|CC):\s*(.+)/gi;
  const found = new Set();
  let m;
  // 1. Emails en líneas de cabecera citada
  while ((m = HEADER_RE.exec(body)) !== null) {
    const line = m[1];
    let em;
    while ((em = EMAIL_RE.exec(line)) !== null) found.add(em[0].toLowerCase());
    EMAIL_RE.lastIndex = 0;
  }
  // 2. Si no encontramos nada, busca cualquier email en el cuerpo completo
  if (!found.size) {
    while ((m = EMAIL_RE.exec(body)) !== null) found.add(m[0].toLowerCase());
  }
  return [...found].filter(e => !OWN_EMAILS.has(e));
}

async function findEntitiesByEmails(emails) {
  const list = emails.map(e => e.toLowerCase().trim()).filter(Boolean);
  if (!list.length) return [];
  const results = [];

  for (const [tabla, cols] of Object.entries(TABLAS_EMAIL)) {
    const orFilter = cols.flatMap(col => list.map(email => `${col}.eq.${email}`)).join(',');
    const { data, error } = await supabase
      .from(tabla)
      .select(`id,${cols.join(',')}`)
      .or(orFilter);

    if (error) { console.error(`Error querying ${tabla}:`, error.message); continue; }
    if (!data) continue;

    for (const row of data) {
      for (const col of cols) {
        const val = row[col]?.toLowerCase().trim();
        if (val && list.includes(val)) {
          results.push({ tabla, id: row.id, tipo: TABLA_TIPO[tabla], fk: FK_COL[tabla] });
          break;
        }
      }
    }
  }
  return results;
}

async function uploadAttachment(attachment, tipo, entityId) {
  if (!attachment?.content) return null;
  const nombre = attachment.filename || 'adjunto';
  const path = `correo/${tipo}/${entityId}/${Date.now()}_${nombre}`;

  const { error } = await supabase.storage
    .from('documentos-tegos')
    .upload(path, attachment.content, {
      contentType: attachment.contentType || 'application/octet-stream',
      upsert: false,
    });

  if (error) { console.error('Error subiendo adjunto:', error.message); return null; }
  const { data } = supabase.storage.from('documentos-tegos').getPublicUrl(path);
  return { url: data.publicUrl, nombre };
}

// ── Procesado de un mensaje ───────────────────────────────────────────────────

async function processEmail(parsed) {
  const fromList = extractAddresses(parsed.from?.text || '');
  const toList   = extractAddresses(parsed.to?.text   || '');
  const ccList   = extractAddresses(parsed.cc?.text   || '');
  const body     = parsed.text || parsed.textAsHtml || '';
  const subject  = parsed.subject || '(sin asunto)';
  const fecha    = (parsed.date || new Date()).toISOString().slice(0, 10);
  const msgId    = parsed.messageId
    || `${fromList[0] || 'unknown'}|${subject}|${fecha}`;

  const externalFrom  = fromList.filter(e => !OWN_EMAILS.has(e));
  const externalOther = [...toList, ...ccList].filter(e => !OWN_EMAILS.has(e));

  const rows = [];
  const seen = new Set();

  const addRows = (matches, sentido) => {
    for (const m of matches) {
      const key = `${m.tabla}:${m.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ ...m, sentido, dedupeKey: `${msgId}|${m.tipo}:${m.id}` });
    }
  };

  // externo en From → nos escribió a nosotros → recibido
  if (externalFrom.length)  addRows(await findEntitiesByEmails(externalFrom),  'recibido');
  // externo en To/CC y From es nuestro → nosotros escribimos → enviado
  if (externalOther.length) addRows(await findEntitiesByEmails(externalOther), 'enviado');

  // Fallback: emails externos en el cuerpo (reenvíos internos entre cuentas propias)
  // Típicamente Luis reenvía a info@tegos.es un correo que recibió → recibido
  if (!rows.length) {
    const bodyEmails = extractExternalAddressesFromBody(body);
    if (bodyEmails.length) {
      addRows(await findEntitiesByEmails(bodyEmails), 'recibido');
    }
  }

  // Sin asignar
  if (!rows.length) {
    rows.push({ tipo: null, id: null, fk: null, sentido: 'recibido', dedupeKey: `${msgId}|none` });
  }

  const firstAttachment = parsed.attachments?.[0];

  for (const row of rows) {
    let archivoUrl = null, archivoNombre = null;
    if (firstAttachment && row.id && row.tipo) {
      const up = await uploadAttachment(firstAttachment, row.tipo, row.id);
      if (up) { archivoUrl = up.url; archivoNombre = up.nombre; }
    }

    const correoRow = {
      sentido:      row.sentido,
      fecha,
      asunto:       subject,
      cuerpo:       body.slice(0, 20000),
      remitente:    fromList[0] || '',
      destinatario: toList[0]  || '',
      message_id:   msgId,
      dedupe_key:   row.dedupeKey,
      archivo_url:  archivoUrl,
      archivo_nombre: archivoNombre,
      inquilino_id:   null,
      propietario_id: null,
      contacto_id:    null,
      administrador_finca_id: null,
      seguro_id:      null,
    };
    if (row.fk && row.id) correoRow[row.fk] = row.id;

    const { error } = await supabase
      .from('correo')
      .upsert(correoRow, { onConflict: 'dedupe_key', ignoreDuplicates: true });

    if (error) {
      console.error(`❌ Error insertando correo (${row.dedupeKey}):`, error.message);
    } else {
      console.log(`✓ ${row.sentido} | ${row.tipo || 'sin asignar'}:${row.id || '-'} | ${subject}`);
    }
  }
}

// ── IMAP helpers ──────────────────────────────────────────────────────────────

// Busca la carpeta Sent: primero por atributo \Sent, luego por nombre común
function findSentFolder(imap) {
  return new Promise((resolve) => {
    imap.getBoxes('', (err, boxes) => {
      if (err) return resolve(null);

      // Recolecta todos los nombres completos de carpetas
      const allFolders = [];
      const collect = (boxes, prefix) => {
        for (const [name, box] of Object.entries(boxes)) {
          const fullName = prefix ? `${prefix}${box.delimiter || '/'}${name}` : name;
          allFolders.push({ fullName, attribs: box.attribs || [] });
          if (box.children) collect(box.children, fullName);
        }
      };
      collect(boxes, '');
      console.log('Carpetas IMAP disponibles:', allFolders.map(f => f.fullName).join(', '));

      // 1. Buscar por atributo estándar \Sent
      const byAttr = allFolders.find(f => f.attribs.map(a => a.toLowerCase()).includes('\\sent'));
      if (byAttr) return resolve(byAttr.fullName);

      // 2. Fallback: nombres comunes de carpeta Sent
      const SENT_NAMES = ['Sent', 'Sent Messages', 'Sent Items', 'Enviados', 'INBOX.Sent', 'INBOX/Sent'];
      for (const candidate of SENT_NAMES) {
        const match = allFolders.find(f => f.fullName.toLowerCase() === candidate.toLowerCase());
        if (match) { console.log(`Carpeta Sent encontrada por nombre: ${match.fullName}`); return resolve(match.fullName); }
      }

      resolve(null);
    });
  });
}

// Sondea un buzón concreto
function pollBox(imap, boxName, searchCriteria, markSeen) {
  return new Promise((resolve) => {
    imap.openBox(boxName, false, (err) => {
      if (err) {
        console.log(`Buzón "${boxName}" no encontrado, omitiendo.`);
        return resolve();
      }

      imap.search(searchCriteria, (err, uids) => {
        if (err) { console.error(`Error buscando en ${boxName}:`, err.message); return resolve(); }
        if (!uids || !uids.length) {
          console.log(`${boxName}: sin mensajes nuevos.`);
          return resolve();
        }

        console.log(`📬 ${boxName}: ${uids.length} mensaje(s).`);
        const fetcher = imap.fetch(uids, { bodies: '', markSeen });
        const pending = [];

        fetcher.on('message', (msg) => {
          const p = new Promise((res) => {
            msg.on('body', (stream) => {
              simpleParser(stream, async (parseErr, parsed) => {
                if (parseErr) { console.error('Error parseando:', parseErr.message); return res(); }
                try { await processEmail(parsed); }
                catch (e) { console.error('Error procesando:', e.message); }
                res();
              });
            });
          });
          pending.push(p);
        });

        fetcher.once('error', () => resolve());
        fetcher.once('end', async () => { await Promise.all(pending); resolve(); });
      });
    });
  });
}

// Conecta a una cuenta IMAP y sondea INBOX + Sent
function runImapAccount(user, password) {
  return new Promise((resolve) => {
    const imap = new Imap({
      user, password,
      host: IMAP_HOST,
      port: IMAP_PORT,
      tls:  true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 15000,
      authTimeout: 10000,
    });

    imap.once('error', (e) => {
      console.error(`Error IMAP (${user}):`, e.message);
      resolve();
    });

    imap.once('ready', async () => {
      // 1. INBOX — últimos 2 días (dedupe_key evita duplicados; cubre correos ya leídos)
      const sinceInbox = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      await pollBox(imap, 'INBOX', [['SINCE', sinceInbox]], false);

      // 2. Sent — correos de los últimos 7 días (deduplicación vía dedupe_key en Supabase)
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const sentFolder = await findSentFolder(imap);
      if (sentFolder) {
        await pollBox(imap, sentFolder, [['SINCE', since]], false);
      } else {
        console.log(`(${user}) No se encontró carpeta Sent.`);
      }

      imap.end();
      resolve();
    });

    imap.connect();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const required = ['IMAP_HOST','IMAP_USER','IMAP_PASS','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
  const missing  = required.filter(k => !process.env[k]);
  if (missing.length) {
    console.error('Faltan variables de entorno:', missing.join(', '));
    process.exit(1);
  }

  for (const { user, password } of ACCOUNTS) {
    console.log(`\n=== Cuenta: ${user} ===`);
    await runImapAccount(user, password);
  }
})().catch(e => { console.error(e); process.exit(1); });
