import { supabase } from './supabase'

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function logout() {
  await supabase.auth.signOut()
}

export async function getPerfil() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('perfil_usuario').select('*').eq('id', user.id).single()
  return data
}

export async function getUsuarios() {
  const { data } = await supabase.from('perfil_usuario').select('*, propietarios(nombre, apellidos)').order('nombre')
  return data || []
}

export async function crearUsuario(email, password, perfil) {
  // Crear en auth
  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true
  })
  if (error) throw error
  // Crear perfil
  await supabase.from('perfil_usuario').insert({ id: data.user.id, email, ...perfil })
  return data.user
}

export async function actualizarPerfil(id, datos) {
  await supabase.from('perfil_usuario').update(datos).eq('id', id)
}

export async function asignarInmuebles(usuarioId, inmuebleIds) {
  await supabase.from('usuario_inmuebles').delete().eq('usuario_id', usuarioId)
  if (inmuebleIds.length > 0) {
    await supabase.from('usuario_inmuebles').insert(
      inmuebleIds.map(id => ({ usuario_id: usuarioId, inmueble_id: id }))
    )
  }
}

export async function getInmueblesUsuario(usuarioId) {
  const { data } = await supabase.from('usuario_inmuebles')
    .select('inmueble_id').eq('usuario_id', usuarioId)
  return (data || []).map(r => r.inmueble_id)
}
