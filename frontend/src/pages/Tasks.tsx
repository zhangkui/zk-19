import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { tasksApi, routesApi, dronesApi, authApi } from '../services/api'
import type { InspectionTask, FlightRoute, Drone, User } from '../types'
import Badge from '../components/Badge'
import Modal, { FormField, inputClass, selectClass, textareaClass } from '../components/Modal'
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
  const [pilots, setPilots] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    route: '' as number | string,
    drone: '' as number | string,
    pilot: '' as number | string,
    planned_date: '',
    notes: '',
  })
  const navigate = useNavigate()

  useEffect(() => {
    loadData()
  }, [searchText, statusFilter])

  const loadData = async () => {
    try {
      const params: any = { page_size: 50 }
      if (statusFilter) params.status = statusFilter
      if (searchText) params.search = searchText
      const [tasksRes, routesRes, dronesRes, pilotsRes] = await Promise.all([
        tasksApi.list(params),
        routesApi.list({ page_size: 50 }),
        dronesApi.list({ page_size: 50 }),
        authApi.getUsers({ role: 'pilot' }),
      ])
      setTasks(tasksRes.data.results || tasksRes.data)
      setRoutes(routesRes.data.results || routesRes.data)
      setDrones(dronesRes.data.results || dronesRes.data)
      setPilots(pilotsRes.data.results || pilotsRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setForm({
      name: '',
      route: routes.length > 0 ? routes[0].id : '',
      drone: drones.length > 0 ? drones[0].id : '',
      pilot: '',
      planned_date: dayjs().format('YYYY-MM-DD'),
      notes: '',
    })
    setModalOpen(true)
  }

  const handleCreate = async () => {
    if (!form.name.trim()) return
    setSubmitting(true)
    try {
      const data: any = {
        name: form.name,
      }
      if (form.route) data.route = Number(form.route)
      if (form.drone) data.drone = Number(form.drone)
      if (form.pilot) data.pilot = Number(form.pilot)
      if (form.planned_date) data.planned_date = form.planned_date
      if (form.notes) data.notes = form.notes
      await tasksApi.create(data)
      setModalOpen(false)
      loadData()
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
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
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors">
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
            onKeyDown={(e) => e.key === 'Enter' && loadData()}
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

      {/* Create Task Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="新建巡检任务"
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={submitting || !form.name.trim()}
              className="px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors text-sm disabled:opacity-50"
            >
              {submitting ? '创建中...' : '创建'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="任务名称" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="请输入任务名称"
              className={inputClass}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="航线">
              <select
                value={form.route}
                onChange={(e) => setForm({ ...form, route: Number(e.target.value) })}
                className={selectClass}
              >
                <option value="">无</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="无人机">
              <select
                value={form.drone}
                onChange={(e) => setForm({ ...form, drone: Number(e.target.value) })}
                className={selectClass}
              >
                <option value="">无</option>
                {drones.map((drone) => (
                  <option key={drone.id} value={drone.id}>
                    {drone.name} ({drone.model})
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="飞手">
              <select
                value={form.pilot}
                onChange={(e) => setForm({ ...form, pilot: Number(e.target.value) })}
                className={selectClass}
              >
                <option value="">请选择</option>
                {pilots.map((pilot) => (
                  <option key={pilot.id} value={pilot.id}>
                    {pilot.name} ({pilot.username})
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="计划日期">
              <input
                type="date"
                value={form.planned_date}
                onChange={(e) => setForm({ ...form, planned_date: e.target.value })}
                className={inputClass}
              />
            </FormField>
          </div>
          <FormField label="备注">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="请输入任务备注"
              rows={2}
              className={textareaClass}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  )
}
