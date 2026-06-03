import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import Inmuebles from './pages/Inmuebles.jsx'
import Propietarios from './pages/Propietarios.jsx'
import Inquilinos from './pages/Inquilinos.jsx'
import Contactos from './pages/Contactos.jsx'
import Acciones from './pages/Acciones.jsx'
import Comercializando from './pages/Comercializando.jsx'

const NAV = [
  { section: 'Principal' },
  { to: '/', icon: 'ti-layout-dashboard', label: 'Inicio' },
  { section: 'Cartera' },
  { to: '/inmuebles', icon: 'ti-building', label: 'Inmuebles' },
  { to: '/propietarios', icon: 'ti-id-badge', label: 'Propietarios' },
  { to: '/inquilinos', icon: 'ti-users', label: 'Inquilinos' },
  { section: 'CRM' },
  { to: '/contactos', icon: 'ti-address-book', label: 'Contactos' },
  { to: '/acciones', icon: 'ti-activity', label: 'Acciones' },
  { section: 'Más' },
  { to: '/comercializando', icon: 'ti-home-search', label: 'Comercializando' },
]

export default function App() {
  const location = useLocation()
  const pageTitle = NAV.find(n => n.to && (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)))?.label || 'Tegos CRM'

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
              : <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
                >
                  <i className={`ti ${item.icon}`} />
                  {item.label}
                </NavLink>
          )}
        </nav>
      </aside>

      <div className="main">
        <div className="topbar">
          <h1>{pageTitle}</h1>
        </div>
        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inmuebles" element={<Inmuebles />} />
            <Route path="/propietarios" element={<Propietarios />} />
            <Route path="/inquilinos" element={<Inquilinos />} />
            <Route path="/contactos" element={<Contactos />} />
            <Route path="/acciones" element={<Acciones />} />
            <Route path="/comercializando" element={<Comercializando />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
