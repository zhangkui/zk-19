import { useState } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Zap, Map, Route, ClipboardList, AlertTriangle, Image, Wrench, BarChart3, ChevronLeft, ChevronRight, Bell, User, LogOut, Settings } from 'lucide-react'
import {
  LayoutDashboard,
  Power,
  FileSearch,
} from 'lucide-react'

const menuItems = [
  { path: '/', label: '总览大屏', icon: LayoutDashboard },
  { path: '/lines', label: '线路地图', icon: Map },
  { path: '/routes', label: '航线管理', icon: Route },
  { path: '/tasks', label: '巡检任务', icon: ClipboardList },
  { path: '/defects', label: '缺陷识别', icon: FileSearch },
  { path: '/alerts', label: '隐患告警', icon: AlertTriangle },
  { path: '/replay', label: '影像回放', icon: Image },
  { path: '/workorders', label: '消缺工单', icon: Wrench },
  { path: '/analytics', label: '统计分析', icon: BarChart3 },
]

export default function Layout({ children }: { children?: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-bg-dark text-text-primary overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`relative flex flex-col bg-bg-panel border-r border-border-dark transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-border-dark px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-cyan" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="font-display font-bold text-cyan text-sm tracking-wider">
                  ZK-19
                </h1>
                <p className="text-[10px] text-text-muted">巡检智能平台</p>
              </div>
            )}
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path))
              return (
                <li key={item.path}>
                  <button
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      isActive
                        ? 'bg-cyan/10 text-cyan shadow-glow-cyan'
                        : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-bg-card border border-border-dark flex items-center justify-center text-text-muted hover:text-cyan transition-colors z-10"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-bg-panel border-b border-border-dark flex items-center justify-between px-6">
          <div>
            <h2 className="text-lg font-semibold">
              {menuItems.find((m) => location.pathname === m.path || (m.path !== '/' && location.pathname.startsWith(m.path)))?.label || '总览大屏'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-lg hover:bg-white/5 transition-colors text-text-secondary hover:text-text-primary">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full"></span>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-cyan/20 flex items-center justify-center">
                <User className="w-4 h-4 text-cyan" />
              </div>
              <div className="text-sm">
                <p className="font-medium">{user?.name || user?.username}</p>
                <p className="text-xs text-text-muted">{user?.role_display || user?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-white/5 text-text-secondary hover:text-danger transition-colors"
              title="退出登录"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
