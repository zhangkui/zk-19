import { useState, useEffect } from 'react'
import { routesApi, linesApi } from '../services/api'
import type { FlightRoute, Line } from '../types'
import MapComponent from '../components/MapComponent'
import Badge from '../components/Badge'
import Modal, { FormField, inputClass, selectClass, textareaClass } from '../components/Modal'
import {
  Route,
  Plus,
  Edit,
  Trash2,
  Mountain,
  Gauge,
} from 'lucide-react'
import { Polyline, CircleMarker, Tooltip } from 'react-leaflet'
import dayjs from 'dayjs'

const ROUTE_STATUS_OPTIONS = [
  { value: 'draft', label: '草稿' },
  { value: 'approved', label: '已审批' },
  { value: 'archived', label: '已归档' },
]

export default function RouteManagement() {
  const [routes, setRoutes] = useState<FlightRoute[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [selectedRoute, setSelectedRoute] = useState<FlightRoute | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingRoute, setEditingRoute] = useState<FlightRoute | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FlightRoute | null>(null)

  const [form, setForm] = useState({
    name: '',
    line: '' as number | string,
    altitude: 50,
    speed: 8,
    estimated_duration: 0,
    status: 'draft',
    description: '',
    waypoints_list: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [routesRes, linesRes] = await Promise.all([
        routesApi.list({ page_size: 50 }),
        linesApi.list({ page_size: 50 }),
      ])
      const routesData = routesRes.data.results || routesRes.data
      setRoutes(routesData)
      setLines(linesRes.data.results || linesRes.data)
      if (routesData.length > 0 && !selectedRoute) {
        setSelectedRoute(routesData[0])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const statusColors: Record<string, string> = {
    draft: 'amber',
    approved: 'success',
    archived: 'default',
  }

  const openCreate = () => {
    setEditingRoute(null)
    setForm({
      name: '',
      line: lines.length > 0 ? lines[0].id : '',
      altitude: 50,
      speed: 8,
      estimated_duration: 0,
      status: 'draft',
      description: '',
      waypoints_list: '',
    })
    setModalOpen(true)
  }

  const openEdit = (route: FlightRoute) => {
    setEditingRoute(route)
    const coordsText = (route.coordinates || [])
      .map((c) => `${c[0]},${c[1]}`)
      .join('\n')
    setForm({
      name: route.name,
      line: route.line,
      altitude: route.altitude,
      speed: route.speed,
      estimated_duration: route.estimated_duration,
      status: route.status,
      description: route.description || '',
      waypoints_list: coordsText,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.line) return
    setSubmitting(true)
    try {
      const waypoints = form.waypoints_list
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [lon, lat] = line.split(',').map((v) => parseFloat(v.trim()))
          return [lon, lat]
        })
        .filter((wp) => !isNaN(wp[0]) && !isNaN(wp[1]))

      const data: any = {
        name: form.name,
        line: Number(form.line),
        altitude: Number(form.altitude),
        speed: Number(form.speed),
        estimated_duration: Number(form.estimated_duration),
        status: form.status,
        description: form.description,
      }
      if (waypoints.length >= 2) {
        data.waypoints_list = waypoints
      }

      if (editingRoute) {
        await routesApi.update(editingRoute.id, data)
      } else {
        await routesApi.create(data)
      }
      setModalOpen(false)
      await loadData()
    } catch (e) {
      console.error(e)
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
      }
      setDeleteTarget(null)
      await loadData()
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">无人机航线管理</h2>
          <p className="text-text-muted text-sm mt-1">
            共 {routes.length} 条航线
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建航线
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Route list */}
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
                onClick={() => setSelectedRoute(route)}
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
                <div className="text-sm text-text-muted mb-2">
                  {route.line_name}
                </div>
                <div className="flex items-center gap-4 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <Mountain className="w-3 h-3" />
                    {route.waypoint_count} 航点
                  </span>
                  <span className="flex items-center gap-1">
                    <Gauge className="w-3 h-3" />
                    {route.speed}m/s
                  </span>
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

        {/* Map + details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Map */}
          <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border-dark">
              <h3 className="font-semibold">航线预览</h3>
            </div>
            <div className="h-80">
              <MapComponent
                center={selectedRoute?.coordinates?.[0] ? [selectedRoute.coordinates[0][1], selectedRoute.coordinates[0][0]] : [39.91, 116.47]}
                zoom={13}
              >
                {selectedRoute?.coordinates && selectedRoute.coordinates.length > 0 && (
                  <>
                    <Polyline
                      positions={selectedRoute.coordinates.map((c) => [c[1], c[0]])}
                      color="#22D3EE"
                      weight={3}
                      opacity={0.8}
                      dashArray="10, 10"
                    />
                    {selectedRoute.coordinates.map((coord, idx) => (
                      <CircleMarker
                        key={idx}
                        center={[coord[1], coord[0]]}
                        radius={5}
                        fillColor="#22D3EE"
                        color="#22D3EE"
                        weight={2}
                        opacity={1}
                        fillOpacity={0.8}
                      >
                        <Tooltip direction="top" offset={[0, -5]}>
                          <span className="text-xs">#{idx + 1} 航点</span>
                        </Tooltip>
                      </CircleMarker>
                    ))}
                  </>
                )}
              </MapComponent>
            </div>
          </div>

          {/* Route details */}
          {selectedRoute && (
            <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border-dark flex items-center justify-between">
                <h3 className="font-semibold">航线详情</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEdit(selectedRoute)}
                    className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-cyan transition-colors"
                    title="编辑"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(selectedRoute)}
                    className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-danger transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-bg-card rounded-lg p-4">
                  <p className="text-text-muted text-xs mb-1">飞行高度</p>
                  <p className="font-display text-xl text-cyan">
                    {selectedRoute.altitude}
                    <span className="text-sm text-text-muted ml-1">m</span>
                  </p>
                </div>
                <div className="bg-bg-card rounded-lg p-4">
                  <p className="text-text-muted text-xs mb-1">飞行速度</p>
                  <p className="font-display text-xl text-amber">
                    {selectedRoute.speed}
                    <span className="text-sm text-text-muted ml-1">m/s</span>
                  </p>
                </div>
                <div className="bg-bg-card rounded-lg p-4">
                  <p className="text-text-muted text-xs mb-1">航点数量</p>
                  <p className="font-display text-xl text-success">
                    {selectedRoute.waypoint_count}
                    <span className="text-sm text-text-muted ml-1">个</span>
                  </p>
                </div>
                <div className="bg-bg-card rounded-lg p-4">
                  <p className="text-text-muted text-xs mb-1">预计时长</p>
                  <p className="font-display text-xl text-warning">
                    {selectedRoute.estimated_duration}
                    <span className="text-sm text-text-muted ml-1">分钟</span>
                  </p>
                </div>
              </div>
              <div className="px-5 pb-5">
                <p className="text-text-muted text-sm">
                  {selectedRoute.description || '暂无描述'}
                </p>
                <p className="text-text-muted text-xs mt-2">
                  创建时间：{dayjs(selectedRoute.created_at).format('YYYY-MM-DD HH:mm')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRoute ? '编辑航线' : '新建航线'}
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
              disabled={submitting || !form.name.trim() || !form.line}
              className="px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors text-sm disabled:opacity-50"
            >
              {submitting ? '保存中...' : '保存'}
            </button>
          </>
        }
      >
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
          <div className="grid grid-cols-2 gap-4">
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
            <FormField label="状态">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={selectClass}
              >
                {ROUTE_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="飞行高度(m)">
              <input
                type="number"
                value={form.altitude}
                onChange={(e) => setForm({ ...form, altitude: Number(e.target.value) })}
                className={inputClass}
              />
            </FormField>
            <FormField label="飞行速度(m/s)">
              <input
                type="number"
                step="0.1"
                value={form.speed}
                onChange={(e) => setForm({ ...form, speed: Number(e.target.value) })}
                className={inputClass}
              />
            </FormField>
            <FormField label="预计时长(分钟)">
              <input
                type="number"
                value={form.estimated_duration}
                onChange={(e) => setForm({ ...form, estimated_duration: Number(e.target.value) })}
                className={inputClass}
              />
            </FormField>
          </div>
          <FormField label="航点坐标（经度,纬度 每行一个点，至少2个点）">
            <textarea
              value={form.waypoints_list}
              onChange={(e) => setForm({ ...form, waypoints_list: e.target.value })}
              placeholder={'116.47,39.91\n116.48,39.92\n116.49,39.93'}
              rows={5}
              className={textareaClass}
            />
          </FormField>
          <FormField label="描述">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="请输入航线描述"
              rows={2}
              className={textareaClass}
            />
          </FormField>
        </div>
      </Modal>

      {/* Delete confirm modal */}
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
          确定要删除航线 <span className="text-danger font-medium">{deleteTarget?.name}</span> 吗？此操作不可撤销。
        </p>
      </Modal>
    </div>
  )
}
