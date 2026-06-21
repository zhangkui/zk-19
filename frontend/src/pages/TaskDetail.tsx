import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { tasksApi, mediaApi, defectsApi } from '../services/api'
import type { InspectionTaskDetail, InspectionMedia, Defect, DroneTelemetry } from '../types'
import MapComponent from '../components/MapComponent'
import Badge from '../components/Badge'
import {
  ArrowLeft,
  Play,
  Pause,
  Upload,
  Camera,
  AlertTriangle,
  Clock,
  MapPin,
  FileImage,
  RotateCcw,
  FastForward,
  Gauge,
  Battery,
  Signal,
  Navigation,
  Thermometer,
  Wind,
} from 'lucide-react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, Popup } from 'react-leaflet'
import dayjs from 'dayjs'
import { useAuthStore } from '../store/authStore'
import { isAdmin, isPilot } from '../utils'
import L from 'leaflet'

const droneIcon = L.divIcon({
  className: 'drone-marker',
  html: `
    <div style="
      width: 32px;
      height: 32px;
      background: #22D3EE;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 3px solid white;
      box-shadow: 0 0 15px rgba(34, 211, 238, 0.6);
      animation: pulse 2s infinite;
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    </div>
    <style>
      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
      }
    </style>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [task, setTask] = useState<InspectionTaskDetail | null>(null)
  const [mediaList, setMediaList] = useState<InspectionMedia[]>([])
  const [defects, setDefects] = useState<Defect[]>([])
  const [telemetries, setTelemetries] = useState<DroneTelemetry[]>([])
  const [activeTab, setActiveTab] = useState<'media' | 'defects' | 'info'>('media')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Replay state
  const [isReplaying, setIsReplaying] = useState(false)
  const [replayIndex, setReplayIndex] = useState(0)
  const [replaySpeed, setReplaySpeed] = useState(1)
  const [showReplayControls, setShowReplayControls] = useState(false)
  const replayIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [loadingTelemetry, setLoadingTelemetry] = useState(false)

  const canOperate = task
    ? isAdmin(user) || (isPilot(user) && task.pilot === user?.id)
    : false

  useEffect(() => {
    if (id) {
      loadData()
    }
    return () => {
      stopReplay()
    }
  }, [id])

  useEffect(() => {
    if (isReplaying && telemetries.length > 0) {
      const interval = 500 / replaySpeed
      replayIntervalRef.current = setInterval(() => {
        setReplayIndex((prev) => {
          if (prev >= telemetries.length - 1) {
            stopReplay()
            return prev
          }
          return prev + 1
        })
      }, interval)
    }
    return () => {
      if (replayIntervalRef.current) {
        clearInterval(replayIntervalRef.current)
      }
    }
  }, [isReplaying, replaySpeed, telemetries.length])

  const loadData = async () => {
    try {
      const [taskRes, mediaRes, defectsRes] = await Promise.all([
        tasksApi.get(Number(id)),
        mediaApi.list({ task: id, page_size: 50 }),
        defectsApi.list({ task: id, page_size: 50 }),
      ])
      setTask(taskRes.data)
      setMediaList(mediaRes.data.results || mediaRes.data)
      setDefects(defectsRes.data.results || defectsRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadTelemetry = async () => {
    if (!id) return
    setLoadingTelemetry(true)
    try {
      const res = await tasksApi.telemetry(Number(id))
      setTelemetries(res.data)
      setShowReplayControls(true)
      setReplayIndex(0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingTelemetry(false)
    }
  }

  const handleStart = async () => {
    if (!task || !canOperate) return
    try {
      await tasksApi.start(task.id)
      loadData()
    } catch (e) {
      console.error(e)
    }
  }

  const handleComplete = async () => {
    if (!task || !canOperate) return
    try {
      await tasksApi.complete(task.id)
      loadData()
    } catch (e) {
      console.error(e)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !task || !canOperate) return

    setUploading(true)
    const formData = new FormData()
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i])
    }

    try {
      await tasksApi.upload(task.id, formData)
      loadData()
    } catch (err) {
      console.error('Upload failed', err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const startReplay = () => {
    if (telemetries.length === 0) {
      loadTelemetry()
      return
    }
    setIsReplaying(true)
  }

  const pauseReplay = () => {
    setIsReplaying(false)
  }

  const stopReplay = () => {
    setIsReplaying(false)
    setReplayIndex(0)
    if (replayIntervalRef.current) {
      clearInterval(replayIntervalRef.current)
    }
  }

  const resetReplay = () => {
    setReplayIndex(0)
    if (isReplaying) {
      pauseReplay()
    }
  }

  const currentTelemetry = telemetries[replayIndex]

  const replayStats = useMemo(() => {
    if (!currentTelemetry) return null
    const startTime = telemetries[0]?.report_time
    const elapsed = startTime
      ? dayjs(currentTelemetry.report_time).diff(dayjs(startTime), 'second')
      : 0
    return {
      elapsed,
      totalTime: telemetries.length > 1
        ? dayjs(telemetries[telemetries.length - 1].report_time).diff(dayjs(telemetries[0].report_time), 'second')
        : 0,
      speed: currentTelemetry.speed,
      altitude: currentTelemetry.altitude,
      battery: currentTelemetry.battery,
      signal: currentTelemetry.signal_strength,
      heading: currentTelemetry.heading,
      satellites: currentTelemetry.satellites,
      temperature: currentTelemetry.temperature,
      windSpeed: currentTelemetry.wind_speed,
      progress: telemetries.length > 0 ? ((replayIndex + 1) / telemetries.length) * 100 : 0,
    }
  }, [currentTelemetry, telemetries, replayIndex])

  const mapCenter = useMemo(() => {
    if (showReplayControls && currentTelemetry) {
      return [currentTelemetry.latitude, currentTelemetry.longitude] as [number, number]
    }
    if (task?.route_data?.coordinates?.length) {
      const coords = task.route_data.coordinates
      const avgLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length
      const avgLon = coords.reduce((sum, c) => sum + c[0], 0) / coords.length
      return [avgLat, avgLon] as [number, number]
    }
    return [39.91, 116.47] as [number, number]
  }, [task, showReplayControls, currentTelemetry])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-cyan border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (!task) {
    return <div>任务不存在</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">{task.name}</h2>
              <Badge variant="cyan" size="sm">
                {task.code}
              </Badge>
            </div>
            <p className="text-text-muted text-sm mt-1">
              {task.route_name} · {task.drone_name} · {task.pilot_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (!showReplayControls) {
                loadTelemetry()
              } else {
                setShowReplayControls(false)
                stopReplay()
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-bg-panel border border-border-dark rounded-lg hover:bg-white/5 transition-colors"
            disabled={loadingTelemetry}
          >
            <RotateCcw className={`w-4 h-4 ${loadingTelemetry ? 'animate-spin' : ''}`} />
            {showReplayControls ? '隐藏回放' : '飞行回放'}
          </button>
          {canOperate && task.status === 'pending' && (
            <button
              onClick={handleStart}
              className="flex items-center gap-2 px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors">
              <Play className="w-4 h-4" />
              开始任务
            </button>
          )}
          {canOperate && task.status === 'running' && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {uploading ? '上传中...' : '上传影像'}
              </button>
              <button
                onClick={handleComplete}
                className="flex items-center gap-2 px-4 py-2 border border-success/50 text-success rounded-lg hover:bg-success/10 transition-colors">
                <Pause className="w-4 h-4" />
                完成任务
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <p className="text-text-muted text-sm mb-1">任务状态</p>
          <p className="font-display text-2xl font-bold text-cyan">
            {task.status_display}
          </p>
        </div>
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <p className="text-text-muted text-sm mb-1">影像数量</p>
          <p className="font-display text-2xl font-bold text-amber">
            {task.media_count}
          </p>
        </div>
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <p className="text-text-muted text-sm mb-1">发现缺陷</p>
          <p className="font-display text-2xl font-bold text-danger">
            {task.defect_count}
          </p>
        </div>
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <p className="text-text-muted text-sm mb-1">计划日期</p>
          <p className="font-display text-xl font-bold text-success">
            {task.planned_date || '-'}
          </p>
        </div>
      </div>

      {/* Replay Controls Panel */}
      {showReplayControls && (
        <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border-dark flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-cyan" />
              飞行回放
              {telemetries.length > 0 && (
                <span className="text-sm text-text-muted font-normal ml-2">
                  共 {telemetries.length} 条遥测数据
                </span>
              )}
            </h3>
          </div>

          {/* Replay Stats */}
          {replayStats && (
            <div className="px-5 py-3 border-b border-border-dark grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan" />
                <div>
                  <p className="text-xs text-text-muted">已飞行</p>
                  <p className="font-mono text-sm font-medium">
                    {dayjs.duration(replayStats.elapsed, 'second').format('HH:mm:ss')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-amber" />
                <div>
                  <p className="text-xs text-text-muted">速度</p>
                  <p className="font-mono text-sm font-medium">{replayStats.speed.toFixed(1)} m/s</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-success" />
                <div>
                  <p className="text-xs text-text-muted">高度</p>
                  <p className="font-mono text-sm font-medium">{replayStats.altitude.toFixed(1)} m</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Battery className="w-4 h-4 text-cyan" />
                <div>
                  <p className="text-xs text-text-muted">电量</p>
                  <p className="font-mono text-sm font-medium">{replayStats.battery}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Signal className="w-4 h-4 text-warning" />
                <div>
                  <p className="text-xs text-text-muted">信号</p>
                  <p className="font-mono text-sm font-medium">{replayStats.signal}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-purple-400" />
                <div>
                  <p className="text-xs text-text-muted">航向</p>
                  <p className="font-mono text-sm font-medium">{replayStats.heading.toFixed(0)}°</p>
                </div>
              </div>
              {replayStats.temperature !== null && (
                <div className="flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-danger" />
                  <div>
                    <p className="text-xs text-text-muted">温度</p>
                    <p className="font-mono text-sm font-medium">{replayStats.temperature.toFixed(1)}℃</p>
                  </div>
                </div>
              )}
              {replayStats.windSpeed !== null && (
                <div className="flex items-center gap-2">
                  <Wind className="w-4 h-4 text-cyan" />
                  <div>
                    <p className="text-xs text-text-muted">风速</p>
                    <p className="font-mono text-sm font-medium">{replayStats.windSpeed.toFixed(1)} m/s</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Progress Bar */}
          {telemetries.length > 0 && (
            <div className="px-5 py-3 border-b border-border-dark">
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-muted w-16">
                  {dayjs(telemetries[0].report_time).format('HH:mm:ss')}
                </span>
                <div className="flex-1 h-2 bg-bg-card rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan transition-all duration-100"
                    style={{ width: `${replayStats?.progress || 0}%` }}
                  />
                </div>
                <span className="text-xs text-text-muted w-16 text-right">
                  {dayjs(telemetries[telemetries.length - 1].report_time).format('HH:mm:ss')}
                </span>
              </div>
              <div className="flex items-center justify-center gap-3 mt-3">
                <button
                  onClick={resetReplay}
                  className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors"
                  title="重置"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setReplayIndex(Math.max(0, replayIndex - 1))}
                  disabled={replayIndex === 0}
                  className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
                  title="上一帧"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                {isReplaying ? (
                  <button
                    onClick={pauseReplay}
                    className="flex items-center gap-2 px-6 py-2 bg-amber text-bg-dark font-medium rounded-lg hover:bg-amber/80 transition-colors"
                  >
                    <Pause className="w-4 h-4" />
                    暂停
                  </button>
                ) : (
                  <button
                    onClick={startReplay}
                    disabled={telemetries.length === 0}
                    className="flex items-center gap-2 px-6 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    {replayIndex > 0 ? '继续' : '播放'}
                  </button>
                )}
                <button
                  onClick={() => setReplayIndex(Math.min(telemetries.length - 1, replayIndex + 1))}
                  disabled={replayIndex >= telemetries.length - 1}
                  className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
                  title="下一帧"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2 ml-4">
                  <FastForward className="w-4 h-4 text-text-muted" />
                  <select
                    value={replaySpeed}
                    onChange={(e) => setReplaySpeed(Number(e.target.value))}
                    className="px-2 py-1 bg-bg-card border border-border-dark rounded text-sm"
                  >
                    <option value={0.5}>0.5x</option>
                    <option value={1}>1x</option>
                    <option value={2}>2x</option>
                    <option value={4}>4x</option>
                    <option value={8}>8x</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {loadingTelemetry && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-cyan border-t-transparent rounded-full mr-3"></div>
              <span className="text-text-muted">加载遥测数据中...</span>
            </div>
          )}

          {!loadingTelemetry && telemetries.length === 0 && (
            <div className="py-8 text-center text-text-muted">
              <RotateCcw className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>暂无遥测数据，无法进行回放</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border-dark">
            <h3 className="font-semibold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan" />
              巡检轨迹
            </h3>
          </div>
          <div className="h-80">
            <MapComponent center={mapCenter} zoom={14}>
              {/* Line Geometry */}
              {task.line_data?.coordinates && task.line_data.coordinates.length > 1 && (
                <Polyline
                  positions={task.line_data.coordinates.map((c) => [c[1], c[0]] as [number, number])}
                  color="#F5B301"
                  weight={4}
                  opacity={0.6}
                  dashArray="12, 12"
                >
                  <Tooltip direction="top">
                    <span className="text-xs font-medium">{task.line_data.name}</span>
                  </Tooltip>
                </Polyline>
              )}

              {/* Route Geometry */}
              {task.route_data?.coordinates && task.route_data.coordinates.length > 1 && (
                <Polyline
                  positions={task.route_data.coordinates.map((c) => [c[1], c[0]] as [number, number])}
                  color="#22D3EE"
                  weight={3}
                  opacity={0.9}
                >
                  <Tooltip direction="top">
                    <span className="text-xs font-medium">{task.route_data.name}</span>
                  </Tooltip>
                </Polyline>
              )}

              {/* Section markers */}
              {task.sections_data?.map((section) => (
                <CircleMarker
                  key={`section-${section.id}`}
                  center={mapCenter}
                  radius={1}
                  opacity={0}
                >
                  <Popup>
                    <div className="text-xs">
                      <p className="font-medium text-amber">区域: {section.name}</p>
                      <p className="text-text-muted">里程: {section.start_km} - {section.end_km} km</p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

              {/* Tower markers */}
              {task.towers_data?.map((tower) =>
                tower.coordinates && (
                  <CircleMarker
                    key={`tower-${tower.id}`}
                    center={[tower.coordinates.lat, tower.coordinates.lon]}
                    radius={6}
                    fillColor="#F5B301"
                    color="#F5B301"
                    weight={2}
                    opacity={1}
                    fillOpacity={0.8}
                  >
                    <Tooltip direction="top" offset={[0, -8]}>
                      <div className="text-xs">
                        <p className="font-medium">{tower.code}</p>
                        <p className="text-text-muted">高度: {tower.height}m</p>
                        <p className="text-text-muted">类型: {tower.tower_type_display}</p>
                        {tower.section_name && (
                          <p className="text-text-muted">区域: {tower.section_name}</p>
                        )}
                      </div>
                    </Tooltip>
                  </CircleMarker>
                )
              )}

              {/* Media markers */}
              {mediaList.map((media) =>
                media.coordinates && (
                  <CircleMarker
                    key={`media-${media.id}`}
                    center={[media.coordinates.lat, media.coordinates.lon]}
                    radius={media.has_defect ? 7 : 5}
                    fillColor={media.has_defect ? '#FF4D4F' : '#52C41A'}
                    color={media.has_defect ? '#FF4D4F' : '#52C41A'}
                    weight={2}
                    opacity={1}
                    fillOpacity={0.8}
                  >
                    <Tooltip direction="top" offset={[0, -5]}>
                      <span className="text-xs">
                        {media.tower_code || '影像'}{' '}
                        {media.has_defect && `· ${media.defect_count}缺陷`}
                      </span>
                    </Tooltip>
                  </CircleMarker>
                )
              )}

              {/* Replay drone marker and trail */}
              {showReplayControls && telemetries.length > 0 && (
                <>
                  {/* Trail */}
                  {replayIndex > 0 && (
                    <Polyline
                      positions={telemetries
                        .slice(0, replayIndex + 1)
                        .map((t) => [t.latitude, t.longitude] as [number, number])}
                      color="#22D3EE"
                      weight={3}
                      opacity={0.6}
                      dashArray="5, 5"
                    />
                  )}

                  {/* Drone marker */}
                  {currentTelemetry && (
                    <CircleMarker
                      center={[currentTelemetry.latitude, currentTelemetry.longitude]}
                      radius={12}
                      fillColor="#22D3EE"
                      color="white"
                      weight={3}
                      opacity={1}
                      fillOpacity={0.9}
                    >
                      <Popup>
                        <div className="text-xs space-y-1">
                          <p className="font-medium text-cyan">{task.drone_name}</p>
                          <p className="text-text-muted">
                            时间: {dayjs(currentTelemetry.report_time).format('HH:mm:ss')}
                          </p>
                          <p className="text-text-muted">
                            速度: {currentTelemetry.speed.toFixed(1)} m/s
                          </p>
                          <p className="text-text-muted">
                            高度: {currentTelemetry.altitude.toFixed(1)} m
                          </p>
                          <p className="text-text-muted">
                            电量: {currentTelemetry.battery}%
                          </p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  )}
                </>
              )}

              {/* Route waypoints */}
              {task.route_data?.waypoints_data?.map((wp, idx) =>
                wp.lon && wp.lat && (
                  <CircleMarker
                    key={`waypoint-${idx}`}
                    center={[wp.lat, wp.lon]}
                    radius={4}
                    fillColor="#9333EA"
                    color="#9333EA"
                    weight={2}
                    opacity={0.7}
                    fillOpacity={0.5}
                  >
                    <Tooltip direction="top">
                      <span className="text-xs">航点 #{idx + 1}</span>
                    </Tooltip>
                  </CircleMarker>
                )
              )}
            </MapComponent>
          </div>
        </div>

        {/* Tabs panel */}
        <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden flex flex-col">
          <div className="flex border-b border-border-dark">
            <button
              onClick={() => setActiveTab('media')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'media'
                  ? 'text-cyan border-b-2 border-cyan bg-cyan/5'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <FileImage className="w-4 h-4 inline mr-2" />
              影像 ({mediaList.length})
            </button>
            <button
              onClick={() => setActiveTab('defects')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'defects'
                  ? 'text-cyan border-b-2 border-cyan bg-cyan/5'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              缺陷 ({defects.length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {activeTab === 'media' && (
              <div className="grid grid-cols-2 gap-2">
                {mediaList.map((media) => (
                  <div
                    key={media.id}
                    className="relative aspect-square bg-bg-card rounded-lg overflow-hidden cursor-pointer group"
                  >
                    <img
                      src={media.thumbnail_url || media.file_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    {media.has_defect && (
                      <div className="absolute top-1 right-1">
                      <Badge variant="danger" size="sm">
                        {media.defect_count}
                      </Badge>
                    </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-xs text-white truncate">
                        {media.tower_code || '影像'}{' '}
                      </p>
                    </div>
                  </div>
                ))}
                {mediaList.length === 0 && (
                  <div className="col-span-2 p-8 text-center text-text-muted text-sm">
                  暂无影像数据
                </div>
                )}
              </div>
            )}

            {activeTab === 'defects' && (
              <div className="space-y-2">
                {defects.map((defect) => (
                  <div
                    key={defect.id}
                    className="p-3 bg-bg-card rounded-lg cursor-pointer hover:bg-bg-card/80 transition-colors"
                    onClick={() => navigate(`/defects/${defect.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {defect.defect_type_display} - {defect.subtype}
                      </span>
                      <Badge
                        variant={
                          defect.severity === 'critical'
                            ? 'danger'
                            : defect.severity === 'major'
                            ? 'warning'
                            : 'amber'
                        }
                        size="sm"
                      >
                        {defect.severity_display}
                      </Badge>
                    </div>
                    <div className="text-xs text-text-muted">
                      {defect.tower_code} · 置信度 {defect.confidence}
                    </div>
                  </div>
                ))}
                {defects.length === 0 && (
                  <div className="p-8 text-center text-text-muted text-sm">
                    暂无缺陷数据
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task info */}
      <div className="bg-bg-panel border border-border-dark rounded-xl p-5">
        <h3 className="font-semibold mb-4">任务信息</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-text-muted mb-1">开始时间</p>
            <p>{task.started_at ? dayjs(task.started_at).format('YYYY-MM-DD HH:mm') : '-'}</p>
          </div>
          <div>
            <p className="text-text-muted mb-1">结束时间</p>
            <p>{task.ended_at ? dayjs(task.ended_at).format('YYYY-MM-DD HH:mm') : '-'}</p>
          </div>
          <div>
            <p className="text-text-muted mb-1">创建时间</p>
            <p>{dayjs(task.created_at).format('YYYY-MM-DD HH:mm')}</p>
          </div>
          <div>
            <p className="text-text-muted mb-1">备注</p>
            <p>{task.notes || '-'}</p>
          </div>
        </div>

        {/* Route and Line info */}
        {task.route_data && (
          <div className="mt-4 pt-4 border-t border-border-dark">
            <h4 className="font-medium mb-3 text-cyan">航线信息</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-text-muted mb-1">航线名称</p>
                <p>{task.route_data.name}</p>
              </div>
              <div>
                <p className="text-text-muted mb-1">航线长度</p>
                <p className="font-mono">{task.route_data.distance.toFixed(0)} 米</p>
              </div>
              <div>
                <p className="text-text-muted mb-1">预计时长</p>
                <p>{task.route_data.estimated_duration} 分钟</p>
              </div>
              <div>
                <p className="text-text-muted mb-1">飞行高度</p>
                <p>{task.route_data.altitude} 米</p>
              </div>
            </div>
          </div>
        )}

        {task.line_data && (
          <div className="mt-4 pt-4 border-t border-border-dark">
            <h4 className="font-medium mb-3 text-amber">线路信息</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-text-muted mb-1">线路名称</p>
                <p>{task.line_data.name}</p>
              </div>
              <div>
                <p className="text-text-muted mb-1">电压等级</p>
                <p>{task.line_data.voltage_display}</p>
              </div>
              <div>
                <p className="text-text-muted mb-1">关联杆塔</p>
                <p>{task.towers_data?.length || 0} 基</p>
              </div>
              <div>
                <p className="text-text-muted mb-1">关联区域</p>
                <p>{task.sections_data?.length || 0} 个</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ChevronRight(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
