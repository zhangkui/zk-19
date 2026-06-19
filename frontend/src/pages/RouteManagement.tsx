import { useState, useEffect } from 'react'
import { routesApi, linesApi, dronesApi } from '../services/api'
import type { FlightRoute, Line, Drone } from '../types'
import MapComponent from '../components/MapComponent'
import Badge from '../components/Badge'
import {
  Route,
  Plus,
  Edit,
  Trash2,
  Play,
  Clock,
  Mountain,
  Gauge,
} from 'lucide-react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, Tooltip } from 'react-leaflet'
import dayjs from 'dayjs'

export default function RouteManagement() {
  const [routes, setRoutes] = useState<FlightRoute[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [drones, setDrones] = useState<Drone[]>([])
  const [selectedRoute, setSelectedRoute] = useState<FlightRoute | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [routesRes, linesRes, dronesRes] = await Promise.all([
        routesApi.list({ page_size: 50 }),
        linesApi.list({ page_size: 50 }),
        dronesApi.list({ page_size: 50 }),
      ])
      const routesData = routesRes.data.results || routesRes.data
      setRoutes(routesData)
      setLines(linesRes.data.results || linesRes.data)
      setDrones(dronesRes.data.results || dronesRes.data)
      if (routesData.length > 0) {
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
          onClick={() => setShowCreateModal(true)}
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
                暂无航线
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
                {selectedRoute?.coordinates && (
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
                  <button className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-cyan transition-colors">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-danger transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button className="flex items-center gap-1 px-3 py-1.5 bg-success/20 text-success text-sm rounded-lg hover:bg-success/30 transition-colors">
                    <Play className="w-4 h-4" />
                    执行
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
    </div>
  )
}
