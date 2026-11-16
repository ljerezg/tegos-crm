// Esquema de las tablas del CRM (copiado de la base de datos de Supabase).
// Sirve para rellenar valores por defecto, convertir tipos y resolver relaciones.

const COLS = {
  accion_inmueble: "id=seq|inmueble_id|tipo_contacto_id|responsable_id|fecha|hora|indicaciones|proxima_fecha|proxima_accion|documento|created_at=now()|completada=false",
  accion_inquilino: "id=seq|inquilino_id|tipo_contacto_id|responsable_id|fecha|hora|indicaciones|proxima_fecha|proxima_accion|documento|created_at=now()|completada=false",
  accion_persona_contacto: "id=seq|persona_id|tipo_contacto_id|responsable_id|fecha|hora|indicaciones|proxima_fecha|proxima_accion|documento|created_at=now()|completada=false",
  accion_propietario: "id=seq|propietario_id|tipo_contacto_id|responsable_id|fecha|hora|indicaciones|proxima_fecha|proxima_accion|documento|created_at=now()|completada=false",
  administrador_finca: "id=seq|nombre|calle|numero|piso|municipio|provincia|cod_postal|telefono|movil|email|email_2|observaciones|created_at=now()|fecha_baja",
  cia_agua: "id=seq|nombre",
  cia_energia: "id=seq|nombre",
  clasificacion_contacto: "id=seq|clasificacion",
  conocimiento: "id=seq|origen",
  correo: "id=seq|inquilino_id|propietario_id|contacto_id|sentido='enviado'|fecha=CURRENT_DATE|asunto|cuerpo|archivo_url|archivo_nombre|created_at=now()|message_id|remitente|destinatario|dedupe_key|administrador_finca_id|seguro_id",
  documento: "id=seq|entidad_tipo|entidad_id|nombre|url_archivo|tamano|created_at=now()|tipo_documento",
  inmueble_propietarios: "id=seq|inmueble_id|propietario_id|orden=1|porcentaje",
  inmuebles: "id=seq|codigo|calle|numero_calle|piso|poblacion|provincia|codigo_postal|propietario_id|registro|num_finca_registral_vivienda|num_catastro_vivienda|cru_vivienda|num_garaje_1|num_garaje_2|num_trastero|num_finca_registral_plaza_1|num_finca_registral_plaza_2|num_catastro_plaza_1|num_catastro_plaza_2|cru_plaza_1|cru_plaza_2|fecha_compra|escritura_compra|seguro_id|num_poliza_seg_hogar|administrador_finca|cia_electrica|num_contrato_electricidad|cups_electricidad|titular_contrato_electricidad|cia_gas|num_contrato_gas|cups_gas|titular_contrato_gas|cia_agua|num_contrato_agua|titular_contrato_agua|carpeta_dropbox|observaciones|created_at=now()|administrador_finca_id|fecha_baja|cru|tipo_inmueble_id|en_comercializacion=false",
  inmuebles_comercializando: "id=seq|descripcion|calle|numero_calle|piso|poblacion|provincia|codigo_postal|registro|num_finca_registral|num_catastro|propietario|fecha_compra|cia_seguro|administrador_finca|escritura_compra|seguro_id|num_poliza_seg_hogar|carpeta_dropbox|num_garaje_1|num_garaje_2|num_trastero|created_at=now()",
  inquilinos: "id=seq|nombre|apellidos|dni_cif|tipo_id|responsable_id|telefono|movil|email|email_2|fecha_nacimiento|observaciones|nombre_conyuge|apellidos_conyuge|dni_conyuge|fecha_nac_conyuge|movil_conyuge|email_conyuge|otra_persona_contacto|movil_otra_persona|email_otra_persona|relacion_otra_persona|inmueble_id|fecha_contrato|fecha_fin_contrato|mes_contrato|contrato_doc|carpeta_dropbox|importe_fianza_ivima|importe_deposito|fianza_ivima_doc|seguro_rentas_id|num_poliza_seg_rentas|fecha_seguro_rentas|created_at=now()|fianza_ivima_url|contrato_url|telefono_2|telefono_2_conyuge|email_2_conyuge|nombre_inq2|apellidos_inq2|dni_inq2|tipo_inq2_id|relacion_inq2|telefono_inq2|telefono_2_inq2|movil_inq2|email_inq2|email_2_inq2|nombre_inq3|apellidos_inq3|dni_inq3|tipo_inq3_id|relacion_inq3|telefono_inq3|telefono_2_inq3|movil_inq3|email_inq3|email_2_inq3|duracion_contrato=5|fecha_inicio_devengo|aviso_fin=true|aviso_meses_antes=5|fecha_baja",
  // email_dropbox es nuevo: el correo de la cuenta de Dropbox con la que entra cada usuario
  perfil_usuario: "id=uuid|email|nombre|rol|propietario_id|activo=true|created_at=now()|email_dropbox",
  persona_contacto: "id=seq|nombre|apellidos|dni_cif|fecha_nacimiento|calle|numero|piso|municipio|provincia|cod_postal|telefono|movil|email|email_2|observaciones|tipo_id|responsable_id|empresa_tasacion|edad_estimada|estado_civil|conocimiento_id|referenciado_por|clasificacion_id|inmueble_interesado_id|nombre_conyuge|apellidos_conyuge|dni_conyuge|fecha_nac_conyuge|edad_estimada_conyuge|movil_conyuge|email_conyuge|otra_persona_contacto|movil_otra_persona|email_otra_persona|relacion_otra_persona|created_at=now()|administrador_finca_id|telefono_2|telefono_2_conyuge|email_2_conyuge|fecha_baja|cargo|seguro_id|broker_cia",
  propietarios: "id=seq|nombre|apellidos|dni_cif|tipo_id|responsable_id|telefono|movil|email|email_2|fecha_nacimiento|calle|numero|piso|municipio|provincia|cod_postal|observaciones|nombre_conyuge|apellidos_conyuge|dni_conyuge|fecha_nac_conyuge|movil_conyuge|email_conyuge|otra_persona_contacto|movil_otra_persona|email_otra_persona|relacion_otra_persona|prop_final|created_at=now()|telefono_2|telefono_2_conyuge|email_2_conyuge|fecha_baja",
  renta_inquilino: "id=seq|inquilino_id|fecha|importe|observaciones|created_at=now()",
  responsable: "id=seq|nombre_responsable",
  seguro: "id=seq|compania|persona_contacto|telefono|movil|email|email_2|observaciones|calle|numero|piso|municipio|provincia|cod_postal|fecha_baja",
  tipo_contacto: "id=seq|tipo_contacto",
  tipo_documento: "id=seq|nombre",
  tipo_inmueble: "id=seq|tipo",
  tipo_persona: "id=seq|tipo",
  usuario_inmuebles: "id=seq|usuario_id|inmueble_id",
}

