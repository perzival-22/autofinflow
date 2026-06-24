import { NavLink } from 'react-router-dom'

const NAV = [
  { section: 'Main' },
  { to: '/',          label: 'Dashboard', icon: '📊' },
  { to: '/invoices',  label: 'Invoices',  icon: '🧾' },
  { to: '/payments',  label: 'Payments',  icon: '💳' },
  { to: '/recurring', label: 'Recurring', icon: '🔁' },
  { to: '/reports',   label: 'Reports',   icon: '📈' },
  { to: '/forecast',  label: 'Forecast',  icon: '🔮' },
  { section: 'Business' },
  { to: '/clients',   label: 'Clients',   icon: '👥' },
  { section: 'System' },
  { to: '/settings',  label: 'Settings',  icon: '⚙️' },
]

export default function Layout({ children }) {
  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">A</div>
          <div className="logo-text">Auto<span>Fin</span>Flow</div>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((item, i) =>
            item.section ? (
              <span key={i} className="nav-section-label">{item.section}</span>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span> {item.label}
              </NavLink>
            )
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="version">AutoFinFlow v2.0 PWA</div>
        </div>
      </aside>
      <div className="main-content">{children}</div>
    </>
  )
}
