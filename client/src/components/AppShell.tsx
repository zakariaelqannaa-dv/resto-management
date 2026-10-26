import { NavLink, Outlet } from 'react-router-dom'
import { Icon } from './ui'

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/kitchen', label: 'Kitchen board', icon: 'flame' },
  { to: '/orders', label: 'Orders', icon: 'receipt' },
  { to: '/menu', label: 'Menu', icon: 'book' },
  { to: '/tables', label: 'Tables', icon: 'layout' },
  { to: '/settings', label: 'Settings', icon: 'sliders' },
]

export function AppShell() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand__mark">M</div>
          <div>
            <div className="brand__name">Mise</div>
            <div className="brand__sub">Restaurant OS</div>
          </div>
        </div>

        <nav className="nav">
          <div className="nav__label">Service</div>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
            >
              <span className="nav-link__icon">
                <Icon name={item.icon} />
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__foot">
          <span className="dot" />
          Embedded database
          <br />
          Editable tickets · day codes
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
