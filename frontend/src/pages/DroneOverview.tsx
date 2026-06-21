import { useState, useEffect, useMemo, useRef } from 'react'
import { dronesApi, tasksApi, systemLogsApi, droneTelemetriesApi, droneTaskSummariesApi } from '../services/api'
import type { Drone, DroneTelemetry, SystemLog, InspectionTask, InspectionTaskDetail, DroneTaskSummary } from '../types'
import Badge from '../components/Badge'
import MapComponent from '../components/MapComponent'
import { Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet'
import {
  Cpu,
  Battery,
  Signal,
  MapPin,
  Clock,
  Search,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  Home,
  AlertTriangle,
  Wifi,
  WifiOff,
  Activity,
  ChevronRight,
  ChevronLeft,
  X,
  Navigation,
  Gauge,
  Mountain,
  Target,
  Radio,
  Cpu as CpuIcon,
  XCircle,
  Zap,
  Satellite,
  CheckCircle,
  FileText,
} from 'lucide-react'
import dayjs from 'dayjs'
import L from 'leaflet'

const STATUS_FILTER_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'online', label: '在线' },
  { value: 'offline', label: '离线' },
]

const TASK_STATUS_OPTIONS = [
  { value: '', label: '全部任务' },
  { value: 'running', label: '任务中' },
  { value: 'idle', label: '空闲' },
]

const LOG_CATEGORIES = [
  { value: 'heartbeat', label: '心跳' },
  { value: 'telemetry', label: '遥测' },
  { value: 'task_bind', label: '任务绑定' },
  { value: 'task_start', label: '任务开始' },
  { value: 'task_pause', label: '任务暂停' },
  { value: 'task_resume', label: '任务恢复' },
  { value: 'return_home', label: '返航指令' },
]

const ABNORMAL_TYPES = [
  { type: 'low_battery', label: '低电量', color: 'danger' },
  { type: 'weak_signal', label: '弱信号', color: 'warning' },
  { type: 'offline', label: '离线', color: 'default' },
  { type: 'task_abnormal', label: '任务异常', color: 'danger' },
]

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, zoom, { animate: true, duration: 1 })
  }, [center, zoom, map])
  return null
}

const getBatteryColor = (battery: number) => {
  if (battery > 60) return 'text-success'
  if (battery > 30) return 'text-warning'
  return 'text-danger'
}

const getSignalColor = (signal: number) => {
  if (signal > 70) return 'text-success'
  if (signal > 40) return 'text-warning'
  return 'text-danger'
}

const getBatteryBgColor = (battery: number) => {
  if (battery > 60) return 'bg-success'
  if (battery > 30) return 'bg-warning'
  return 'bg-danger'
}

