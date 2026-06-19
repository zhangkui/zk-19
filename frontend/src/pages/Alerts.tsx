import { useState, useEffect } from 'react'
import { alertsApi } from '../services/api'
import type { Alert } from '../types'
import Badge from '../components/Badge'
import {
  AlertTriangle,
  Search,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react'
import dayjs from 'dayjs'

const levelColors: Record<string, string> = {
  critical: 'danger',
  major: 'warning',
  minor: 'amber',
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: '待处置', color: 'danger', icon: Clock },
  processing: { label: '处理中', color: 'cyan', icon: AlertTriangle },
  handled: { label: '已处置', color: 'success', icon: CheckCircle },
  closed: { label: '已关闭', color: 'default', icon: XCircle },
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [unhandledCount, setUnhandledCount] = useState({ total: 0, critical: 0, major: 0, minor: 0 })

  useEffect(() => {
    loadData()
  }, [levelFilter, statusFilter])

  const loadData = async () => {
    setLoading(true)
    try {
      const params: any = { page_size: 50, ordering: '-created_at' }
      if (levelFilter) params.level = levelFilter
      if (statusFilter) params.status = statusFilter
      if (searchText) params.search = searchText
      const [alertsRes, countRes] = await Promise.all([
        alertsApi.list(params),
        alertsApi.unhandledCount(),
      ])
      setAlerts(alertsRes.data.results || alertsRes.data)
      setUnhandledCount(countRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleAlert = async (id: number, status: string) => {
    try {
      await alertsApi.handle(id, status)
      loadData()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">隐患告警中心</h2>
          <p className="text-text-muted text-sm mt-1">
            共 {alerts.length} 条告警，待处置 {unhandledCount.total} 条
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <p className="text-text-muted text-sm mb-1">待处置告警</p>
          <p className="font-display text-3xl font-bold text-danger">
            {unhandledCount.total}
          </p>
        </div>
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <p className="text-text-muted text-sm mb-1">危急告警</p>
          <p className="font-display text-3xl font-bold text-danger">
            {unhandledCount.critical}
          </p>
        </div>
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <p className="text-text-muted text-sm mb-1">重大告警</p>
          <p className="font-display text-3xl font-bold text-warning">
            {unhandledCount.major}
          </p>
        </div>
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <p className="text-text-muted text-sm mb-1">一般告警</p>
          <p className="font-display text-3xl font-bold text-amber">
            {unhandledCount.minor}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadData()}
            placeholder="搜索告警标题、内容..."
            className="w-full pl-10 pr-4 py-2 bg-bg-panel border border-border-dark rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-cyan/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-text-muted" />
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-3 py-2 bg-bg-panel border border-border-dark rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan/50"
          >
            <option value="">全部级别</option>
            <option value="critical">危急</option>
            <option value="major">重大</option>
            <option value="minor">一般</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-bg-panel border border-border-dark rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan/50"
          >
            <option value="">全部状态</option>
            <option value="open">待处置</option>
            <option value="processing">处理中</option>
            <option value="handled">已处置</option>
            <option value="closed">已关闭</option>
          </select>
        </div>
      </div>

      {/* Alert list */}
      <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
        <div className="divide-y divide-border-dark">
          {alerts.map((alert) => {
            const status = statusConfig[alert.status]
            const StatusIcon = status.icon
            return (
              <div
                key={alert.id}
                className={`p-5 hover:bg-white/5 transition-colors ${
                  alert.status === 'open' ? 'bg-danger/5' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        alert.level === 'critical'
                          ? 'bg-danger/20'
                          : alert.level === 'major'
                          ? 'bg-warning/20'
                          : 'bg-amber/20'
                      }`}
                    >
                      <AlertTriangle
                        className={`w-5 h-5 ${
                          alert.level === 'critical'
                            ? 'text-danger'
                            : alert.level === 'major'
                            ? 'text-warning'
                            : 'text-amber'
                        } ${alert.status === 'open' ? 'alert-pulse' : ''}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-medium">{alert.title}</h4>
                        <Badge variant={levelColors[alert.level] as any} size="sm">
                          {alert.level_display}
                        </Badge>
                        <Badge variant={status.color as any} size="sm">
                          <span className="flex items-center gap-1">
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </span>
                        </Badge>
                      </div>
                      <p className="text-sm text-text-muted mb-2 line-clamp-2">
                        {alert.content}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-text-muted">
                        <span>杆塔：{alert.tower_code || '-'}</span>
                        <span>类型：{alert.category_display}</span>
                        <span>{dayjs(alert.created_at).format('YYYY-MM-DD HH:mm')}</span>
                        {alert.handled_by_name && (
                          <span>处置人：{alert.handled_by_name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {alert.status === 'open' && (
                      <button
                        onClick={() => handleAlert(alert.id, 'processing')}
                        className="px-3 py-1.5 text-sm bg-cyan/20 text-cyan rounded-lg hover:bg-cyan/30 transition-colors"
                      >
                        开始处理
                      </button>
                    )}
                    {alert.status === 'processing' && (
                      <button
                        onClick={() => handleAlert(alert.id, 'handled')}
                        className="px-3 py-1.5 text-sm bg-success/20 text-success rounded-lg hover:bg-success/30 transition-colors"
                      >
                        标记已处置
                      </button>
                    )}
                    {(alert.status === 'handled' || alert.status === 'open') && (
                      <button
                        onClick={() => handleAlert(alert.id, 'closed')}
                        className="px-3 py-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
                      >
                        关闭
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {alerts.length === 0 && !loading && (
          <div className="p-12 text-center text-text-muted">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无告警信息</p>
          </div>
        )}
      </div>
    </div>
  )
}
