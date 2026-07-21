import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, DollarSign, Dumbbell, LogOut, UserCog, ShieldCheck, Activity } from 'lucide-react'
import { useAuth, ALL_PAGES } from '../context/AuthContext'
​
const PAGE_ICONS = {
  '/': LayoutDashboard,
  '/memberships': Users,
  '/classes': Activity,
  '/financials': DollarSign,
}
​
// Vertical item used in the desktop sidebar
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
​
// Compact item used in the mobile bottom navbar
const MobileNavItem = ({ to, icon: Icon, children }) => (
  <NavLink
    to={to}
    end={to === '/'}
    className={({ isActive }) =>
      `flex flex-col items-center justify-center flex-1 min-w-0 gap-0.5 py-1.5 rounded-lg transition-colors ${isActive ? 'text-electric-blue' : 'text-slate-400 hover:text-white'}`
    }
  >
    <Icon size={20} />
    <span className="text-[10px] font-medium leading-none truncate max-w-full">{children}</span>
  </NavLink>
)
​
export default function Layout() {
  const { user, logout, canAccess } = useAuth()
  const navigate = useNavigate()
​
  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }
​
  const visiblePages = ALL_PAGES.filter(p => canAccess(p.path))
  const isAdmin = user?.role === 'admin'
​
  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'U'
​
  return (
    <div className="flex min-h-screen bg-navy-900">
      {/* ── Desktop sidebar (fixed, always visible on md+) ── */}
      <aside className="hidden md:flex w-64 h-screen sticky top-0 bg-navy-800 p-4 flex-col gap-2 border-r border-navy-700">
        <div className="flex items-center gap-2 px-4 py-4 mb-4 text-electric-green shrink-0">
          <Dumbbell size={28} />
          <h1 className="text-xl font-bold text-white">J-gym</h1>
        </div>
​
        <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pr-1">
          {visiblePages.map(page => {
            const Icon = PAGE_ICONS[page.path] || LayoutDashboard
            return (
              <SidebarLink key={page.path} to={page.path} icon={Icon}>
                {page.label}
              </SidebarLink>
            )
          })}
​
          {isAdmin && (
            <SidebarLink to="/accounts" icon={UserCog}>
              Accounts
            </SidebarLink>
          )}
        </nav>
​
        <div className="pt-4 border-t border-navy-700 shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-navy-700 hover:text-red-400 transition-colors"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </aside>
​
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-navy-800 border-b border-navy-700 flex items-center justify-between px-4 sm:px-8">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Dumbbell size={20} className="text-electric-green md:hidden" />
            <span className="hidden sm:inline">Gym Management</span>
            <span className="sm:hidden">J-gym</span>
          </h2>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm text-white font-medium">{user?.username}</p>
              <p className="text-xs text-slate-400 flex items-center justify-end gap-1">
                {isAdmin && <ShieldCheck size={11} className="text-electric-green" />}
                {isAdmin ? 'Administrator' : 'User'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-electric-blue flex items-center justify-center text-white font-bold text-sm">
              {initials}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-8 pb-24 md:pb-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
​
      {/* ── Mobile bottom navbar (fixed, always shows pages + sign out on small screens) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-navy-800 border-t border-navy-700 flex items-stretch gap-0.5 px-1 py-1">
        {visiblePages.map(page => {
          const Icon = PAGE_ICONS[page.path] || LayoutDashboard
          return (
            <MobileNavItem key={page.path} to={page.path} icon={Icon}>
              {page.label}
            </MobileNavItem>
          )
        })}
​
        {isAdmin && (
          <MobileNavItem to="/accounts" icon={UserCog}>
            Accounts
          </MobileNavItem>
        )}
​
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center flex-1 min-w-0 gap-0.5 py-1.5 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
        >
          <LogOut size={20} />
          <span className="text-[10px] font-medium leading-none">Sign Out</span>
        </button>
      </nav>
    </div>
  )
}
​