const droneIcon = (status: string) =>
  L.divIcon({
    className: 'custom-drone-marker',
    html: `<div class="w-8 h-8 rounded-full flex items-center justify-center ${
      status === 'online' ? 'bg-success' : 'bg-text-muted'
    } shadow-lg shadow-cyan/50"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><polygon points="12 2 19 12 12 22 5 12 12 2"></polygon><circle cx="12" cy="12" r="3"></circle></svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  })

export default function DroneOverview() {
  const [drones, setDrones] = useState<Drone[]>([])
  const [telemetries, setTelemetries] = useState<DroneTelemetry[]>([])
  const [tasks, setTasks] = useState<InspectionTask[]>([])
  const [taskSummaries, setTaskSummaries] = useState<DroneTaskSummary[]>([])
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [loading, setLoading] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)
  const [selectedDrone, setSelectedDrone] = useState<Drone | null>(null)
  const [selectedDroneId, setSelectedDroneId] = useState<number | null>(null)
  const [mapCenter, setMapCenter] = useState<[number, number]>([39.908, 116.397])
  const [mapZoom, setMapZoom] = useState(12)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [detailSidebarOpen, setDetailSidebarOpen] = useState(false)
  const [bottomPanelTab, setBottomPanelTab] = useState<'abnormal' | 'logs'>('abnormal')
  const [showTrajectory, setShowTrajectory] = useState(true)
  const [showMissionRoute, setShowMissionRoute] = useState(true)

  const [onlineStatusFilter, setOnlineStatusFilter] = useState('')
  const [taskStatusFilter, setTaskStatusFilter] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [logCategoryFilter, setLogCategoryFilter] = useState<string>('')
  const [logPage, setLogPage] = useState(1)
  const [logTotal, setLogTotal] = useState(0)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedDroneId) {
      loadDroneDetail()
    }
  }, [selectedDroneId])

  useEffect(() => {
    loadLogs()
  }, [selectedDroneId, logCategoryFilter, logPage])

  const loadData = async () => {
    setLoading(true)
    try {
      const [dronesRes, tasksRes, telemetryRes, summariesRes] = await Promise.all([
        dronesApi.list({ page_size: 100 }),
        tasksApi.list({ page_size: 100 }),
        droneTelemetriesApi.list({ page_size: 200 }),
        droneTaskSummariesApi.list({ page_size: 200 }),
      ])
      setDrones(dronesRes.data.results || dronesRes.data)
      setTasks(tasksRes.data.results || tasksRes.data)
      setTelemetries(telemetryRes.data.results || telemetryRes.data)
      setTaskSummaries(summariesRes.data.results || summariesRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadDroneDetail = async () => {
    if (!selectedDroneId) return
    try {
      const drone = drones.find((d) => d.id === selectedDroneId)
      if (drone) {
        setSelectedDrone(drone)
        setDetailSidebarOpen(true)

        if (drone.latitude != null && drone.longitude != null) {
          setMapCenter([drone.latitude, drone.longitude])
          setMapZoom(15)
        } else {
          const telemetry = telemetries.find((t) => t.drone === selectedDroneId)
          if (telemetry) {
            setMapCenter([telemetry.latitude, telemetry.longitude])
            setMapZoom(15)
          }
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const loadLogs = async () => {
    if (!selectedDroneId) return
    setLogsLoading(true)
    try {
      const params: any = {
        drone: selectedDroneId,
        page: logPage,
        page_size: 10,
      }
      if (logCategoryFilter) {
        params.log_category = logCategoryFilter
      }
      const res = await systemLogsApi.list(params)
      setLogs(res.data.results || res.data)
      setLogTotal(res.data.count || (res.data.results || res.data).length)
    } catch (e) {
      console.error(e)
    } finally {
      setLogsLoading(false)
    }
  }

  const handleDroneClick = (drone: Drone) => {
    setSelectedDroneId(drone.id)
    setLogPage(1)
  }

  const getDroneOnlineStatus = (drone: Drone) => {
    if (typeof drone.is_online === 'boolean') {
      return drone.is_online ? 'online' : 'offline'
    }
    if (drone.last_heartbeat) {
      const diffSeconds = dayjs().diff(dayjs(drone.last_heartbeat), 'second')
      return diffSeconds < 60 ? 'online' : 'offline'
    }
    return 'offline'
  }

  const getDroneTelemetry = (droneId: number) => {
    return telemetries.find((t) => t.drone === droneId)
  }

  const getDroneCurrentTask = (droneId: number) => {
    const drone = drones.find((d) => d.id === droneId)
    if (drone?.current_task_id) {
      return tasks.find((t) => t.id === drone.current_task_id)
    }
    return tasks.find((t) => t.drone === droneId && t.status === 'running')
  }

  const getDroneLastHeartbeat = (droneId: number) => {
    const drone = drones.find((d) => d.id === droneId)
    return drone?.last_heartbeat || null
  }

  const getTaskLatestSummary = (taskId: number) => {
    const summaries = taskSummaries
      .filter((s) => s.task === taskId)
      .sort((a, b) => dayjs(b.report_time).valueOf() - dayjs(a.report_time).valueOf())
    return summaries[0] || null
  }

  const filteredDrones = useMemo(() => {
    return drones.filter((drone) => {
      if (searchKeyword) {
        const keyword = searchKeyword.toLowerCase()
        const matchesSearch =
          drone.name.toLowerCase().includes(keyword) ||
          drone.model.toLowerCase().includes(keyword) ||
          drone.serial_number.toLowerCase().includes(keyword)
        if (!matchesSearch) return false
      }

      if (onlineStatusFilter) {
        const onlineStatus = getDroneOnlineStatus(drone)
        if (onlineStatusFilter === 'online' && onlineStatus !== 'online') return false
        if (onlineStatusFilter === 'offline' && onlineStatus !== 'offline') return false
      }

      if (taskStatusFilter) {
        const hasTask = !!getDroneCurrentTask(drone.id)
        if (taskStatusFilter === 'running' && !hasTask) return false
        if (taskStatusFilter === 'idle' && hasTask) return false
      }

      return true
    })
  }, [drones, telemetries, tasks, searchKeyword, onlineStatusFilter, taskStatusFilter])

  const abnormalEvents = useMemo(() => {
    const events: Array<{
      id: string
      type: string
      droneId: number
      droneName: string
      message: string
      time: string
      level: string
      coordinates?: { lon: number; lat: number }
    }> = []

    drones.forEach((drone) => {
      const telemetry = getDroneTelemetry(drone.id)
      const onlineStatus = getDroneOnlineStatus(drone)

      if (onlineStatus === 'offline') {
        events.push({
          id: `offline-${drone.id}`,
          type: 'offline',
          droneId: drone.id,
          droneName: drone.name,
          message: '无人机已离线',
          time: getDroneLastHeartbeat(drone.id) || drone.created_at,
          level: 'error',
          coordinates:
            drone.latitude && drone.longitude
              ? { lat: drone.latitude, lon: drone.longitude }
              : undefined,
        })
      }

      if (drone.battery < 30) {
        events.push({
          id: `battery-${drone.id}`,
          type: 'low_battery',
          droneId: drone.id,
          droneName: drone.name,
          message: `低电量警告：${drone.battery}%`,
          time: drone.last_report_time || drone.last_heartbeat || drone.created_at,
          level: 'warning',
          coordinates:
            drone.latitude && drone.longitude
              ? { lat: drone.latitude, lon: drone.longitude }
              : telemetry?.coordinates,
        })
      }

      if (drone.signal_strength < 40) {
        events.push({
          id: `signal-${drone.id}`,
          type: 'weak_signal',
          droneId: drone.id,
          droneName: drone.name,
          message: `弱信号警告：${drone.signal_strength}%`,
          time: drone.last_report_time || drone.last_heartbeat || drone.created_at,
          level: 'warning',
          coordinates:
            drone.latitude && drone.longitude
              ? { lat: drone.latitude, lon: drone.longitude }
              : telemetry?.coordinates,
        })
      }

      const task = getDroneCurrentTask(drone.id)
      if (task && task.status !== 'running' && task.status !== 'completed') {
        const taskSummary = getTaskLatestSummary(task.id)
        if (taskSummary && (taskSummary.task_status === 'error' || taskSummary.task_status === 'aborted')) {
          events.push({
            id: `task-${drone.id}`,
            type: 'task_abnormal',
            droneId: drone.id,
            droneName: drone.name,
            message: `任务异常：${task.name} (${taskSummary.task_status_display || taskSummary.task_status})`,
            time: taskSummary.report_time || task.started_at || task.created_at,
            level: 'error',
          })
        }
      }
    })

    return events.sort((a, b) => dayjs(b.time).valueOf() - dayjs(a.time).valueOf())
  }, [drones, telemetries, tasks, taskSummaries])

  const stats = useMemo(() => {
    const online = drones.filter((d) => getDroneOnlineStatus(d) === 'online').length
    const inTask = drones.filter((d) => !!d.current_task_id || getDroneCurrentTask(d.id)).length
    const lowBattery = drones.filter((d) => d.battery < 30).length
    const weakSignal = drones.filter((d) => d.signal_strength < 40).length
    const offline = drones.filter((d) => getDroneOnlineStatus(d) === 'offline').length
    const abnormal = abnormalEvents.length

    return { online, inTask, lowBattery, weakSignal, offline, abnormal }
  }, [drones, telemetries, tasks, abnormalEvents])

  const droneTrajectories = useMemo(() => {
    const trajectories: Record<number, [number, number][]> = {}
    telemetries.forEach((t) => {
      if (!trajectories[t.drone]) {
        trajectories[t.drone] = []
      }
      trajectories[t.drone].push([t.latitude, t.longitude])
    })
    return trajectories
  }, [telemetries])

  const handleAbnormalEventClick = (event: any) => {
    setSelectedDroneId(event.droneId)
    if (event.coordinates) {
      setMapCenter([event.coordinates.lat, event.coordinates.lon])
      setMapZoom(16)
    }
  }

  const handleCommand = async (command: 'start' | 'pause' | 'resume' | 'return_home') => {
    if (!selectedDroneId) return
    try {
      const task = getDroneCurrentTask(selectedDroneId)
      if (command === 'start' && task) {
        await tasksApi.start(task.id)
      } else if ((command === 'pause' || command === 'resume' || command === 'return_home') && task) {
        await tasksApi.taskControl(task.id, command)
      }
      loadData()
    } catch (e: any) {
      console.error('Command error:', e)
      alert(e?.response?.data?.error || e?.response?.data?.message || '指令发送失败')
    }
  }

  const selectedDroneTelemetry = selectedDrone ? getDroneTelemetry(selectedDrone.id) : null
  const selectedDroneTask = selectedDrone ? getDroneCurrentTask(selectedDrone.id) : null

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">无人机总览</h2>
          <p className="text-text-muted text-sm mt-1">
            实时监控所有无人机状态，共 {drones.length} 台无人机
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-bg-panel border border-border-dark rounded-lg text-sm hover:bg-white/5 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold">{stats.online}</p>
              <p className="text-xs text-text-muted">在线</p>
            </div>
          </div>
        </div>
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-cyan" />
            <div>
              <p className="text-2xl font-display font-bold text-cyan">{stats.inTask}</p>
              <p className="text-xs text-text-muted">任务中</p>
            </div>
          </div>
        </div>
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Battery className="w-5 h-5 text-danger" />
            <div>
              <p className="text-2xl font-display font-bold text-danger">{stats.lowBattery}</p>
              <p className="text-xs text-text-muted">低电量</p>
            </div>
          </div>
        </div>
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Signal className="w-5 h-5 text-warning" />
            <div>
              <p className="text-2xl font-display font-bold text-warning">{stats.weakSignal}</p>
              <p className="text-xs text-text-muted">弱信号</p>
            </div>
          </div>
        </div>
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <div className="flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-text-muted" />
            <div>
              <p className="text-2xl font-display font-bold text-text-muted">{stats.offline}</p>
              <p className="text-xs text-text-muted">离线</p>
            </div>
          </div>
        </div>
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-danger" />
            <div>
              <p className="text-2xl font-display font-bold text-danger">{stats.abnormal}</p>
              <p className="text-xs text-text-muted">异常事件</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left Sidebar - Drone List */}
        <div
          className={`bg-bg-panel border border-border-dark rounded-xl flex flex-col transition-all duration-300 ${
            sidebarOpen ? 'w-80' : 'w-12'
          }`}
        >
          <div className="p-3 border-b border-border-dark flex items-center justify-between">
            {sidebarOpen && (
              <h3 className="font-medium text-sm flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan" />
                无人机列表
                <span className="text-text-muted text-xs">({filteredDrones.length})</span>
              </h3>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted hover:text-cyan transition-colors"
            >
              {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {sidebarOpen && (
            <>
              {/* Filters */}
              <div className="p-3 border-b border-border-dark space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="搜索名称、型号、序列号..."
                    className="w-full pl-9 pr-3 py-2 bg-bg-card border border-border-dark rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-cyan/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={onlineStatusFilter}
                    onChange={(e) => setOnlineStatusFilter(e.target.value)}
                    className="px-2 py-1.5 bg-bg-card border border-border-dark rounded-lg text-xs text-text-primary focus:outline-none focus:border-cyan/50"
                  >
                    {STATUS_FILTER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={taskStatusFilter}
                    onChange={(e) => setTaskStatusFilter(e.target.value)}
                    className="px-2 py-1.5 bg-bg-card border border-border-dark rounded-lg text-xs text-text-primary focus:outline-none focus:border-cyan/50"
                  >
                    {TASK_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Drone List */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin w-6 h-6 border-2 border-cyan border-t-transparent rounded-full"></div>
                  </div>
                ) : filteredDrones.length === 0 ? (
                  <div className="p-8 text-center text-text-muted">
                    <Cpu className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">暂无无人机</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border-dark">
                    {filteredDrones.map((drone) => {
                      const onlineStatus = getDroneOnlineStatus(drone)
                      const telemetry = getDroneTelemetry(drone.id)
                      const currentTask = getDroneCurrentTask(drone.id)
                      const lastHeartbeat = getDroneLastHeartbeat(drone.id)
                      const isSelected = selectedDroneId === drone.id

                      return (
                        <div
                          key={drone.id}
                          onClick={() => handleDroneClick(drone)}
                          className={`p-3 cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-cyan/10 border-l-2 border-cyan'
                              : 'hover:bg-white/5 border-l-2 border-transparent'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                onlineStatus === 'online' ? 'bg-success/10' : 'bg-bg-card'
                              }`}
                            >
                              <Cpu
                                className={`w-4 h-4 ${
                                  onlineStatus === 'online' ? 'text-success' : 'text-text-muted'
                                }`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm truncate">{drone.name}</span>
                                <Badge
                                  variant={onlineStatus === 'online' ? 'success' : 'default'}
                                  size="sm"
                                >
                                  {onlineStatus === 'online' ? '在线' : '离线'}
                                </Badge>
                              </div>
                              <p className="text-xs text-text-muted font-mono mb-2">
                                {drone.serial_number}
                              </p>

                              {/* Status Indicators */}
                              <div className="flex items-center gap-3 text-xs">
                                <span
                                  className={`flex items-center gap-1 ${getBatteryColor(
                                    drone.battery
                                  )}`}
                                >
                                  <Battery className="w-3 h-3" />
                                  {drone.battery}%
                                </span>
                                <span
                                  className={`flex items-center gap-1 ${getSignalColor(
                                    drone.signal_strength
                                  )}`}
                                >
                                  <Signal className="w-3 h-3" />
                                  {drone.signal_strength}%
                                </span>
                              </div>

                              {/* Current Task */}
                              {currentTask && (
                                <div className="mt-2">
                                  <Badge variant="cyan" size="sm">
                                    <Target className="w-3 h-3 mr-1" />
                                    {currentTask.name}
                                  </Badge>
                                </div>
                              )}

                              {/* Last Heartbeat */}
                              {lastHeartbeat && (
                                <p className="text-xs text-text-muted mt-1 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {dayjs(lastHeartbeat).format('HH:mm:ss')}
                                </p>
                              )}

                              {/* Location */}
                              {drone.latitude != null && drone.longitude != null && (
                                <p className="text-xs text-text-muted mt-1 flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {drone.latitude.toFixed(4)}, {drone.longitude.toFixed(4)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Center - Map and Bottom Panel */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Map Controls */}
          <div className="relative flex-1 bg-bg-panel border border-border-dark rounded-xl overflow-hidden flex flex-col min-h-0">
            <div className="absolute top-3 left-3 z-[400] flex items-center gap-2">
              <div className="bg-bg-panel/90 backdrop-blur rounded-lg p-1 flex items-center gap-1 border border-border-dark">
                <button
                  onClick={() => setShowTrajectory(!showTrajectory)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    showTrajectory
                      ? 'bg-cyan text-bg-dark'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  飞行轨迹
                </button>
                <button
                  onClick={() => setShowMissionRoute(!showMissionRoute)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    showMissionRoute
                      ? 'bg-cyan text-bg-dark'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  任务航线
                </button>
              </div>
            </div>

            <MapComponent center={mapCenter} zoom={mapZoom} className="h-full">
              <MapController center={mapCenter} zoom={mapZoom} />

              {/* Mission Routes */}
              {showMissionRoute &&
                tasks.map((task) => {
                  const taskDetail = task as any
                  if (taskDetail.route_data?.coordinates) {
                    return (
                      <Polyline
                        key={`route-${task.id}`}
                        positions={taskDetail.route_data.coordinates.map(
                          (c: [number, number]) => [c[1], c[0]]
                        )}
                        color="#06B6D4"
                        weight={3}
                        opacity={0.6}
                        dashArray="10, 10"
                      />
                    )
                  }
                  return null
                })}

              {/* Trajectories */}
              {showTrajectory &&
                Object.entries(droneTrajectories).map(([droneId, points]) => {
                  if (points.length < 2) return null
                  return (
                    <Polyline
                      key={`traj-${droneId}`}
                      positions={points}
                      color="#10B981"
                      weight={2}
                      opacity={0.5}
                    />
                  )
                })}

              {/* Drone Markers */}
              {drones.map((drone) => {
                const telemetry = getDroneTelemetry(drone.id)
                const onlineStatus = getDroneOnlineStatus(drone)
                const lat = drone.latitude ?? telemetry?.latitude
                const lon = drone.longitude ?? telemetry?.longitude
                if (lat == null || lon == null) return null
                return (
                  <Marker
                    key={drone.id}
                    position={[lat, lon]}
                    icon={droneIcon(onlineStatus)}
                    eventHandlers={{
                      click: () => handleDroneClick(drone),
                    }}
                  >
                    <Popup>
                      <div className="text-sm min-w-[200px]">
                        <p className="font-medium mb-1">{drone.name}</p>
                        <p className="text-xs text-text-muted mb-2">{drone.serial_number}</p>
                        <div className="space-y-1 text-xs">
                          <p>状态: {onlineStatus === 'online' ? '在线' : '离线'}</p>
                          <p>电量: {drone.battery}%</p>
                          <p>信号: {drone.signal_strength}%</p>
                          <p>速度: {(telemetry?.speed ?? drone.speed).toFixed(1)} m/s</p>
                          <p>高度: {(telemetry?.altitude ?? drone.altitude).toFixed(1)} m</p>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )
              })}

              {/* Waypoints for selected drone task */}
              {selectedDrone && selectedDroneTask && showMissionRoute && (() => {
                const taskDetail = selectedDroneTask as any
                if (taskDetail.route_data?.waypoints_data) {
                  return taskDetail.route_data.waypoints_data.map(
                    (wp: any, idx: number) => (
                      <CircleMarker
                        key={`wp-${selectedDrone.id}-${idx}`}
                        center={[wp.lat, wp.lon]}
                        radius={5}
                        fillColor="#F5B301"
                        color="#F5B301"
                        weight={2}
                      >
                        <Popup>
                          <div className="text-xs">
                            <p className="font-medium">航点 {idx + 1}</p>
                            {wp.altitude && <p>高度: {wp.altitude} m</p>}
                            {wp.speed && <p>速度: {wp.speed} m/s</p>}
                          </div>
                        </Popup>
                      </CircleMarker>
                    )
                  )
                }
                return null
              })()}
            </MapComponent>
          </div>

          {/* Bottom Panel */}
          <div className="h-64 bg-bg-panel border border-border-dark rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center border-b border-border-dark">
              <button
                onClick={() => setBottomPanelTab('abnormal')}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                  bottomPanelTab === 'abnormal'
                    ? 'text-cyan border-cyan'
                    : 'text-text-secondary border-transparent hover:text-text-primary'
                }`}
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  异常事件
                  <Badge variant="danger" size="sm">
                    {abnormalEvents.length}
                  </Badge>
                </span>
              </button>
              <button
                onClick={() => setBottomPanelTab('logs')}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                  bottomPanelTab === 'logs'
                    ? 'text-cyan border-cyan'
                    : 'text-text-secondary border-transparent hover:text-text-primary'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  日志记录
                </span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {bottomPanelTab === 'abnormal' ? (
                abnormalEvents.length === 0 ? (
                  <div className="p-8 text-center text-text-muted">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-success opacity-50" />
                    <p className="text-sm">暂无异常事件</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border-dark">
                    {abnormalEvents.map((event) => (
                      <div
                        key={event.id}
                        onClick={() => handleAbnormalEventClick(event)}
                        className="px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              event.level === 'error' ? 'bg-danger/10' : 'bg-warning/10'
                            }`}
                          >
                            {event.level === 'error' ? (
                              <XCircle className="w-4 h-4 text-danger" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-warning" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{event.droneName}</span>
                              <Badge
                                variant={event.level === 'error' ? 'danger' : 'warning'}
                                size="sm"
                              >
                                {ABNORMAL_TYPES.find((t) => t.type === event.type)?.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-text-secondary">{event.message}</p>
                            <p className="text-xs text-text-muted mt-1">
                              {dayjs(event.time).format('YYYY-MM-DD HH:mm:ss')}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="h-full flex flex-col">
                  {selectedDroneId ? (
                    <>
                      <div className="p-3 border-b border-border-dark">
                        <div className="flex items-center gap-2 overflow-x-auto">
                          {LOG_CATEGORIES.map((cat) => (
                            <button
                              key={cat.value}
                              onClick={() => {
                                setLogCategoryFilter(
                                  logCategoryFilter === cat.value ? '' : cat.value
                                )
                                setLogPage(1)
                              }}
                              className={`px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                                logCategoryFilter === cat.value
                                  ? 'bg-cyan text-bg-dark'
                                  : 'bg-bg-card text-text-secondary hover:text-text-primary'
                              }`}
                            >
                              {cat.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        {logsLoading ? (
                          <div className="flex items-center justify-center h-32">
                            <div className="animate-spin w-6 h-6 border-2 border-cyan border-t-transparent rounded-full"></div>
                          </div>
                        ) : logs.length === 0 ? (
                          <div className="p-8 text-center text-text-muted">
                            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">暂无日志记录</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-border-dark">
                            {logs.map((log) => (
                              <div key={log.id} className="px-4 py-2.5">
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5">
                                    {log.log_type === 'push' ? (
                                      <Radio className="w-4 h-4 text-cyan" />
                                    ) : (
                                      <CpuIcon className="w-4 h-4 text-amber" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <Badge
                                        className={
                                          log.log_level === 'info'
                                            ? 'bg-cyan/20 text-cyan'
                                            : log.log_level === 'warning'
                                              ? 'bg-amber/20 text-amber'
                                              : log.log_level === 'error'
                                                ? 'bg-danger/20 text-danger'
                                                : 'bg-rose-500/20 text-rose-500'
                                        }
                                        size="sm"
                                      >
                                        {log.log_level_display}
                                      </Badge>
                                      <Badge variant="cyan" size="sm">
                                        {log.log_category_display}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-text-secondary">{log.title}</p>
                                    <p className="text-xs text-text-muted mt-0.5">
                                      {dayjs(log.report_time).format('HH:mm:ss')}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Log Pagination */}
                      {logTotal > 10 && (
                        <div className="px-4 py-2 border-t border-border-dark flex items-center justify-between text-xs text-text-muted">
                          <span>共 {logTotal} 条</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setLogPage(Math.max(1, logPage - 1))}
                              disabled={logPage === 1}
                              className="p-1 rounded hover:bg-white/5 disabled:opacity-30"
                            >
                              <ChevronLeft className="w-3 h-3" />
                            </button>
                            <span>第 {logPage} 页</span>
                            <button
                              onClick={() => setLogPage(logPage + 1)}
                              disabled={logPage * 10 >= logTotal}
                              className="p-1 rounded hover:bg-white/5 disabled:opacity-30"
                            >
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-8 text-center text-text-muted">
                      <Cpu className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">请选择无人机查看日志</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Detail Panel */}
        {detailSidebarOpen && selectedDrone && (
          <div className="w-80 bg-bg-panel border border-border-dark rounded-xl flex flex-col overflow-hidden">
            <div className="p-3 border-b border-border-dark flex items-center justify-between">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan" />
                无人机详情
              </h3>
              <button
                onClick={() => setDetailSidebarOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted hover:text-danger transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Drone Info Header */}
              <div className="p-4 border-b border-border-dark">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-cyan/10 flex items-center justify-center">
                    <Cpu className="w-6 h-6 text-cyan" />
                  </div>
                  <div>
                    <h4 className="font-bold">{selectedDrone.name}</h4>
                    <p className="text-xs text-text-muted font-mono">
                      {selectedDrone.serial_number}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={getDroneOnlineStatus(selectedDrone) === 'online' ? 'success' : 'default'}
                    size="sm"
                  >
                    {getDroneOnlineStatus(selectedDrone) === 'online' ? '在线' : '离线'}
                  </Badge>
                  <Badge variant="cyan" size="sm">
                    {selectedDrone.model}
                  </Badge>
                </div>
              </div>

              {/* Real-time Telemetry */}
              <div className="p-4 border-b border-border-dark">
                <h5 className="text-xs text-text-muted mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan" />
                  实时遥测
                </h5>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-bg-card rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Battery className="w-4 h-4" />
                      <span className="text-xs text-text-muted">电量</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <span
                        className={`text-xl font-display font-bold ${getBatteryColor(
                          selectedDrone.battery
                        )}`}
                      >
                        {selectedDrone.battery}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 bg-bg-dark rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getBatteryBgColor(
                          selectedDrone.battery
                        )} transition-all duration-500`}
                        style={{ width: `${selectedDrone.battery}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="bg-bg-card rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Signal className="w-4 h-4" />
                      <span className="text-xs text-text-muted">信号</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <span
                        className={`text-xl font-display font-bold ${getSignalColor(
                          selectedDrone.signal_strength
                        )}`}
                      >
                        {selectedDrone.signal_strength}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 bg-bg-dark rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getBatteryBgColor(
                          selectedDrone.signal_strength
                        )} transition-all duration-500`}
                        style={{ width: `${selectedDrone.signal_strength}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="bg-bg-card rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Gauge className="w-4 h-4 text-cyan" />
                      <span className="text-xs text-text-muted">速度</span>
                    </div>
                    <p className="text-xl font-display font-bold text-cyan">
                      {(selectedDroneTelemetry?.speed ?? selectedDrone.speed).toFixed(1)}
                      <span className="text-xs text-text-muted ml-1">m/s</span>
                    </p>
                  </div>
                  <div className="bg-bg-card rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Mountain className="w-4 h-4 text-amber" />
                      <span className="text-xs text-text-muted">高度</span>
                    </div>
                    <p className="text-xl font-display font-bold text-amber">
                      {(selectedDroneTelemetry?.altitude ?? selectedDrone.altitude).toFixed(1)}
                      <span className="text-xs text-text-muted ml-1">m</span>
                    </p>
                  </div>
                  <div className="bg-bg-card rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Navigation className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-text-muted">航向</span>
                    </div>
                    <p className="text-xl font-display font-bold text-purple-400">
                      {(selectedDroneTelemetry?.heading ?? selectedDrone.heading).toFixed(0)}
                      <span className="text-xs text-text-muted ml-1">°</span>
                    </p>
                  </div>
                  <div className="bg-bg-card rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Satellite className="w-4 h-4 text-success" />
                      <span className="text-xs text-text-muted">卫星</span>
                    </div>
                    <p className="text-xl font-display font-bold text-success">
                      {selectedDroneTelemetry?.satellites ?? '-'}
                      {selectedDroneTelemetry?.satellites != null && (
                        <span className="text-xs text-text-muted ml-1">颗</span>
                      )}
                    </p>
                  </div>
                  {(selectedDrone.latitude != null && selectedDrone.longitude != null) ||
                  selectedDroneTelemetry ? (
                    <div className="bg-bg-card rounded-lg p-3 col-span-2">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-4 h-4 text-text-muted" />
                        <span className="text-xs text-text-muted">当前位置</span>
                      </div>
                      <p className="text-sm font-mono">
                        {(selectedDrone.latitude ?? selectedDroneTelemetry?.coordinates.lat)?.toFixed(6)},{' '}
                        {(selectedDrone.longitude ?? selectedDroneTelemetry?.coordinates.lon)?.toFixed(6)}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Task Info */}
              <div className="p-4 border-b border-border-dark">
                <h5 className="text-xs text-text-muted mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-cyan" />
                  任务信息
                </h5>
                {selectedDroneTask ? (
                  <div className="space-y-3">
                    <div className="bg-bg-card rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm">{selectedDroneTask.name}</p>
                        <Badge variant="cyan" size="sm">
                          {selectedDroneTask.status_display}
                        </Badge>
                      </div>
                      <p className="text-xs text-text-muted font-mono mb-2">
                        {selectedDroneTask.code}
                      </p>
                      <div className="text-xs text-text-muted">
                        <p>飞行员: {selectedDroneTask.pilot_name}</p>
                        <p>航线: {selectedDroneTask.route_name}</p>
                      </div>
                    </div>

                    {/* Waypoint Progress */}
                    {(() => {
                      const taskSummary = selectedDroneTask
                        ? getTaskLatestSummary(selectedDroneTask.id)
                        : null
                      const taskDetail = selectedDroneTask as any
                      const routeWaypoints = taskDetail.route_data?.waypoints_data

                      if (taskSummary && taskSummary.total_waypoints > 0) {
                        const currentWaypoint = taskSummary.current_waypoint_index + 1
                        const totalWaypoints = taskSummary.total_waypoints
                        const progress = Math.round(taskSummary.progress)
                        return (
                          <div className="bg-bg-card rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-text-muted">航点进度</span>
                              <span className="text-xs font-medium">
                                {currentWaypoint} / {totalWaypoints}
                              </span>
                            </div>
                            <div className="h-2 bg-bg-dark rounded-full overflow-hidden mb-2">
                              <div
                                className="h-full bg-cyan transition-all duration-500"
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                            <div className="flex items-center justify-between text-xs text-text-muted">
                              <span>进度 {progress}%</span>
                            </div>
                          </div>
                        )
                      } else if (routeWaypoints && routeWaypoints.length > 0) {
                        return (
                          <div className="bg-bg-card rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-text-muted">航点进度</span>
                              <span className="text-xs font-medium">
                                0 / {routeWaypoints.length}
                              </span>
                            </div>
                            <div className="h-2 bg-bg-dark rounded-full overflow-hidden mb-2">
                              <div
                                className="h-full bg-cyan transition-all duration-500"
                                style={{ width: '0%' }}
                              ></div>
                            </div>
                            <div className="flex items-center justify-between text-xs text-text-muted">
                              <span>进度 0%</span>
                            </div>
                          </div>
                        )
                      }
                      return null
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-6 text-text-muted">
                    <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">当前无执行任务</p>
                  </div>
                )}
              </div>

              {/* Command Panel */}
              <div className="p-4 border-b border-border-dark">
                <h5 className="text-xs text-text-muted mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan" />
                  基础指令
                </h5>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleCommand('start')}
                    disabled={!selectedDroneTask || (selectedDroneTask.status !== 'pending' && selectedDroneTask.status !== 'paused')}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-success text-bg-dark font-medium rounded-lg hover:bg-success/90 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-4 h-4" />
                    开始任务
                  </button>
                  <button
                    onClick={() => handleCommand('pause')}
                    disabled={!selectedDroneTask || selectedDroneTask.status !== 'running'}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-warning text-bg-dark font-medium rounded-lg hover:bg-warning/90 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Pause className="w-4 h-4" />
                    暂停任务
                  </button>
                  <button
                    onClick={() => handleCommand('resume')}
                    disabled={!selectedDroneTask || selectedDroneTask.status !== 'paused'}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan/90 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className="w-4 h-4" />
                    恢复任务
                  </button>
                  <button
                    onClick={() => handleCommand('return_home')}
                    disabled={!selectedDroneTask || (selectedDroneTask.status !== 'running' && selectedDroneTask.status !== 'paused')}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-danger text-white font-medium rounded-lg hover:bg-danger/90 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Home className="w-4 h-4" />
                    返航
                  </button>
                </div>
              </div>

              {/* Last Heartbeat */}
              <div className="p-4">
                <h5 className="text-xs text-text-muted mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan" />
                  最后心跳
                </h5>
                <p className="text-sm">
                  {selectedDrone.last_heartbeat
                    ? dayjs(selectedDrone.last_heartbeat).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
