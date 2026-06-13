import { useState } from 'react'
import { Menu, X, BarChart3, Calendar, CalendarDays, UserCheck, Users, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PageKey = 'shift-planner' | 'partner-hours' | 'assignment' | 'attendance' | 'partners'

const navItems: { label: string; key: PageKey; icon: React.ElementType; sub: string }[] = [
  { label: 'Shift Planner',  key: 'shift-planner',  icon: CalendarDays, sub: 'Supply vs demand analytics' },
  { label: 'Partner Hours',  key: 'partner-hours',  icon: Clock,        sub: 'Who works each hour by day' },
  { label: 'Assignment',     key: 'assignment',     icon: Calendar,     sub: 'Assign partners to orders' },
  { label: 'Attendance',     key: 'attendance',     icon: UserCheck,    sub: 'Daily attendance log' },
  { label: 'Partners',       key: 'partners',       icon: Users,        sub: 'Manage partner roster' },
]

interface LayoutProps {
  activePage: PageKey
  onNavigate: (page: PageKey) => void
  children: React.ReactNode
}

export function Layout({ activePage, onNavigate, children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const current = navItems.find((n) => n.key === activePage) ?? navItems[0]

  function navigate(key: PageKey) {
    onNavigate(key)
    setSidebarOpen(false)
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-30 w-56 bg-gray-900 flex flex-col transition-transform duration-200',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="h-16 flex items-center px-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-orange-500 flex items-center justify-center">
              <BarChart3 size={14} className="text-white" />
            </div>
            <span className="text-white font-semibold text-base">Saathi Admin</span>
          </div>
          <button className="ml-auto lg:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 transition-colors text-left',
                activePage === item.key
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <p className="text-xs text-gray-500">Supply/Demand Analytics</p>
          <p className="text-xs text-gray-600 mt-0.5">v1.0.0</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-6 gap-4 flex-shrink-0">
          <button className="lg:hidden text-gray-500 hover:text-gray-900" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div>
            <h1 className="text-base font-semibold text-gray-900">{current.label}</h1>
            <p className="text-xs text-gray-500 hidden sm:block">{current.sub}</p>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
