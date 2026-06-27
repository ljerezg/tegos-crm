'use strict';

const Imap = require('imap');
const { simpleParser } = require('mailparser');
const { createClient } = require('@supabase/supabase-js');

const IMAP_HOST = process.env.IMAP_HOST;
const IMAP_PORT = parseInt(process.env.IMAP_PORT || '993', 10);
const IMAP_USER = process.env.IMAP_USER;
const IMAP_PASS = process.env.IMAP_PASS;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const OWN_EMAILS = new Set([
  'inquilinos@tegos.es',
  'ljerezg@yahoo.es',
  'ljerezg@tegos.es',
]);

const TABLAS_EMAIL = {
  inquilinos:      ['email','email_2','email_conyuge','email_2_conyuge','email_inq2','email_2_inq2','email_inq3','email_2_inq3','email_otra_persona'],
  propietarios:    ['email','email_2','email_conyuge','email_2_conyuge','email_otra_persona'],
  persona_contacto:['email','email_2','email_conyuge','email_2_conyuge'],
};

const TABLA_TIPO = { inquilinos:'inquilino', propietarios:'propietario', persona_contacto:'contacto' };
const FK_COL     = { inquilinos:'inquilino_id', propietarios:'propietario_id', persona_contacto:'contacto_id' };

function extractAddresses(field) {
  if (!field) return [];
  const text = typeof field === 'string' ? field : (field.text || '');
  const matches = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
  return matches ? [...new Set(matches.map(e => e.toLowerCase()))] : [];
}

function extractOriginalSenderFromBody(body) {
  if (!body) return null;
  const patterns = [
    /(?:De|From|Desde):\s*[^<\n]*<([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})>/i,
    /(?:De|From|Desde):\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,
  ];
  for (const p of patterns) {
    const m = body.match(p);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

async function findEntitiesByEmails(emails) {
  const list = emails.map(e => e.toLowerCase().trim()).filter(Boolean);
  if (!list.length) return [];
  const results = [];
  for (const [tabla, cols] of Object.entries(TABLAS_EMAIL)) {
    const orFilter = cols.flatMap(col => list.map(email => `${col}.eq.${email}`)).join(',');
    const { data, error } = await supabase.from(tabla).select(`id,${cols.join(',')}`).or(orFilter);
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
  const { error } = await supabase.storage.from('documentos-tegos').upload(path, attachment.content, {
    contentType: attachment.contentType || 'application/octet-stream', upsert: false,
  });
  if (error) { console.error('Error subiendo adjunto:', error.message); return null; }
  const { data } = supabase.storage.from('documentos-tegos').getPublicUrl(path);
  return { url: data.publicUrl, nombre };
}

async function processEmail(parsed) {
  const fromList = extractAddresses(parsed.from?.text || '');
  const toList   = extractAddresses(parsed.to?.text   || '');
  const ccList   = extractAddresses(parsed.cc?.text   || '');
  const body     = parsed.text || parsed.textAsHtml || '';
  const subject  = parsed.subject || '(sin asunto)';
  const fecha    = (parsed.date || new Date()).toISOString().slice(0, 10);
  const msgId    = parsed.messageId || `${fromList[0]||'unknown'}|${subject}|${fecha}`;
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
  if (externalFrom.length)  addRows(await findEntitiesByEmails(externalFrom),  'enviado');
  if (externalOther.length) addRows(await findEntitiesByEmails(externalOther), 'recibido');
  if (!rows.length) {
    const original = extractOriginalSenderFromBody(body);
    if (original && !OWN_EMAILS.has(original)) addRows(await findEntitiesByEmails([original]), 'enviado');
  }
  if (!rows.length) rows.push({ tipo:null, id:null, fk:null, sentido:'recibido', dedupeKey:`${msgId}|none` });
  const firstAttachment = parsed.attachments?.[0];
  for (const row of rows) {
    let archivoUrl = null, archivoNombre = null;
    if (firstAttachment && row.id && row.tipo) {
      const up = await uploadAttachment(firstAttachment, row.tipo, row.id);
      if (up) { archivoUrl = up.url; archivoNombre = up.nombre; }
    }
    const correoRow = {
      sentido: row.sentido, fecha, asunto: subject,
      cuerpo: body.slice(0, 20000),
      remitente: fromList[0] || '', destinatario: toList[0] || '',
      message_id: msgId, dedupe_key: row.dedupeKey,
      archivo_url: archivoUrl, archivo_nombre: archivoNombre,
      inquilino_id: null, propietario_id: null, contacto_id: null,
    };
    if (row.fk && row.id) correoRow[row.fk] = row.id;
    const { error } = await supabase.from('correo').upsert(correoRow, { onConflict: 'dedupe_key', ignoreDuplicates: true });
    if (error) console.error('Error insertando:', error.message);
    else console.log(`OK ${row.sentido} | ${row.tipo||'sin asignar'}:${row.id||'-'} | ${subject}`);
  }
}

function runImap() {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: IMAP_USER, password: IMAP_PASS, host: IMAP_HOST, port: IMAP_PORT,
      tls: true, tlsOptions: { rejectUnauthorized: false },
      connTimeout: 15000, authTimeout: 10000,
    });
    imap.once('error', reject);
    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) { imap.end(); return reject(err); }
        imap.search(['UNSEEN'], (err, uids) => {
          if (err) { imap.end(); return reject(err); }
          if (!uids || !uids.length) { console.log('Sin mensajes nuevos.'); imap.end(); return resolve(); }
          console.log(`${uids.length} mensaje(s) nuevos.`);
          const fetcher = imap.fetch(uids, { bodies: '', markSeen: true });
          const pending = [];
          fetcher.on('message', (msg) => {
            const p = new Promise((res) => {
              msg.on('body', (stream) => {
                simpleParser(stream, async (parseErr, parsed) => {
                  if (parseErr) { console.error('Parse error:', parseErr.message); return res(); }
                  try { await processEmail(parsed); } catch (e) { console.error('Error:', e.message); }
                  res();
                });
              });
            });
            pending.push(p);
          });
          fetcher.once('error', (e) => { imap.end(); reject(e); });
          fetcher.once('end', async () => { await Promise.all(pending); imap.end(); resolve(); });
        });
      });
    });
    imap.connect();
  });
}

(async () => {
  const required = ['IMAP_HOST','IMAP_USER','IMAP_PASS','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) { console.error('Faltan vars:', missing.join(', ')); process.exit(1); }
  await runImap();
})().catch(e => { console.error(e); process.exit(1); });