// [restricción, tabla, columna, tabla referenciada]
export const FKS = [
  ['renta_inquilino_inquilino_id_fkey', 'renta_inquilino', 'inquilino_id', 'inquilinos'],
  ['inmuebles_comercializando_seguro_id_fkey', 'inmuebles_comercializando', 'seguro_id', 'seguro'],
  ['accion_persona_contacto_persona_id_fkey', 'accion_persona_contacto', 'persona_id', 'persona_contacto'],
  ['accion_persona_contacto_responsable_id_fkey', 'accion_persona_contacto', 'responsable_id', 'responsable'],
  ['accion_persona_contacto_tipo_contacto_id_fkey', 'accion_persona_contacto', 'tipo_contacto_id', 'tipo_contacto'],
  ['inmuebles_administrador_finca_id_fkey', 'inmuebles', 'administrador_finca_id', 'administrador_finca'],
  ['inmuebles_propietario_id_fkey', 'inmuebles', 'propietario_id', 'propietarios'],
  ['inmuebles_seguro_id_fkey', 'inmuebles', 'seguro_id', 'seguro'],
  ['inmuebles_tipo_inmueble_id_fkey', 'inmuebles', 'tipo_inmueble_id', 'tipo_inmueble'],
  ['propietarios_responsable_id_fkey', 'propietarios', 'responsable_id', 'responsable'],
  ['propietarios_tipo_id_fkey', 'propietarios', 'tipo_id', 'tipo_persona'],
  ['accion_inmueble_inmueble_id_fkey', 'accion_inmueble', 'inmueble_id', 'inmuebles'],
  ['accion_inmueble_responsable_id_fkey', 'accion_inmueble', 'responsable_id', 'responsable'],
  ['accion_inmueble_tipo_contacto_id_fkey', 'accion_inmueble', 'tipo_contacto_id', 'tipo_contacto'],
  ['accion_inquilino_inquilino_id_fkey', 'accion_inquilino', 'inquilino_id', 'inquilinos'],
  ['accion_inquilino_responsable_id_fkey', 'accion_inquilino', 'responsable_id', 'responsable'],
  ['accion_inquilino_tipo_contacto_id_fkey', 'accion_inquilino', 'tipo_contacto_id', 'tipo_contacto'],
  ['correo_administrador_finca_id_fkey', 'correo', 'administrador_finca_id', 'administrador_finca'],
  ['correo_contacto_id_fkey', 'correo', 'contacto_id', 'persona_contacto'],
  ['correo_inquilino_id_fkey', 'correo', 'inquilino_id', 'inquilinos'],
  ['correo_propietario_id_fkey', 'correo', 'propietario_id', 'propietarios'],
  ['correo_seguro_id_fkey', 'correo', 'seguro_id', 'seguro'],
  ['inmueble_propietarios_inmueble_id_fkey', 'inmueble_propietarios', 'inmueble_id', 'inmuebles'],
  ['inmueble_propietarios_propietario_id_fkey', 'inmueble_propietarios', 'propietario_id', 'propietarios'],
  ['perfil_usuario_propietario_id_fkey', 'perfil_usuario', 'propietario_id', 'propietarios'],
  ['usuario_inmuebles_inmueble_id_fkey', 'usuario_inmuebles', 'inmueble_id', 'inmuebles'],
  ['usuario_inmuebles_usuario_id_fkey', 'usuario_inmuebles', 'usuario_id', 'perfil_usuario'],
  ['inquilinos_inmueble_id_fkey', 'inquilinos', 'inmueble_id', 'inmuebles'],
  ['inquilinos_responsable_id_fkey', 'inquilinos', 'responsable_id', 'responsable'],
  ['inquilinos_seguro_rentas_id_fkey', 'inquilinos', 'seguro_rentas_id', 'seguro'],
  ['inquilinos_tipo_id_fkey', 'inquilinos', 'tipo_id', 'tipo_persona'],
  ['inquilinos_tipo_inq2_id_fkey', 'inquilinos', 'tipo_inq2_id', 'tipo_persona'],
  ['inquilinos_tipo_inq3_id_fkey', 'inquilinos', 'tipo_inq3_id', 'tipo_persona'],
  ['accion_propietario_propietario_id_fkey', 'accion_propietario', 'propietario_id', 'propietarios'],
  ['accion_propietario_responsable_id_fkey', 'accion_propietario', 'responsable_id', 'responsable'],
  ['accion_propietario_tipo_contacto_id_fkey', 'accion_propietario', 'tipo_contacto_id', 'tipo_contacto'],
  ['persona_contacto_administrador_finca_id_fkey', 'persona_contacto', 'administrador_finca_id', 'administrador_finca'],
  ['persona_contacto_clasificacion_id_fkey', 'persona_contacto', 'clasificacion_id', 'clasificacion_contacto'],
  ['persona_contacto_conocimiento_id_fkey', 'persona_contacto', 'conocimiento_id', 'conocimiento'],
  ['persona_contacto_inmueble_interesado_id_fkey', 'persona_contacto', 'inmueble_interesado_id', 'inmuebles'],
  ['persona_contacto_responsable_id_fkey', 'persona_contacto', 'responsable_id', 'responsable'],
  ['persona_contacto_seguro_id_fkey', 'persona_contacto', 'seguro_id', 'seguro'],
  ['persona_contacto_tipo_id_fkey', 'persona_contacto', 'tipo_id', 'tipo_persona'],
]

