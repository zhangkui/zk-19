import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { tasksApi, routesApi, dronesApi } from '../services/api'
import type { InspectionTask, FlightRoute, Drone } from '../types'
import Badge from '../components/Badge'
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  ChevronRight,
  Clock,
  Camera,
  AlertTriangle,
  Play,
  CheckCircle,
  Pause,
  XCircle,
} from 'lucide-react'
import dayjs from 'dayjs'

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: '待执行', color: 'amber', icon: Clock },
  running: { label: '执行中', color: 'cyan', icon: Play },
  paused: { label: '已暂停', color: 'warning', icon: Pause },
  completed: { label: '已完成', color: 'success', icon: CheckCircle },
  cancelled: { label: '已取消', color: 'default', icon: XCircle },
}

export default function Tasks() {
  const [tasks, setTasks] = useState<InspectionTask[]>([])
  const [routes, setRoutes] = useState<FlightRoute[]>([])
  const [drones, setDrones] = useState<Drone[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const params: any = { page_size: 50 }
      if (statusFilter) params.status = statusFilter
      if (searchText) params.search = searchText
      const [tasksRes, routesRes, dronesRes] = await Promise.all([
        tasksApi.list(params),
        routesApi.list({ page_size: 50 }),
        dronesApi.list({ page_size: 50 }),
      ])
      setTasks(tasksRes.data.results || tasksRes.data)
      setRoutes(routesRes.data.results || routesRes.data)
      setDrones(dronesRes.data.results || dronesRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleStartTask = async (id: number) => {
    try {
      await tasksApi.start(id)
      loadData()
    } catch (e) {
      console.error(e)
    }
  }

  const handleCompleteTask = async (id: number) => {
    try {
      await tasksApi.complete(id)
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
          <h2 className="text-xl font-bold">巡检任务</h2>
          <p className="text-text-muted text-sm mt-1">
            共 {tasks.length} 个任务
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors">
          <Plus className="w-4 h-4" />
          新建任务
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜索任务编号、名称..."
            className="w-full pl-10 pr-4 py-2 bg-bg-panel border border-border-dark rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-cyan/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-text-muted" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-bg-panel border border-border-dark rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan/50"
          >
            <option value="">全部状态</option>
            <option value="pending">待执行</option>
            <option value="running">执行中</option>
            <option value="paused">已暂停</option>
            <option value="completed">已完成</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(statusConfig).map(([key, config]) => {
          const Icon = config.icon
          const count = tasks.filter((t) => t.status === key).length
          return (
            <div
              key={key}
              className="bg-bg-panel border border-border-dark rounded-lg p-4 flex items-center gap-3"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${config.color}/20`}>
              <Icon className={`w-5 h-5`} />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">{count}</p>
                <p className="text-xs text-text-muted">{config.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Task list */}
      <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-muted text-xs bg-bg-card/50">
                <th className="text-left px-5 py-3 font-medium">任务编号</th>
                <th className="text-left px-4 py-3 font-medium">任务名称</th>
                <th className="text-left px-4 py-3 font-medium">航线</th>
                <th className="text-left px-4 py-3 font-medium">无人机</th>
                <th className="text-left px-4 py-3 font-medium">飞手</th>
                <th className="text-left px-4 py-3 font-medium">状态</th>
                <th className="text-left px-4 py-3 font-medium">影像</th>
                <th className="text-left px-4 py-3 font-medium">缺陷</th>
                <th className="text-left px-4 py-3 font-medium">创建时间</th>
                <th className="text-right px-5 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dark">
              {tasks.map((task) => {
                const status = statusConfig[task.status]
                const StatusIcon = status.icon
                return (
                  <tr
                    key={task.id}
                    className="hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => navigate(`/tasks/${task.id}`)}
                  >
                    <td className="px-5 py-4 font-mono text-cyan text-xs">
                      {task.code}
                    </td>
                    <td className="px-4 py-4 font-medium">{task.name}</td>
                    <td className="px-4 py-4 text-text-secondary">
                      {task.route_name}
                    </td>
                    <td className="px-4 py-4 text-text-secondary">
                      {task.drone_name}
                    </td>
                    <td className="px-4 py-4 text-text-secondary">
                      {task.pilot_name}
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={status.color as any} size="sm">
                        <span className="flex items-center gap-1">
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-text-secondary">
                      {task.media_count}
                    </td>
                    <td className="px-4 py-4">
                      {task.defect_count > 0 ? (
                        <span className="text-danger">{task.defect_count}</span>
                      ) : (
                        <span className="text-text-muted">0</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-text-muted">
                      {dayjs(task.created_at).format('YYYY-MM-DD HH:mm')}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (task.status === 'pending') handleStartTask(task.id)
                        else if (task.status === 'running') handleCompleteTask(task.id)
                      }}
                      className="text-cyan hover:text-cyan-dark text-sm"
                    >
                      {task.status === 'pending' && '开始'}
                      {task.status === 'running' && '完成'}
                      {task.status === 'completed' && '查看'}
                      {task.status !== 'pending' && task.status !== 'running' && task.status !== 'completed' && '详情'}
                      <ChevronRight className="w-4 h-4 inline ml-1" />
                    </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {tasks.length === 0 && (
          <div className="p-12 text-center text-text-muted">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无巡检任务</p>
          </div>
        )}
      </div>
    </div>
  )
}
