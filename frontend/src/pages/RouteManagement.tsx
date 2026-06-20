import { useState, useEffect, useMemo, useCallback } from 'react'
import { routesApi, linesApi, towersApi, sectionsApi } from '../services/api'
import type { FlightRoute, Line, Tower, Section, RouteValidation, EditableWaypoint, RouteVersion } from '../types'
import RouteEditor from '../components/RouteEditor'
import Badge from '../components/Badge'
import Modal, { FormField, inputClass, selectClass, textareaClass } from '../components/Modal'
import {
  Route,
  Plus,
  Edit,
  Trash2,
  Mountain,
  Gauge,
  Ruler,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  History,
  Play,
  Pause,
  RotateCcw,
  Eye,
  AlertTriangle,
  Zap,
  Layers,
  MapPin,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react'
import dayjs from 'dayjs'
import {
  calculateTotalDistance,
  calculateDuration,
  validateAltitude,
  validateSpeed,
  validateLon,
  validateLat,
  isAdmin,
} from '../utils'
import { useAuthStore } from '../store/authStore'

const ROUTE_STATUS_OPTIONS = [
  { value: 'draft', label: '草稿' },
  { value: 'pending_review', label: '待审核' },
  { value: 'approved', label: '已审批' },
  { value: 'rejected', label: '已驳回' },
  { value: 'archived', label: '已归档' },
]

const statusColors: Record<string, string> = {
  draft: 'amber',
  pending_review: 'warning',
  approved: 'success',
  rejected: 'danger',
  archived: 'default',
}

export default function RouteManagement() {
  const { user } = useAuthStore()
  const [routes, setRoutes] = useState<FlightRoute[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [towers, setTowers] = useState<Tower[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [selectedRoute, setSelectedRoute] = useState<FlightRoute | null>(null)
  const [routeDetail, setRouteDetail] = useState<FlightRoute | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingRoute, setEditingRoute] = useState<FlightRoute | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FlightRoute | null>(null)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve')
  const [reviewNote, setReviewNote] = useState('')
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [routeVersions, setRouteVersions] = useState<RouteVersion[]>([])
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [simulationPlaying, setSimulationPlaying] = useState(false)
  const [simulationProgress, setSimulationProgress] = useState(0)
  const [simulationSpeed, setSimulationSpeed] = useState(1)
  const [showTowers, setShowTowers] = useState(true)
  const [showSections, setShowSections] = useState(true)
  const [expandedSection, setExpandedSection] = useState<string | null>('info')

  const [form, setForm] = useState({
    name: '',
    line: '' as number | string,
    altitude: 50,
    speed: 8,
    description: '',
    waypoints: [] as EditableWaypoint[],
  })

  const [waypointErrors, setWaypointErrors] = useState<string[]>([])

  const altitudeValidation = useMemo(() => validateAltitude(form.altitude), [form.altitude])
  const speedValidation = useMemo(() => validateSpeed(form.speed), [form.speed])
  const calculatedDistance = useMemo(
    () => calculateTotalDistance(form.waypoints.map((wp) => ({ lat: wp.lat, lon: wp.lon }))),
    [form.waypoints]
  )
  const calculatedDuration = useMemo(
    () => calculateDuration(calculatedDistance, form.speed),
    [calculatedDistance, form.speed]
  )

  const canEdit = isAdmin(user)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [routesRes, linesRes, towersRes, sectionsRes] = await Promise.all([
        routesApi.list({ page_size: 50 }),
        linesApi.list({ page_size: 50 }),
        towersApi.list({ page_size: 200 }),
        sectionsApi.list({ page_size: 50 }),
      ])
      const routesData = routesRes.data.results || routesRes.data
      setRoutes(routesData)
      setLines(linesRes.data.results || linesRes.data)
      setTowers(towersRes.data.results || towersRes.data)
      setSections(sectionsRes.data.results || sectionsRes.data)
      if (routesData.length > 0 && !selectedRoute) {
        setSelectedRoute(routesData[0])
        loadRouteDetail(routesData[0].id)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadRouteDetail = async (id: number) => {
    try {
      const [routeRes, tsRes] = await Promise.all([
        routesApi.get(id),
        routesApi.getTowersAndSections(id),
      ])
      const routeData = {
        ...routeRes.data,
        nearby_towers: tsRes.data.towers || [],
        affected_sections: tsRes.data.sections || [],
      }
      setRouteDetail(routeData)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSelectRoute = async (route: FlightRoute) => {
    setSelectedRoute(route)
    await loadRouteDetail(route.id)
  }

  const openCreate = () => {
    setEditingRoute(null)
    setForm({
      name: '',
      line: lines.length > 0 ? lines[0].id : '',
      altitude: 50,
      speed: 8,
      description: '',
      waypoints: [],
    })
    setWaypointErrors([])
    setModalOpen(true)
  }

  const openEdit = (route: FlightRoute) => {
    setEditingRoute(route)
    const waypoints: EditableWaypoint[] = (route.coordinates || []).map((coord, idx) => ({
      lon: coord[0],
      lat: coord[1],
      index: idx,
    }))
    setForm({
      name: route.name,
      line: route.line,
      altitude: route.altitude,
      speed: route.speed,
      description: route.description || '',
      waypoints,
    })
    setWaypointErrors([])
    setModalOpen(true)
  }

  const handleWaypointsChange = (waypoints: EditableWaypoint[]) => {
    setForm({ ...form, waypoints })
  }

  const handleValidationError = (errors: string[]) => {
    setWaypointErrors(errors)
  }

  const validateForm = (): boolean => {
    if (!form.name.trim()) {
      alert('请输入航线名称')
      return false
    }
    if (!form.line) {
      alert('请选择所属线路')
      return false
    }
    if (waypointErrors.length > 0) {
      alert(`航点存在 ${waypointErrors.length} 个错误，请修正后再保存`)
      return false
    }
    if (form.waypoints.length < 2) {
      alert('至少需要2个航点')
      return false
    }
    return true
  }

  const handleSave = async () => {
    if (!validateForm()) return
    setSubmitting(true)
    try {
      const waypoints_list = form.waypoints.map((wp) => [wp.lon, wp.lat])
      const data: any = {
        name: form.name,
        line: Number(form.line),
        altitude: Number(form.altitude),
        speed: Number(form.speed),
        estimated_duration: calculatedDuration,
        distance: calculatedDistance,
        description: form.description,
        waypoints_list,
      }

      if (editingRoute) {
        await routesApi.update(editingRoute.id, data)
      } else {
        await routesApi.create(data)
      }
      setModalOpen(false)
      await loadData()
    } catch (e: any) {
      console.error(e)
      const errorMsg = e.response?.data?.detail || e.response?.data?.message || '保存失败'
      alert(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSubmitting(true)
    try {
      await routesApi.delete(deleteTarget.id)
      if (selectedRoute?.id === deleteTarget.id) {
        setSelectedRoute(null)
        setRouteDetail(null)
      }
      setDeleteTarget(null)
      await loadData()
    } catch (e: any) {
      console.error(e)
      const errorMsg = e.response?.data?.detail || e.response?.data?.message || '删除失败'
      alert(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitReview = async () => {
    if (!selectedRoute) return
    try {
      await routesApi.submitReview(selectedRoute.id)
      await loadData()
      alert('已提交审核')
    } catch (e: any) {
      console.error(e)
      const errorMsg = e.response?.data?.error || e.response?.data?.detail || '提交失败'
      alert(errorMsg)
    }
  }

  const openReview = (action: 'approve' | 'reject') => {
    setReviewAction(action)
    setReviewNote('')
    setReviewModalOpen(true)
  }

  const handleReview = async () => {
    if (!selectedRoute) return
    if (reviewAction === 'reject' && !reviewNote.trim()) {
      alert('请填写驳回原因')
      return
    }
    try {
      if (reviewAction === 'approve') {
        await routesApi.approve(selectedRoute.id, reviewNote)
      } else {
        await routesApi.reject(selectedRoute.id, reviewNote)
      }
      setReviewModalOpen(false)
      await loadData()
      alert(reviewAction === 'approve' ? '审核通过' : '已驳回')
    } catch (e: any) {
      console.error(e)
      const errorMsg = e.response?.data?.error || e.response?.data?.detail || '操作失败'
      alert(errorMsg)
    }
  }

  const openHistory = async () => {
    if (!selectedRoute) return
    try {
      const res = await routesApi.getVersions(selectedRoute.id)
      setRouteVersions(res.data)
      setHistoryModalOpen(true)
    } catch (e) {
      console.error(e)
    }
  }

  const openPreview = () => {
    setSimulationProgress(0)
    setSimulationPlaying(false)
    setPreviewModalOpen(true)
  }

  const toggleSimulation = useCallback(() => {
    setSimulationPlaying((prev) => !prev)
  }, [])

  const resetSimulation = () => {
    setSimulationProgress(0)
    setSimulationPlaying(false)
  }

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (simulationPlaying && simulationProgress < 100) {
      const baseStep = 0.3
      const step = baseStep * simulationSpeed
      interval = setInterval(() => {
        setSimulationProgress((prev) => {
          const next = prev + step
          if (next >= 100) {
            setSimulationPlaying(false)
            return 100
          }
          return next
        })
      }, 50)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [simulationPlaying, simulationProgress, simulationSpeed])

  const towerPoints = useMemo(() => {
    if (!routeDetail?.nearby_towers) return []
    return routeDetail.nearby_towers
      .filter((t) => t.coordinates)
      .map((t) => ({
        lat: t.coordinates!.lat,
        lon: t.coordinates!.lon,
        code: t.code,
      }))
  }, [routeDetail])

  const sectionLines = useMemo(() => {
    if (!routeDetail?.affected_sections) return []
    return routeDetail.affected_sections.map((s) => {
      const sectionTowers = routeDetail.nearby_towers?.filter(
        (t) => t.section === s.id && t.coordinates
      ) || []
      const positions = sectionTowers
        .sort((a, b) => a.sequence - b.sequence)
        .map((t) => [t.coordinates!.lat, t.coordinates!.lon] as [number, number])
      return {
        positions,
        name: s.name,
      }
    }).filter((s) => s.positions.length >= 2)
  }, [routeDetail])

  const editorWaypoints = useMemo(() => {
    if (!routeDetail?.coordinates) return []
    return routeDetail.coordinates.map((coord, idx) => ({
      lon: coord[0],
      lat: coord[1],
      index: idx,
    }))
  }, [routeDetail])

  const previewWaypoints = useMemo(() => {
    if (!routeDetail?.coordinates) return []
    return routeDetail.coordinates.map((coord, idx) => ({
      lon: coord[0],
      lat: coord[1],
      index: idx,
    }))
  }, [routeDetail])

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">无人机航线管理</h2>
          <p className="text-text-muted text-sm mt-1">共 {routes.length} 条航线</p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建航线
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border-dark">
            <h3 className="font-semibold flex items-center gap-2">
              <Route className="w-5 h-5 text-cyan" />
              航线列表
            </h3>
          </div>
          <div className="divide-y divide-border-dark max-h-[calc(100vh-20rem)] overflow-y-auto">
            {routes.map((route) => (
              <div
                key={route.id}
                onClick={() => handleSelectRoute(route)}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedRoute?.id === route.id
                    ? 'bg-cyan/10 border-l-2 border-cyan'
                    : 'hover:bg-white/5 border-l-2 border-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{route.name}</span>
                  <Badge variant={statusColors[route.status] as any} size="sm">
                    {route.status_display}
                  </Badge>
                </div>
                <div className="text-sm text-text-muted mb-2">{route.line_name}</div>
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Mountain className="w-3 h-3" />
                      {route.waypoint_count} 航点
                    </span>
                    <span className="flex items-center gap-1">
                      <Ruler className="w-3 h-3" />
                      {((route.distance || 0) / 1000).toFixed(2)} km
                    </span>
                  </div>
                  <span className="text-amber/60">v{route.version}</span>
                </div>
              </div>
            ))}
            {routes.length === 0 && (
              <div className="p-8 text-center text-text-muted text-sm">
                <Route className="w-10 h-10 mx-auto mb-2 opacity-40" />
                暂无航线，点击"新建航线"创建
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border-dark flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Eye className="w-5 h-5 text-cyan" />
                航线预览
                {selectedRoute && <span className="text-sm text-text-muted font-normal">- {selectedRoute.name}</span>}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTowers(!showTowers)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                    showTowers ? 'bg-purple/20 text-purple-400' : 'bg-white/5 text-text-muted hover:text-text-primary'
                  }`}
                >
                  <MapPin className="w-3 h-3" />
                  杆塔
                </button>
                <button
                  onClick={() => setShowSections(!showSections)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                    showSections ? 'bg-purple/20 text-purple-400' : 'bg-white/5 text-text-muted hover:text-text-primary'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  区段
                </button>
                {selectedRoute && selectedRoute.waypoint_count >= 2 && (
                  <button
                    onClick={openPreview}
                    className="px-3 py-1.5 bg-amber/20 text-amber rounded-lg text-xs font-medium hover:bg-amber/30 transition-colors flex items-center gap-1"
                  >
                    <Play className="w-3 h-3" />
                    模拟飞行
                  </button>
                )}
              </div>
            </div>
            <div className="h-80">
              {selectedRoute ? (
                <RouteEditor
                  waypoints={editorWaypoints}
                  onChange={() => {}}
                  showTowers={showTowers}
                  towerPoints={towerPoints}
                  showSections={showSections}
                  sectionLines={sectionLines}
                  editMode={false}
                  readOnly
                  center={
                    selectedRoute.coordinates?.[0]
                      ? [selectedRoute.coordinates[0][1], selectedRoute.coordinates[0][0]]
                      : [39.91, 116.47]
                  }
                  zoom={13}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-text-muted">
                  请选择一条航线查看预览
                </div>
              )}
            </div>
          </div>

          {routeDetail && (
            <div className="space-y-4">
              <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleSection('info')}
                  className="w-full px-5 py-4 border-b border-border-dark flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="w-5 h-5 text-cyan" />
                    航线详情
                  </h3>
                  {expandedSection === 'info' ? (
                    <ChevronUp className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  )}
                </button>
                {expandedSection === 'info' && (
                  <div className="p-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-bg-card rounded-lg p-4">
                        <p className="text-text-muted text-xs mb-1">飞行高度</p>
                        <div className="flex items-center gap-2">
                          <p
                            className={`font-display text-xl ${
                              routeDetail.altitude_validation?.valid ? 'text-cyan' : 'text-danger'
                            }`}
                          >
                            {routeDetail.altitude}
                            <span className="text-sm text-text-muted ml-1">m</span>
                          </p>
                          {!routeDetail.altitude_validation?.valid && (
                            <AlertTriangle className="w-4 h-4 text-danger" />
                          )}
                        </div>
                        {!routeDetail.altitude_validation?.valid && (
                          <p className="text-xs text-danger mt-1">
                            {routeDetail.altitude_validation?.message}
                          </p>
                        )}
                      </div>
                      <div className="bg-bg-card rounded-lg p-4">
                        <p className="text-text-muted text-xs mb-1">飞行速度</p>
                        <div className="flex items-center gap-2">
                          <p
                            className={`font-display text-xl ${
                              routeDetail.speed_validation?.valid ? 'text-amber' : 'text-danger'
                            }`}
                          >
                            {routeDetail.speed}
                            <span className="text-sm text-text-muted ml-1">m/s</span>
                          </p>
                          {!routeDetail.speed_validation?.valid && (
                            <AlertTriangle className="w-4 h-4 text-danger" />
                          )}
                        </div>
                        {!routeDetail.speed_validation?.valid && (
                          <p className="text-xs text-danger mt-1">
                            {routeDetail.speed_validation?.message}
                          </p>
                        )}
                      </div>
                      <div className="bg-bg-card rounded-lg p-4">
                        <p className="text-text-muted text-xs mb-1">航线长度</p>
                        <p className="font-display text-xl text-success">
                          {(routeDetail.distance / 1000).toFixed(2)}
                          <span className="text-sm text-text-muted ml-1">km</span>
                        </p>
                      </div>
                      <div className="bg-bg-card rounded-lg p-4">
                        <p className="text-text-muted text-xs mb-1">预计时长</p>
                        <p className="font-display text-xl text-warning">
                          {routeDetail.estimated_duration}
                          <span className="text-sm text-text-muted ml-1">分钟</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <Badge variant={statusColors[routeDetail.status] as any} size="md">
                        {routeDetail.status_display}
                      </Badge>
                      <span className="text-sm text-text-muted">版本 v{routeDetail.version}</span>
                      <span className="text-sm text-text-muted">
                        航点: {routeDetail.waypoint_count} 个
                      </span>
                      {routeDetail.reviewed_by_name && (
                        <span className="text-sm text-text-muted">
                          审核人: {routeDetail.reviewed_by_name}
                        </span>
                      )}
                    </div>

                    {routeDetail.review_note && (
                      <div className="bg-bg-card rounded-lg p-3 mb-4">
                        <p className="text-xs text-text-muted mb-1">审核意见</p>
                        <p className="text-sm">{routeDetail.review_note}</p>
                      </div>
                    )}

                    <p className="text-text-muted text-sm mb-2">
                      {routeDetail.description || '暂无描述'}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-text-muted">
                      <span>创建人: {routeDetail.created_by_name || '-'}</span>
                      <span>创建时间: {dayjs(routeDetail.created_at).format('YYYY-MM-DD HH:mm')}</span>
                      {routeDetail.reviewed_at && (
                        <span>审核时间: {dayjs(routeDetail.reviewed_at).format('YYYY-MM-DD HH:mm')}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {routeDetail.nearby_towers && routeDetail.nearby_towers.length > 0 && (
                <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleSection('towers')}
                    className="w-full px-5 py-4 border-b border-border-dark flex items-center justify-between hover:bg-white/5 transition-colors"
                  >
                    <h3 className="font-semibold flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-purple-400" />
                      航线经过杆塔
                      <Badge variant="purple" size="sm">
                        {routeDetail.nearby_towers.length} 基
                      </Badge>
                    </h3>
                    {expandedSection === 'towers' ? (
                      <ChevronUp className="w-4 h-4 text-text-muted" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-text-muted" />
                    )}
                  </button>
                  {expandedSection === 'towers' && (
                    <div className="p-5">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {routeDetail.nearby_towers.map((tower) => (
                          <div
                            key={tower.id}
                            className="bg-bg-card rounded-lg p-3 border border-border-dark hover:border-purple/50 transition-colors"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <MapPin className="w-4 h-4 text-purple-400" />
                              <span className="font-medium text-sm">{tower.code}</span>
                            </div>
                            <div className="text-xs text-text-muted space-y-1">
                              <p>区段: {tower.section_name || '-'}</p>
                              <p>高度: {tower.height}m</p>
                              <p>类型: {tower.tower_type_display || tower.tower_type}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {routeDetail.affected_sections && routeDetail.affected_sections.length > 0 && (
                <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleSection('sections')}
                    className="w-full px-5 py-4 border-b border-border-dark flex items-center justify-between hover:bg-white/5 transition-colors"
                  >
                    <h3 className="font-semibold flex items-center gap-2">
                      <Layers className="w-5 h-5 text-purple-400" />
                      航线经过区段
                      <Badge variant="purple" size="sm">
                        {routeDetail.affected_sections.length} 个
                      </Badge>
                    </h3>
                    {expandedSection === 'sections' ? (
                      <ChevronUp className="w-4 h-4 text-text-muted" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-text-muted" />
                    )}
                  </button>
                  {expandedSection === 'sections' && (
                    <div className="p-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {routeDetail.affected_sections.map((section) => (
                          <div
                            key={section.id}
                            className="bg-bg-card rounded-lg p-3 border border-border-dark hover:border-purple/50 transition-colors"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Layers className="w-4 h-4 text-purple-400" />
                              <span className="font-medium text-sm">{section.name}</span>
                            </div>
                            <div className="text-xs text-text-muted">
                              <p>
                                公里标: {section.start_km}km - {section.end_km}km
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {canEdit && selectedRoute && (
                <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
                  <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-semibold">操作</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      {(selectedRoute.status === 'draft' || selectedRoute.status === 'rejected') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSubmitReview()
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-warning text-bg-dark font-medium rounded-lg hover:bg-warning/90 transition-colors text-sm"
                        >
                          <Send className="w-4 h-4" />
                          提交审核
                        </button>
                      )}
                      {selectedRoute.status === 'pending_review' && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openReview('approve')
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-success text-bg-dark font-medium rounded-lg hover:bg-success/90 transition-colors text-sm"
                          >
                            <CheckCircle className="w-4 h-4" />
                            审核通过
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openReview('reject')
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-danger text-white font-medium rounded-lg hover:bg-danger/90 transition-colors text-sm"
                          >
                            <XCircle className="w-4 h-4" />
                            驳回
                          </button>
                        </>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openHistory()
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-bg-card border border-border-dark rounded-lg hover:bg-white/5 transition-colors text-sm"
                      >
                        <History className="w-4 h-4" />
                        版本记录
                      </button>
                      {selectedRoute.status !== 'pending_review' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openEdit(selectedRoute)
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-bg-card border border-border-dark rounded-lg hover:bg-white/5 transition-colors text-sm"
                        >
                          <Edit className="w-4 h-4" />
                          编辑
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteTarget(selectedRoute)
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-bg-card border border-border-dark rounded-lg hover:bg-danger/10 hover:text-danger transition-colors text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRoute ? '编辑航线' : '新建航线'}
        width="max-w-6xl"
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={
                submitting ||
                !form.name.trim() ||
                !form.line ||
                waypointErrors.length > 0 ||
                form.waypoints.length < 2
              }
              className="px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors text-sm disabled:opacity-50"
            >
              {submitting ? '保存中...' : '保存'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <FormField label="航线名称" required>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="请输入航线名称"
                className={inputClass}
              />
            </FormField>
            <FormField label="所属线路" required>
              <select
                value={form.line}
                onChange={(e) => setForm({ ...form, line: Number(e.target.value) })}
                className={selectClass}
              >
                <option value="">请选择线路</option>
                {lines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.name}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="飞行高度(m)">
                <div>
                  <input
                    type="number"
                    value={form.altitude}
                    onChange={(e) => setForm({ ...form, altitude: Number(e.target.value) })}
                    className={inputClass}
                  />
                  {!altitudeValidation.valid && (
                    <p className="text-xs text-danger mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {altitudeValidation.message}
                    </p>
                  )}
                  {altitudeValidation.valid && (
                    <p className="text-xs text-success mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {altitudeValidation.message}
                    </p>
                  )}
                </div>
              </FormField>
              <FormField label="飞行速度(m/s)">
                <div>
                  <input
                    type="number"
                    step="0.1"
                    value={form.speed}
                    onChange={(e) => setForm({ ...form, speed: Number(e.target.value) })}
                    className={inputClass}
                  />
                  {!speedValidation.valid && (
                    <p className="text-xs text-danger mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {speedValidation.message}
                    </p>
                  )}
                  {speedValidation.valid && (
                    <p className="text-xs text-success mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {speedValidation.message}
                    </p>
                  )}
                </div>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-bg-card rounded-lg p-4">
                <p className="text-text-muted text-xs mb-1 flex items-center gap-1">
                  <Ruler className="w-3 h-3" />
                  计算航线长度
                </p>
                <p className="font-display text-xl text-cyan">
                  {(calculatedDistance / 1000).toFixed(2)}
                  <span className="text-sm text-text-muted ml-1">km</span>
                </p>
              </div>
              <div className="bg-bg-card rounded-lg p-4">
                <p className="text-text-muted text-xs mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  预计时长
                </p>
                <p className="font-display text-xl text-amber">
                  {calculatedDuration}
                  <span className="text-sm text-text-muted ml-1">分钟</span>
                </p>
              </div>
            </div>
            <FormField label="描述">
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="请输入航线描述"
                rows={2}
                className={textareaClass}
              />
            </FormField>

            <div className="bg-bg-card rounded-lg p-4">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan" />
                实时校验
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">航点数量</span>
                  {form.waypoints.length >= 2 ? (
                    <span className="text-success flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      {form.waypoints.length} 个（已满足≥2）
                    </span>
                  ) : (
                    <span className="text-danger flex items-center gap-1">
                      <XCircle className="w-4 h-4" />
                      {form.waypoints.length} 个（需要≥2）
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">高度校验</span>
                  {altitudeValidation.valid ? (
                    <span className="text-success flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      通过
                    </span>
                  ) : (
                    <span className="text-danger flex items-center gap-1">
                      <XCircle className="w-4 h-4" />
                      不通过
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">速度校验</span>
                  {speedValidation.valid ? (
                    <span className="text-success flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      通过
                    </span>
                  ) : (
                    <span className="text-danger flex items-center gap-1">
                      <XCircle className="w-4 h-4" />
                      不通过
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">坐标格式</span>
                  {waypointErrors.length === 0 ? (
                    <span className="text-success flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      通过
                    </span>
                  ) : (
                    <span className="text-danger flex items-center gap-1">
                      <XCircle className="w-4 h-4" />
                      {waypointErrors.length} 个错误
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="h-[600px]">
            <RouteEditor
              waypoints={form.waypoints}
              onChange={handleWaypointsChange}
              onValidationError={handleValidationError}
              editMode
              center={[39.91, 116.47]}
              zoom={13}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title={reviewAction === 'approve' ? '审核通过' : '驳回航线'}
        width="max-w-md"
        footer={
          <>
            <button
              onClick={() => setReviewModalOpen(false)}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              取消
            </button>
            <button
              onClick={handleReview}
              disabled={submitting || (reviewAction === 'reject' && !reviewNote.trim())}
              className={`px-4 py-2 font-medium rounded-lg transition-colors text-sm disabled:opacity-50 ${
                reviewAction === 'approve'
                  ? 'bg-success text-bg-dark hover:bg-success/90'
                  : 'bg-danger text-white hover:bg-danger/90'
              }`}
            >
              {submitting ? '处理中...' : reviewAction === 'approve' ? '确认通过' : '确认驳回'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {reviewAction === 'approve' ? (
            <p className="text-text-secondary">确定要通过航线 "{selectedRoute?.name}" 的审核吗？</p>
          ) : (
            <p className="text-text-secondary">
              确定要驳回航线 "{selectedRoute?.name}" 吗？请填写驳回原因。
            </p>
          )}
          <FormField label={reviewAction === 'approve' ? '审核意见（可选）' : '驳回原因（必填）'}>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder={
                reviewAction === 'approve' ? '请输入审核意见...' : '请输入驳回原因...'
              }
              rows={3}
              className={textareaClass}
            />
          </FormField>
        </div>
      </Modal>

      <Modal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`${selectedRoute?.name} - 版本记录`}
        width="max-w-4xl"
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {routeVersions.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无版本记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {routeVersions.map((version) => (
                <div
                  key={version.id}
                  className="bg-bg-card rounded-lg p-4 border border-border-dark"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-cyan/20 flex items-center justify-center">
                        <span className="text-cyan font-bold">v{version.version}</span>
                      </div>
                      <div>
                        <h4 className="font-medium">{version.name}</h4>
                        <p className="text-xs text-text-muted">
                          {version.created_by_name} · {dayjs(version.created_at).format('YYYY-MM-DD HH:mm')}
                        </p>
                      </div>
                    </div>
                    <Badge variant={statusColors[version.status] as any} size="sm">
                      {version.status_display}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-text-muted text-xs">高度</p>
                      <p>{version.altitude} m</p>
                    </div>
                    <div>
                      <p className="text-text-muted text-xs">速度</p>
                      <p>{version.speed} m/s</p>
                    </div>
                    <div>
                      <p className="text-text-muted text-xs">长度</p>
                      <p>{(version.distance / 1000).toFixed(2)} km</p>
                    </div>
                    <div>
                      <p className="text-text-muted text-xs">航点</p>
                      <p>{version.waypoint_count} 个</p>
                    </div>
                  </div>
                  {version.description && (
                    <p className="text-sm text-text-muted mt-2">{version.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={previewModalOpen}
        onClose={() => {
          setPreviewModalOpen(false)
          setSimulationPlaying(false)
          setSimulationProgress(0)
        }}
        title={`${selectedRoute?.name} - 模拟飞行`}
        width="max-w-5xl"
        footer={
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">速度:</span>
              {[0.5, 1, 2, 5].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setSimulationSpeed(speed)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    simulationSpeed === speed
                      ? 'bg-cyan text-bg-dark'
                      : 'bg-bg-card text-text-secondary hover:text-text-primary border border-border-dark'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={resetSimulation}
                className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors text-sm flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                重置
              </button>
              <button
                onClick={toggleSimulation}
                className="px-4 py-2 bg-amber text-bg-dark font-medium rounded-lg hover:bg-amber/90 transition-colors text-sm flex items-center gap-2"
              >
                {simulationPlaying ? (
                  <>
                    <Pause className="w-4 h-4" />
                    暂停
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    {simulationProgress === 100 ? '重新播放' : '开始模拟'}
                  </>
                )}
              </button>
            </div>
          </>
        }
      >
        <div className="relative h-[500px]">
          <div className="absolute top-4 right-4 z-[500] flex gap-2">
            <button
              onClick={() => setShowTowers(!showTowers)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 backdrop-blur ${
                showTowers
                  ? 'bg-purple-500/80 text-white'
                  : 'bg-bg-panel/80 text-text-muted hover:text-text-primary border border-border-dark'
              }`}
            >
              <MapPin className="w-3 h-3" />
              杆塔
            </button>
            <button
              onClick={() => setShowSections(!showSections)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 backdrop-blur ${
                showSections
                  ? 'bg-purple-500/80 text-white'
                  : 'bg-bg-panel/80 text-text-muted hover:text-text-primary border border-border-dark'
              }`}
            >
              <Layers className="w-3 h-3" />
              区段
            </button>
          </div>
          <RouteEditor
            waypoints={previewWaypoints}
            onChange={() => {}}
            showTowers={showTowers}
            towerPoints={towerPoints}
            showSections={showSections}
            sectionLines={sectionLines}
            editMode={false}
            readOnly
            simulationMode
            simulationProgress={simulationProgress}
            center={
              routeDetail?.coordinates?.[0]
                ? [routeDetail.coordinates[0][1], routeDetail.coordinates[0][0]]
                : [39.91, 116.47]
            }
            zoom={13}
          />
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="确认删除"
        width="max-w-md"
        footer={
          <>
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              取消
            </button>
            <button
              onClick={handleDelete}
              disabled={submitting}
              className="px-4 py-2 bg-danger text-white font-medium rounded-lg hover:bg-danger/90 transition-colors text-sm disabled:opacity-50"
            >
              {submitting ? '删除中...' : '确认删除'}
            </button>
          </>
        }
      >
        <p className="text-text-secondary">
          确定要删除航线 <span className="text-danger font-medium">{deleteTarget?.name}</span> 吗？
          {deleteTarget?.waypoint_count && deleteTarget.waypoint_count > 0 && (
            <span className="block mt-2 text-amber text-sm">
              ⚠️ 该航线已有关联任务将无法删除
            </span>
          )}
        </p>
      </Modal>
    </div>
  )
}