// Restricciones de unicidad que usan los upsert
export const UNIQUE = { correo: ['dedupe_key'] }

const INT = new Set(['orden', 'mes_contrato', 'duracion_contrato', 'aviso_meses_antes', 'entidad_id'])
const NUM = new Set(['porcentaje', 'importe', 'importe_fianza_ivima', 'importe_deposito'])
const BOOL = new Set(['completada', 'en_comercializacion', 'aviso_fin', 'activo'])
const DATE = new Set(['fecha', 'proxima_fecha', 'fecha_baja', 'fecha_nacimiento', 'fecha_nac_conyuge', 'fecha_contrato',
  'fecha_fin_contrato', 'fecha_seguro_rentas', 'fecha_inicio_devengo'])

function tipoColumna(tabla, col, def) {
  if (def === 'uuid' || col === 'usuario_id') return 'uuid'
  if (col === 'id' || col.endsWith('_id') || INT.has(col)) return 'int'
  if (NUM.has(col)) return 'num'
  if (BOOL.has(col)) return 'bool'
  if (DATE.has(col)) return 'date'
  if (col === 'created_at') return 'ts'
  return 'text'
}

export const TABLAS = {}
for (const [tabla, spec] of Object.entries(COLS)) {
  const cols = {}
  for (const parte of spec.split('|')) {
    const [col, def] = parte.split('=')
    cols[col] = { tipo: tipoColumna(tabla, col, def), def: def ?? null }
  }
  TABLAS[tabla] = cols
}
export const NOMBRES_TABLAS = Object.keys(COLS)
