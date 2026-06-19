import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { workOrdersApi } from '../services/api'
import type { WorkOrder } from '../types'
import Badge from '../components/Badge'
import {
  Wrench,
  Plus,
  Search,
  Filter,
  ChevronRight,
  Clock,
  User,
} from 'lucide-react'
import dayjs from 'dayjs'

const severityColors: Record<string, string> = {
  critical: 'danger',
  major: 'warning',
  minor: 'amber',
}

const priorityColors: Record<string, string> = {
  urgent: 'danger',
  high: 'warning',
  normal: 'cyan',
  low: 'default',
}

const statusColors: Record<string, string> = {
  created: 'cyan',
  assigned: 'amber',
  processing: 'cyan',
  review: 'warning',
  closed: 'success',
  cancelled: 'default',
}

const statusLabels: Record<string, string> = {
  created: '已创建',
  assigned: '已派发',
  processing: '处理中',
  review: '待复核',
  closed: '已闭环',
  cancelled: '已取消',
}

export default function WorkOrders() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    loadWorkOrders()
  }, [statusFilter, severityFilter])

  const loadWorkOrders = async () => {
    setLoading(true)
    try {
      const params: any = { page_size: 50, ordering: '-created_at' }
      if (statusFilter) params.status = statusFilter
      if (severityFilter) params.severity = severityFilter
      if (searchText) params.search = searchText
      const res = await workOrdersApi.list(params)
      setWorkOrders(res.data.results || res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const statusStats = ['created', 'assigned', 'processing', 'review', 'closed']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">消缺工单</h2>
          <p className="text-text-muted text-sm mt-1">
            共 {workOrders.length} 条工单
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors">
          <Plus className="w-4 h-4" />
          新建工单
        </button>
      </div>

      {/* Status stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statusStats.map((status) => {
          const count = workOrders.filter((wo) => wo.status === status).length
          return (
            <div
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
              className={`bg-bg-panel border rounded-lg p-4 cursor-pointer transition-all ${
                statusFilter === status
                  ? 'border-cyan shadow-glow-cyan'
                  : 'border-border-dark hover:border-cyan/30'
              }`}
            >
              <p className="text-2xl font-display font-bold text-center">
                {count}
              </p>
              <p className="text-xs text-text-muted text-center mt-1">
                {statusLabels[status]}
              </p>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadWorkOrders()}
            placeholder="搜索工单编号、标题..."
            className="w-full pl-10 pr-4 py-2 bg-bg-panel border border-border-dark rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-cyan/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-text-muted" />
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 bg-bg-panel border border-border-dark rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan/50"
          >
            <option value="">全部严重度</option>
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
            <option value="created">已创建</option>
            <option value="assigned">已派发</option>
            <option value="processing">处理中</option>
            <option value="review">待复核</option>
            <option value="closed">已闭环</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
      </div>

      {/* Work order list */}
      <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-muted text-xs bg-bg-card/50">
                <th className="text-left px-5 py-3 font-medium">工单编号</th>
                <th className="text-left px-4 py-3 font-medium">标题</th>
                <th className="text-left px-4 py-3 font-medium">杆塔</th>
                <th className="text-left px-4 py-3 font-medium">严重度</th>
                <th className="text-left px-4 py-3 font-medium">优先级</th>
                <th className="text-left px-4 py-3 font-medium">状态</th>
                <th className="text-left px-4 py-3 font-medium">责任人</th>
                <th className="text-left px-4 py-3 font-medium">创建时间</th>
                <th className="text-right px-5 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dark">
              {workOrders.map((wo) => (
                <tr
                  key={wo.id}
                  className="hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => navigate(`/workorders/${wo.id}`)}
                >
                  <td className="px-5 py-4 font-mono text-cyan text-xs">
                    {wo.code}
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium max-w-xs truncate">{wo.title}</p>
                  </td>
                  <td className="px-4 py-4 text-text-secondary">
                    {wo.tower_code}
                    <span className="text-text-muted text-xs block">
                      {wo.tower_line}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={severityColors[wo.severity] as any} size="sm">
                      {wo.severity_display}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={priorityColors[wo.priority] as any} size="sm">
                      {wo.priority_display}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={statusColors[wo.status] as any} size="sm">
                      {wo.status_display}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    {wo.assignee_name ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-cyan/20 flex items-center justify-center">
                          <User className="w-3 h-3 text-cyan" />
                        </div>
                        <span className="text-text-secondary">{wo.assignee_name}</span>
                      </div>
                    ) : (
                      <span className="text-text-muted">未指派</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-text-muted">
                    {dayjs(wo.created_at).format('YYYY-MM-DD HH:mm')}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-cyan hover:text-cyan-dark text-sm">
                      详情
                      <ChevronRight className="w-4 h-4 inline ml-1" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {workOrders.length === 0 && !loading && (
          <div className="p-12 text-center text-text-muted">
            <Wrench className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无工单数据</p>
          </div>
        )}
      </div>
    </div>
  )
}
