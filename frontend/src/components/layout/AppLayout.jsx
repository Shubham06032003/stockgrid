import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { alertsApi } from '../../services/api'

const NAV_ITEMS = [
  { to: '/', icon: 'dashboard', label: 'Dashboard', exact: true },
  { to: '/products', icon: 'inventory_2', label: 'Inventory' },
  { to: '/transactions', icon: 'history_toggle_off', label: 'Activity' },
  { to: '/ai-insights', icon: 'psychology', label: 'AI Insights' },
  { to: '/suppliers', icon: 'local_shipping', label: 'Suppliers' },
  { to: '/reports', icon: 'bar_chart', label: 'Reports' },
]

export default function AppLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const closeMenu = () => setIsMobileMenuOpen(false)

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark') || localStorage.getItem('theme_preference') !== 'light'
  })

  // Hook to persist theme changes
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme_preference', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme_preference', 'light')
    }
  }, [isDarkMode])

  const toggleTheme = () => setIsDarkMode(prev => !prev)

  // Prevent sidebar lock on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setIsMobileMenuOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const { data: alertsData } = useQuery({
    queryKey: ['alerts-count'],
    queryFn: () => alertsApi.list({ resolved: 'false', limit: 99 }),
    refetchInterval: 60000,
    select: d => d.data.alerts.length,
  })

  const alertCount = alertsData || 0

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      {/* Mobile backdrop */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm transition-opacity" onClick={closeMenu} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-surface-container-low flex flex-col border-r border-outline-variant/30 z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-white flex-shrink-0">
            <span className="material-symbols-outlined text-xl">inventory_2</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-on-surface tracking-tight leading-tight">StockGrid</h1>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Inventory Intelligence</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 mt-2 space-y-1">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              onClick={closeMenu}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'text-primary font-semibold bg-surface-container shadow-sm'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container/60'
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* New Entry CTA */}
        <div className="px-4 pb-2">
          <button
            onClick={() => navigate('/products')}
            className="w-full bg-gradient-to-br from-primary-container to-primary text-white py-3 rounded-xl text-sm font-semibold editorial-shadow transition-transform active:scale-95 hover:opacity-90"
          >
            + New Entry
          </button>
        </div>

        {/* Bottom nav */}
        <div className="px-4 py-4 border-t border-slate-200/50 space-y-1">
          <NavLink
            to="/settings"
            onClick={closeMenu}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive ? 'text-primary bg-surface-container' : 'text-on-surface-variant hover:text-primary hover:bg-surface-container/60'
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
            <span>Settings</span>
          </NavLink>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-on-surface-variant hover:text-tertiary hover:bg-error-container/50 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="lg:ml-64 flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top bar */}
        <header className="fixed top-0 right-0 w-full lg:w-[calc(100%-16rem)] h-16 z-30 bg-surface-container-lowest/90 backdrop-blur-xl border-b border-outline-variant/30 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center flex-1 max-w-xl gap-2">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 text-on-surface-variant hover:text-primary rounded-lg">
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>
            <div className="relative w-full hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
              <input
                type="text"
                placeholder="Search inventory or AI insights..."
                className="w-full bg-surface-container-low border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 -mr-2 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-full transition-colors flex items-center justify-center pointer-events-auto"
              aria-label="Toggle Theme"
            >
              <span className="material-symbols-outlined">
                {isDarkMode ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            <NavLink
              to="/transactions"
              className="relative p-2 flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-full transition-colors"
            >
              <span className="material-symbols-outlined">notifications</span>
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-tertiary rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </NavLink>
            <NavLink to="/ai-insights" className="p-2 flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-full transition-colors">
              <span className="material-symbols-outlined">chat_bubble</span>
            </NavLink>
            <div className="h-6 w-px bg-outline-variant/50 mx-1" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-on-surface leading-tight">{user?.name}</p>
                <p className="text-[10px] text-on-surface-variant capitalize">{user?.role}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 pt-16 overflow-y-auto scrollbar-thin">
          <div className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
