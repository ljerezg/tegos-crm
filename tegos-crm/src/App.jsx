import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Dashboard from './pages/Dashboard.jsx'
import Inmuebles from './pages/Inmuebles.jsx'
import Propietarios from './pages/Propietarios.jsx'
import Inquilinos from './pages/Inquilinos.jsx'
import Contactos from './pages/Contactos.jsx'
import Acciones from './pages/Acciones.jsx'
import Comercializando from './pages/Comercializando.jsx'
import Listados from './pages/Listados.jsx'
import Configuracion from './pages/Configuracion.jsx'
import AdministradoresFinca from './pages/AdministradoresFinca.jsx'
import Usuarios from './pages/Usuarios.jsx'

export default function App({ perfil }) {
  const location = useLocation()
  const esAdmin = perfil?.rol === 'administrador'

  const NAV = [
    { section: 'Principal' },
    { to: '/', icon: 'ti-layout-dashboard', label: 'Inicio' },
    { section: 'Cartera' },
    { to: '/inmuebles', icon: 'ti-building', label: 'Inmuebles' },
    { to: '/propietarios', icon: 'ti-id-badge', label: 'Propietarios' },
    { to: '/inquilinos', icon: 'ti-users', label: 'Inquilinos' },
    ...(esAdmin ? [{ to: '/administradores', icon: 'ti-building-community', label: 'Adm. Fincas' }] : []),
    { section: 'CRM' },
    ...(esAdmin ? [{ to: '/contactos', icon: 'ti-address-book', label: 'Contactos' }] : []),
    { to: '/acciones', icon: 'ti-activity', label: 'Acciones' },
    { section: 'Más' },
    ...(esAdmin ? [{ to: '/comercializando', icon: 'ti-home-search', label: 'Comercializando' }] : []),
    { to: '/listados', icon: 'ti-clipboard-list', label: 'Listados' },
    ...(esAdmin ? [
      { to: '/configuracion', icon: 'ti-settings', label: 'Configuración' },
      { to: '/usuarios', icon: 'ti-users-group', label: 'Usuarios' },
    ] : []),
  ]

  const pageTitle = NAV.find(n => n.to && (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)))?.label || 'Tegos CRM'

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-name">Tegos CRM</div>
          <div className="logo-sub">Gestión de alquileres</div>
        </div>
        <nav>
          {NAV.map((item, i) =>
            item.section
              ? <div className="nav-section" key={i}>{item.section}</div>
              : <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                  <i className={`ti ${item.icon}`} />
                  {item.label}
                </NavLink>
          )}
        </nav>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
            {perfil?.nombre || perfil?.email}
            {perfil?.rol && <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 10 }}>{perfil.rol}</span>}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={handleLogout}>
            <i className="ti ti-logout" /> Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <h1>{pageTitle}</h1>
        </div>
        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inmuebles" element={<Inmuebles perfil={perfil} />} />
            <Route path="/propietarios" element={<Propietarios perfil={perfil} />} />
            <Route path="/inquilinos" element={<Inquilinos perfil={perfil} />} />
            <Route path="/acciones" element={<Acciones perfil={perfil} />} />
            <Route path="/listados" element={<Listados perfil={perfil} />} />
            {esAdmin && <Route path="/administradores" element={<AdministradoresFinca />} />}
            {esAdmin && <Route path="/contactos" element={<Contactos />} />}
            {esAdmin && <Route path="/comercializando" element={<Comercializando />} />}
            {esAdmin && <Route path="/configuracion" element={<Configuracion />} />}
            {esAdmin && <Route path="/usuarios" element={<Usuarios />} />}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
