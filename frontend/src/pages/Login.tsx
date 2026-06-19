import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Zap, Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function Login() {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as any)?.from?.pathname || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await login(username, password)
      navigate(from, { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.detail || '登录失败，请检查用户名和密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-cyan/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-amber/10 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0B0F14_70%)]"></div>
      </div>

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#22D3EE 1px, transparent 1px), linear-gradient(90deg, #22D3EE 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      ></div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-bg-panel/80 backdrop-blur-xl border border-border-dark rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-cyan/20 flex items-center justify-center mx-auto mb-4 shadow-glow-cyan">
              <Zap className="w-8 h-8 text-cyan" />
            </div>
            <h1 className="font-display text-2xl font-bold text-cyan tracking-wider mb-2">
              ZK-19 巡检平台
            </h1>
            <p className="text-text-muted text-sm">
              山区输电线路无人机巡检缺陷识别与工单闭环平台
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm text-text-secondary mb-2">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-bg-card border border-border-dark rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-cyan/50 focus:ring-1 focus:ring-cyan/30 transition-all"
                placeholder="请输入用户名"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-2">密码</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 bg-bg-card border border-border-dark rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-cyan/50 focus:ring-1 focus:ring-cyan/30 transition-all"
                  placeholder="请输入密码"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-cyan hover:bg-cyan-dark text-bg-dark font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-glow-cyan hover:shadow-lg"
            >
              {loading ? '登录中...' : '登 录'}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6 pt-6 border-t border-border-dark">
            <p className="text-xs text-text-muted mb-3">演示账号：</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-bg-card rounded border border-border-dark">
                <p className="text-cyan font-medium">admin / admin</p>
                <p className="text-text-muted">调度管理员</p>
              </div>
              <div className="p-2 bg-bg-card rounded border border-border-dark">
                <p className="text-amber font-medium">pilot1 / pilot123</p>
                <p className="text-text-muted">无人机飞手</p>
              </div>
              <div className="p-2 bg-bg-card rounded border border-border-dark">
                <p className="text-success font-medium">reviewer1 / reviewer123</p>
                <p className="text-text-muted">缺陷审核员</p>
              </div>
              <div className="p-2 bg-bg-card rounded border border-border-dark">
                <p className="text-warning font-medium">crew1 / crew123</p>
                <p className="text-text-muted">检修班组</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-text-muted text-xs mt-6">
          © 2024 ZK-19 输电线路智能巡检平台
        </p>
      </div>
    </div>
  )
}
