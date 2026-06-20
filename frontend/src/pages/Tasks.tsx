import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { tasksApi, routesApi, dronesApi, authApi } from '../services/api'
import type { InspectionTask, FlightRoute, Drone, User, RouteNearbyTower, RouteAffectedSection } from '../types'
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
  MapPin,
  Ruler,
  Clock3,
  Mountain,
  Gauge,
  Layers,
  Route,
} from 'lucide-react'
import dayjs from 'dayjs'
import { useAuthStore } from '../store/authStore'
import { isAdmin, isPilot } from '../utils'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: '待执行', color: 'amber', icon: Clock },
  running: { label: '执行中', color: 'cyan', icon: Play },
  paused: { label: '已暂停', color: 'warning', icon: Pause },
  completed: { label: '已完成', color: 'success', icon: CheckCircle },
  cancelled: { label: '已取消', color: 'default', icon: XCircle },
}

export default function Tasks() {
  const { user } = useAuthStore()
  const [tasks, setTasks] = useState<InspectionTask[]>([])
  const [routes, setRoutes] = useState<FlightRoute[]>([])
  const [drones, setDrones] = useState<Drone[]>([])
  const [pilots, setPilots] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedRouteDetail, setSelectedRouteDetail] = useState<{
    route: FlightRoute | null
    towers: RouteNearbyTower[]
    sections: RouteAffectedSection[]
    loading: boolean
  }>({ route: null, towers: [], sections: [], loading: false })
  const [form, setForm] = useState({
    name: '',
    route: '' as number | string,
    drone: '' as number | string,
    pilot: '' as number | string,
    planned_date: '',
    notes: '',
  })
  const navigate = useNavigate()

  const canCreate = isAdmin(user)
  const canOperateTask = (task: InspectionTask) => {
    if (isAdmin(user)) return true
    if (isPilot(user)) return task.pilot === user?.id
    return false
  }

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
        routesApi.optionsForTask(),
        dronesApi.list({ page_size: 50, status: 'idle' }),
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

  const loadRouteDetail = async (routeId: number) => {
    setSelectedRouteDetail(prev => ({ ...prev, loading: true }))
    try {
      const [routeRes, tsRes] = await Promise.all([
        routesApi.get(routeId),
        routesApi.getTowersAndSections(routeId),
      ])
      setSelectedRouteDetail({
        route: routeRes.data,
        towers: tsRes.data.towers || [],
        sections: tsRes.data.sections || [],
        loading: false,
      })
    } catch (e) {
      console.error(e)
      setSelectedRouteDetail(prev => ({ ...prev, loading: false }))
    }
  }

  const openCreate = () => {
    const firstRoute = routes.length > 0 ? routes[0] : null
    setForm({
      name: '',
      route: firstRoute ? firstRoute.id : '',
      drone: drones.length > 0 ? drones[0].id : '',
      pilot: '',
      planned_date: dayjs().format('YYYY-MM-DD'),
      notes: '',
    })
    if (firstRoute) {
      loadRouteDetail(firstRoute.id)
    } else {
      setSelectedRouteDetail({ route: null, towers: [], sections: [], loading: false })
    }
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
            {isPilot(user) && '（仅显示分配给我的任务）'}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors">
            <Plus className="w-4 h-4" />
            新建任务
          </button>
        )}
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
                        if (!canOperateTask(task)) {
                          navigate(`/tasks/${task.id}`)
                          return
                        }
                        if (task.status === 'pending') handleStartTask(task.id)
                        else if (task.status === 'running') handleCompleteTask(task.id)
                        else navigate(`/tasks/${task.id}`)
                      }}
                      className="text-cyan hover:text-cyan-dark text-sm"
                    >
                      {canOperateTask(task) && task.status === 'pending' && '开始'}
                      {canOperateTask(task) && task.status === 'running' && '完成'}
                      {task.status === 'completed' && '查看'}
                      {!canOperateTask(task) && '详情'}
                      {task.status !== 'pending' && task.status !== 'running' && task.status !== 'completed' && canOperateTask(task) && '详情'}
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
        width="max-w-5xl"
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Form */}
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
              <FormField label="航线" required>
                <select
                  value={form.route}
                  onChange={(e) => {
                    const routeId = Number(e.target.value)
                    setForm({ ...form, route: routeId })
                    if (routeId) {
                      loadRouteDetail(routeId)
                    } else {
                      setSelectedRouteDetail({ route: null, towers: [], sections: [], loading: false })
                    }
                  }}
                  className={selectClass}
                >
                  <option value="">请选择航线</option>
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.name}
                    </option>
                  ))}
                </select>
                {routes.length === 0 && (
                  <p className="text-xs text-warning mt-1">暂无已审核通过的航线，请先在航线管理中创建并审核航线</p>
                )}
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

            {/* Route Info Summary */}
            {selectedRouteDetail.route && !selectedRouteDetail.loading && (
              <div className="bg-bg-card/50 border border-border-dark rounded-lg p-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Route className="w-4 h-4 text-cyan" />
                  航线参数
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Ruler className="w-4 h-4 text-text-muted" />
                    <span className="text-text-muted">长度:</span>
                    <span className="font-medium">{(selectedRouteDetail.route.distance / 1000).toFixed(2)} km</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock3 className="w-4 h-4 text-text-muted" />
                    <span className="text-text-muted">预计:</span>
                    <span className="font-medium">{Math.round(selectedRouteDetail.route.estimated_duration / 60)} 分钟</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mountain className="w-4 h-4 text-text-muted" />
                    <span className="text-text-muted">高度:</span>
                    <span className="font-medium">{selectedRouteDetail.route.altitude} m</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Gauge className="w-4 h-4 text-text-muted" />
                    <span className="text-text-muted">速度:</span>
                    <span className="font-medium">{selectedRouteDetail.route.speed} m/s</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border-dark grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-purple-400" />
                    <span className="text-text-muted">杆塔:</span>
                    <span className="font-medium text-purple-400">{selectedRouteDetail.towers.length} 基</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <span className="text-text-muted">区段:</span>
                    <span className="font-medium text-purple-400">{selectedRouteDetail.sections.length} 个</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Map Preview */}
          <div className="space-y-4">
            <div className="h-80 rounded-lg overflow-hidden border border-border-dark">
              {selectedRouteDetail.loading ? (
                <div className="w-full h-full flex items-center justify-center bg-bg-card">
                  <div className="animate-spin w-6 h-6 border-2 border-cyan border-t-transparent rounded-full" />
                </div>
              ) : selectedRouteDetail.route && selectedRouteDetail.route.coordinates.length > 0 ? (
                <MapContainer
                  center={selectedRouteDetail.route.coordinates[0] as [number, number]}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <ZoomControl position="topright" />
                  <Polyline
                    positions={selectedRouteDetail.route.coordinates as [number, number][]}
                    color="#22D3EE"
                    weight={3}
                    opacity={0.8}
                  />
                  {selectedRouteDetail.route.coordinates.map((coord, idx) => (
                    <CircleMarker
                      key={idx}
                      center={coord as [number, number]}
                      radius={6}
                      fillColor={idx === 0 ? '#22C55E' : idx === selectedRouteDetail.route.coordinates.length - 1 ? '#EF4444' : '#F5B301'}
                      color={idx === 0 ? '#22C55E' : idx === selectedRouteDetail.route.coordinates.length - 1 ? '#EF4444' : '#F5B301'}
                      weight={2}
                      fillOpacity={0.8}
                    >
                      <Tooltip direction="top" offset={[0, -8]}>
                        <div className="text-xs">
                          <p className="font-medium">航点 #{idx + 1}</p>
                          <p className="text-text-muted">经度: {coord[1].toFixed(6)}</p>
                          <p className="text-text-muted">纬度: {coord[0].toFixed(6)}</p>
                        </div>
                      </Tooltip>
                    </CircleMarker>
                  ))}
                  {selectedRouteDetail.towers.map((tower) => tower.coordinates && (
                    <CircleMarker
                      key={`tower-${tower.id}`}
                      center={[tower.coordinates.lat, tower.coordinates.lon]}
                      radius={5}
                      fillColor="#A855F7"
                      color="#A855F7"
                      weight={2}
                      fillOpacity={0.9}
                    >
                      <Tooltip direction="top" offset={[0, -8]}>
                        <div className="text-xs">
                          <p className="font-medium text-purple-400">杆塔: {tower.code}</p>
                          <p className="text-text-muted">高度: {tower.height}m</p>
                          <p className="text-text-muted">类型: {tower.tower_type_display}</p>
                        </div>
                      </Tooltip>
                    </CircleMarker>
                  ))}
                </MapContainer>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-bg-card text-text-muted">
                  <Route className="w-12 h-12 mb-2 opacity-30" />
                  <p className="text-sm">请选择航线查看覆盖范围</p>
                </div>
              )}
            </div>

            {/* Towers and Sections */}
            {selectedRouteDetail.route && !selectedRouteDetail.loading && (
              <div className="grid grid-cols-2 gap-4">
                {/* Towers */}
                <div className="bg-bg-card/50 border border-border-dark rounded-lg p-3">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-purple-400" />
                    覆盖杆塔
                    <Badge variant="purple" size="sm">{selectedRouteDetail.towers.length}</Badge>
                  </h4>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {selectedRouteDetail.towers.length > 0 ? (
                      selectedRouteDetail.towers.map((tower) => (
                        <div key={tower.id} className="text-xs px-2 py-1.5 bg-bg-dark/50 rounded flex items-center justify-between">
                          <span className="font-mono">{tower.code}</span>
                          <span className="text-text-muted">#{tower.sequence}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-text-muted text-center py-2">暂无杆塔</p>
                    )}
                  </div>
                </div>

                {/* Sections */}
                <div className="bg-bg-card/50 border border-border-dark rounded-lg p-3">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-400" />
                    覆盖区段
                    <Badge variant="purple" size="sm">{selectedRouteDetail.sections.length}</Badge>
                  </h4>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {selectedRouteDetail.sections.length > 0 ? (
                      selectedRouteDetail.sections.map((section) => (
                        <div key={section.id} className="text-xs px-2 py-1.5 bg-bg-dark/50 rounded">
                          <span>{section.name}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-text-muted text-center py-2">暂无区段</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
