import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, DollarSign, Dumbbell, LogOut, UserCog, ShieldCheck } from 'lucide-react'
import { useAuth, ALL_PAGES } from '../context/AuthContext'

const PAGE_ICONS = {
  '/': LayoutDashboard,
  '/memberships': Users,
  '/financials': DollarSign,
}

const SidebarLink = ({ to, icon: Icon, children }) => (
  <NavLink
    to={to}
    end={to === '/'}
    className={({ isActive }) =>
      `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-electric-blue text-white' : 'hover:bg-navy-700 text-slate-400'}`
    }
  >
    <Icon size={20} />
    {children}
  </NavLink>
)

export default function Layout() {
  const { user, logout, canAccess } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  // Only show nav links the user can access
  const visiblePages = ALL_PAGES.filter(p => canAccess(p.path))

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'U'

  return (
    <div className="flex min-h-screen bg-navy-900">
      {/* Sidebar */}
      <aside className="w-64 bg-navy-800 p-4 flex flex-col gap-2 border-r border-navy-700">
        <div className="flex items-center gap-2 px-4 py-4 mb-4 text-electric-green">
          <Dumbbell size={28} />
          <h1 className="text-xl font-bold text-white">J-gym</h1>
        </div>

        {/* Dynamic nav based on permissions */}
        {visiblePages.map(page => {
          const Icon = PAGE_ICONS[page.path] || LayoutDashboard
          return (
            <SidebarLink key={page.path} to={page.path} icon={Icon}>
              {page.label}
            </SidebarLink>
          )
        })}

        {/* Accounts link — admin only */}
        {user?.role === 'admin' && (
          <SidebarLink to="/accounts" icon={UserCog}>
            Accounts
          </SidebarLink>
        )}

        {/* Spacer + Logout at bottom */}
        <div className="mt-auto pt-4 border-t border-navy-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-navy-700 hover:text-red-400 transition-colors"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="h-16 bg-navy-800 border-b border-navy-700 flex items-center justify-between px-8">
          <h2 className="text-lg font-semibold text-white">Gym Management</h2>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm text-white font-medium">{user?.username}</p>
              <p className="text-xs text-slate-400 flex items-center justify-end gap-1">
                {user?.role === 'admin' && <ShieldCheck size={11} className="text-electric-green" />}
                {user?.role === 'admin' ? 'Administrator' : 'User'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-electric-blue flex items-center justify-center text-white font-bold text-sm">
              {initials}
            </div>
          </div>
        </header>
        <main className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}