import { supabase } from './supabase'

const BUCKET = 'documentos-tegos'

export async function subirDocumento(file, entidadTipo, entidadId, nombre) {
  const ext = file.name.split('.').pop()
  const path = `${entidadTipo}/${entidadId}/${Date.now()}_${nombre.replace(/\s+/g, '_')}.${ext}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file)
  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

  const { error: dbError } = await supabase.from('documento').insert({
    entidad_tipo: entidadTipo,
    entidad_id: entidadId,
    nombre,
    url_archivo: publicUrl,
    tamano: `${(file.size / 1024).toFixed(0)} KB`,
  })
  if (dbError) throw dbError
  return publicUrl
}

export async function obtenerDocumentos(entidadTipo, entidadId) {
  const { data, error } = await supabase.from('documento')
    .select('*')
    .eq('entidad_tipo', entidadTipo)
    .eq('entidad_id', entidadId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function eliminarDocumento(doc) {
  const path = doc.url_archivo.split(`${BUCKET}/`)[1]
  await supabase.storage.from(BUCKET).remove([path])
  await supabase.from('documento').delete().eq('id', doc.id)
}
