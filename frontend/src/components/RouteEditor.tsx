import { useState, useCallback, useRef, useEffect } from 'react'
import { MapContainer, TileLayer, ZoomControl, Polyline, CircleMarker, Tooltip, useMap, useMapEvents, Marker } from 'react-leaflet'
import L, { LatLng, LatLngLiteral } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { GripVertical, Trash2, Plus, X, MapPin, AlertCircle } from 'lucide-react'
import type { EditableWaypoint } from '../types'
import { cn, validateLon, validateLat } from '../utils'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

interface DraggableMarkerProps {
  position: [number, number]
  index: number
  total: number
  onDragEnd: (index: number, lat: number, lon: number) => void
  onDelete: (index: number) => void
  onInsertBefore: (index: number) => void
  selected: boolean
  onSelect: (index: number) => void
}

function DraggableMarker({
  position,
  index,
  total,
  onDragEnd,
  onDelete,
  onInsertBefore,
  selected,
  onSelect,
}: DraggableMarkerProps) {
  const markerRef = useRef<L.CircleMarker | null>(null)

  const eventHandlers = useCallback(
    () => ({
      dragend: () => {
        const marker = markerRef.current
        if (marker) {
          const latlng = marker.getLatLng()
          onDragEnd(index, latlng.lat, latlng.lng)
        }
      },
      click: (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e)
        onSelect(index)
      },
    }),
    [index, onDragEnd, onSelect]
  )

  const getColor = () => {
    if (index === 0) return '#22C55E'
    if (index === total - 1) return '#EF4444'
    return selected ? '#22D3EE' : '#F5B301'
  }

  return (
    <CircleMarker
      ref={markerRef}
      center={position}
      radius={selected ? 10 : 8}
      fillColor={getColor()}
      color={getColor()}
      weight={selected ? 3 : 2}
      opacity={1}
      fillOpacity={selected ? 0.9 : 0.7}
      draggable
      eventHandlers={eventHandlers()}
      zIndexOffset={selected ? 1000 : 100}
    >
      <Tooltip direction="top" offset={[0, -10]} permanent={selected}>
        <div className="text-xs whitespace-nowrap">
          <p className="font-medium">航点 #{index + 1}</p>
          <p className="text-text-muted">经度: {position[1].toFixed(6)}</p>
          <p className="text-text-muted">纬度: {position[0].toFixed(6)}</p>
          {selected && (
            <div className="flex gap-1 mt-1 pt-1 border-t border-border-dark">
              {index > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onInsertBefore(index)
                  }}
                  className="px-2 py-0.5 bg-cyan text-bg-dark rounded text-[10px] hover:bg-cyan-dark"
                >
                  插入
                </button>
              )}
              {total > 2 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(index)
                  }}
                  className="px-2 py-0.5 bg-danger text-white rounded text-[10px] hover:bg-danger/90"
                >
                  删除
                </button>
              )}
            </div>
          )}
        </div>
      </Tooltip>
    </CircleMarker>
  )
}

interface MapClickHandlerProps {
  onMapClick: (lat: number, lon: number) => void
  editMode: boolean
}

function MapClickHandler({ onMapClick, editMode }: MapClickHandlerProps) {
  useMapEvents({
    click: (e) => {
      if (editMode) {
        onMapClick(e.latlng.lat, e.latlng.lng)
      }
    },
  })
  return null
}

interface FitBoundsHandlerProps {
  bounds: [number, number][] | null
}

function FitBoundsHandler({ bounds }: FitBoundsHandlerProps) {
  const map = useMap()
  useEffect(() => {
    if (bounds && bounds.length >= 2) {
      const latLngs = bounds.map(([lat, lon]) => [lat, lon] as [number, number])
      map.fitBounds(latLngs, { padding: [50, 50] })
    }
  }, [bounds, map])
  return null
}

interface RouteEditorProps {
  waypoints: EditableWaypoint[]
  onChange: (waypoints: EditableWaypoint[]) => void
  showTowers?: boolean
  towerPoints?: { lat: number; lon: number; code: string }[]
  showSections?: boolean
  sectionLines?: { positions: [number, number][]; name: string }[]
  className?: string
  editMode?: boolean
  onValidationError?: (errors: string[]) => void
  simulationMode?: boolean
  simulationProgress?: number
  center?: [number, number]
  zoom?: number
  readOnly?: boolean
}

export default function RouteEditor({
  waypoints,
  onChange,
  showTowers = false,
  towerPoints = [],
  showSections = false,
  sectionLines = [],
  className,
  editMode = true,
  onValidationError,
  simulationMode = false,
  simulationProgress = 0,
  center = [39.908, 116.397],
  zoom = 13,
  readOnly = false,
}: RouteEditorProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [textInput, setTextInput] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  const positions = waypoints.map((wp) => [wp.lat, wp.lon] as [number, number])
  const bounds = positions.length >= 2 ? positions : null

  useEffect(() => {
    const text = waypoints.map((wp) => `${wp.lon.toFixed(6)},${wp.lat.toFixed(6)}`).join('\n')
    setTextInput(text)
  }, [waypoints])

  const validateWaypoints = useCallback(
    (wps: EditableWaypoint[]): string[] => {
      const errs: string[] = []
      if (wps.length < 2) {
        errs.push('至少需要2个航点')
      }
      wps.forEach((wp, idx) => {
        const lonErr = validateLon(wp.lon)
        const latErr = validateLat(wp.lat)
        if (lonErr) errs.push(`航点${idx + 1}: ${lonErr}`)
        if (latErr) errs.push(`航点${idx + 1}: ${latErr}`)
      })
      return errs
    },
    []
  )

  useEffect(() => {
    const errs = validateWaypoints(waypoints)
    setErrors(errs)
    onValidationError?.(errs)
  }, [waypoints, validateWaypoints, onValidationError])

  const handleMapClick = useCallback(
    (lat: number, lon: number) => {
      if (!editMode || readOnly) return
      const newWaypoint: EditableWaypoint = {
        lon,
        lat,
        index: waypoints.length,
      }
      onChange([...waypoints, newWaypoint])
      setSelectedIndex(waypoints.length)
    },
    [waypoints, onChange, editMode, readOnly]
  )

  const handleDragEnd = useCallback(
    (index: number, lat: number, lon: number) => {
      if (readOnly) return
      const newWaypoints = [...waypoints]
      newWaypoints[index] = { ...newWaypoints[index], lat, lon }
      onChange(newWaypoints)
    },
    [waypoints, onChange, readOnly]
  )

  const handleDelete = useCallback(
    (index: number) => {
      if (readOnly || waypoints.length <= 2) return
      const newWaypoints = waypoints
        .filter((_, i) => i !== index)
        .map((wp, i) => ({ ...wp, index: i }))
      onChange(newWaypoints)
      setSelectedIndex(null)
    },
    [waypoints, onChange, readOnly]
  )

  const handleInsertBefore = useCallback(
    (index: number) => {
      if (readOnly || index === 0) return
      const prevWp = waypoints[index - 1]
      const currWp = waypoints[index]
      const midLat = (prevWp.lat + currWp.lat) / 2
      const midLon = (prevWp.lon + currWp.lon) / 2
      const newWaypoint: EditableWaypoint = {
        lon: midLon,
        lat: midLat,
        index,
      }
      const newWaypoints = [
        ...waypoints.slice(0, index),
        newWaypoint,
        ...waypoints.slice(index).map((wp) => ({ ...wp, index: wp.index + 1 })),
      ]
      onChange(newWaypoints)
      setSelectedIndex(index)
    },
    [waypoints, onChange, readOnly]
  )

  const handleTextChange = useCallback(
    (value: string) => {
      if (readOnly) return
      setTextInput(value)
      const lines = value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
      const newWaypoints: EditableWaypoint[] = []
      let hasError = false
      lines.forEach((line, idx) => {
        const parts = line.split(',')
        if (parts.length !== 2) {
          hasError = true
          return
        }
        const lon = parseFloat(parts[0].trim())
        const lat = parseFloat(parts[1].trim())
        if (isNaN(lon) || isNaN(lat)) {
          hasError = true
          return
        }
        newWaypoints.push({ lon, lat, index: idx })
      })
      if (!hasError && newWaypoints.length > 0) {
        onChange(newWaypoints)
      }
    },
    [onChange, readOnly]
  )

  const clearWaypoints = () => {
    if (readOnly) return
    onChange([])
    setSelectedIndex(null)
  }

  const calculateDistance = () => {
    if (waypoints.length < 2) return 0
    let total = 0
    const R = 6371000
    for (let i = 0; i < waypoints.length - 1; i++) {
      const { lat: lat1, lon: lon1 } = waypoints[i]
      const { lat: lat2, lon: lon2 } = waypoints[i + 1]
      const phi1 = (lat1 * Math.PI) / 180
      const phi2 = (lat2 * Math.PI) / 180
      const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
      const deltaLambda = ((lon2 - lon1) * Math.PI) / 180
      const a =
        Math.sin(deltaPhi / 2) ** 2 +
        Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      total += R * c
    }
    return total
  }

  const distance = calculateDistance()
  const simulationState = useCallback(() => {
    if (!simulationMode || waypoints.length < 2) return null
    const totalSegments = waypoints.length - 1
    const progressPerSegment = 100 / totalSegments
    const segmentIndex = Math.min(
      Math.floor(simulationProgress / progressPerSegment),
      totalSegments - 1
    )
    const segmentProgress =
      (simulationProgress - segmentIndex * progressPerSegment) / progressPerSegment
    const start = waypoints[segmentIndex]
    const end = waypoints[segmentIndex + 1]
    const lat = start.lat + (end.lat - start.lat) * segmentProgress
    const lon = start.lon + (end.lon - start.lon) * segmentProgress
    const bearing = Math.atan2(end.lon - start.lon, end.lat - start.lat) * (180 / Math.PI)
    return { lat, lon, bearing, segmentIndex, segmentProgress }
  }, [simulationMode, simulationProgress, waypoints])()

  const droneIcon = useMemo(() => {
    return L.divIcon({
      className: 'drone-icon',
      html: `
        <div style="transform: rotate(${simulationState?.bearing || 0}deg); transition: transform 0.1s;">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <ellipse cx="24" cy="24" rx="8" ry="5" fill="#F59E0B" />
            <line x1="24" y1="24" x2="8" y2="12" stroke="#374151" stroke-width="2" stroke-linecap="round" />
            <line x1="24" y1="24" x2="40" y2="12" stroke="#374151" stroke-width="2" stroke-linecap="round" />
            <line x1="24" y1="24" x2="8" y2="36" stroke="#374151" stroke-width="2" stroke-linecap="round" />
            <line x1="24" y1="24" x2="40" y2="36" stroke="#374151" stroke-width="2" stroke-linecap="round" />
            <circle cx="8" cy="12" r="5" fill="#6B7280" stroke="#4B5563" stroke-width="1" />
            <circle cx="40" cy="12" r="5" fill="#6B7280" stroke="#4B5563" stroke-width="1" />
            <circle cx="8" cy="36" r="5" fill="#6B7280" stroke="#4B5563" stroke-width="1" />
            <circle cx="40" cy="36" r="5" fill="#6B7280" stroke="#4B5563" stroke-width="1" />
            <ellipse cx="8" cy="12" rx="5" ry="1.5" fill="#9CA3AF" opacity="0.6">
              <animate attributeName="opacity" values="0.6;0.3;0.6" dur="0.2s" repeatCount="indefinite" />
            </ellipse>
            <ellipse cx="40" cy="12" rx="5" ry="1.5" fill="#9CA3AF" opacity="0.6">
              <animate attributeName="opacity" values="0.6;0.3;0.6" dur="0.2s" repeatCount="indefinite" />
            </ellipse>
            <ellipse cx="8" cy="36" rx="5" ry="1.5" fill="#9CA3AF" opacity="0.6">
              <animate attributeName="opacity" values="0.6;0.3;0.6" dur="0.2s" repeatCount="indefinite" />
            </ellipse>
            <ellipse cx="40" cy="36" rx="5" ry="1.5" fill="#9CA3AF" opacity="0.6">
              <animate attributeName="opacity" values="0.6;0.3;0.6" dur="0.2s" repeatCount="indefinite" />
            </ellipse>
            <circle cx="24" cy="22" r="2" fill="#22D3EE" />
          </svg>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    })
  }, [simulationState?.bearing])

  return (
    <div className={cn('relative w-full h-full rounded-lg overflow-hidden', className)}>
      <div className="h-full">
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: '100%', width: '100%', background: '#0B0F14', cursor: editMode && !readOnly ? 'crosshair' : 'grab' }}
          zoomControl={false}
          attributionControl={false}
          onClick={(e) => {
            if (editMode && !readOnly) {
              handleMapClick(e.latlng.lat, e.latlng.lng)
            }
          }}
        >
          <ZoomControl position="bottomright" />
          <TileLayer
            attribution=""
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            maxZoom={19}
          />
          <FitBoundsHandler bounds={bounds} />
          <MapClickHandler onMapClick={handleMapClick} editMode={editMode && !readOnly} />

          {showSections &&
            sectionLines.map((section, idx) => (
              <Polyline
                key={`section-${idx}`}
                positions={section.positions}
                color="#8B5CF6"
                weight={4}
                opacity={0.6}
                dashArray="15, 10"
              >
                <Tooltip direction="top">
                  <span className="text-xs font-medium">{section.name}</span>
                </Tooltip>
              </Polyline>
            ))}

          {showTowers &&
            towerPoints.map((tower, idx) => (
              <CircleMarker
                key={`tower-${idx}`}
                center={[tower.lat, tower.lon]}
                radius={6}
                fillColor="#A855F7"
                color="#A855F7"
                weight={2}
                opacity={0.9}
                fillOpacity={0.7}
              >
                <Tooltip direction="top">
                  <div className="text-xs">
                    <p className="font-medium text-purple-400">杆塔: {tower.code}</p>
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}

          {positions.length > 1 && (
            <Polyline
              positions={positions}
              color="#22D3EE"
              weight={3}
              opacity={0.8}
              dashArray="10, 10"
            />
          )}

          {waypoints.map((wp, idx) => (
            <DraggableMarker
              key={wp.index}
              position={[wp.lat, wp.lon]}
              index={idx}
              total={waypoints.length}
              onDragEnd={handleDragEnd}
              onDelete={handleDelete}
              onInsertBefore={handleInsertBefore}
              selected={selectedIndex === idx}
              onSelect={setSelectedIndex}
            />
          ))}

          {simulationState && (
            <>
              <Polyline
                positions={[
                  ...positions.slice(0, simulationState.segmentIndex + 1),
                  [simulationState.lat, simulationState.lon],
                ]}
                color="#22D3EE"
                weight={4}
                opacity={1}
              />
              <Polyline
                positions={[
                  ...positions.slice(0, simulationState.segmentIndex + 1),
                  [simulationState.lat, simulationState.lon],
                ]}
                color="#22D3EE"
                weight={8}
                opacity={0.3}
              />
              <Marker
                position={[simulationState.lat, simulationState.lon]}
                icon={droneIcon}
                zIndexOffset={2000}
              >
                <Tooltip direction="top" offset={[0, -20]} permanent>
                  <div className="text-xs whitespace-nowrap">
                    <p className="font-medium text-amber-400">🛩️ 无人机</p>
                    <p className="text-text-muted">进度: {simulationProgress.toFixed(0)}%</p>
                    <p className="text-text-muted">航段: {simulationState.segmentIndex + 1}/{waypoints.length - 1}</p>
                  </div>
                </Tooltip>
              </Marker>
              <CircleMarker
                center={[simulationState.lat, simulationState.lon]}
                radius={16}
                fillColor="#F59E0B"
                color="#F59E0B"
                weight={0}
                fillOpacity={0.2}
              >
                <CircleMarker
                  center={[simulationState.lat, simulationState.lon]}
                  radius={12}
                  fillColor="transparent"
                  color="#F59E0B"
                  weight={2}
                  fillOpacity={0}
                  opacity={0.5}
                />
              </CircleMarker>
            </>
          )}
        </MapContainer>
      </div>

      {editMode && !readOnly && (
        <div className="absolute top-4 left-4 right-4 z-[400]">
          <div className="bg-amber/90 backdrop-blur text-bg-dark rounded-lg px-4 py-2.5 text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-bg-dark rounded-full animate-pulse"></span>
              编辑模式：点击地图添加航点，拖拽调整航点位置
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-bg-dark/20 px-2 py-0.5 rounded">
                {waypoints.length} 航点 | {(distance / 1000).toFixed(2)} km
              </span>
              {waypoints.length > 0 && (
                <button
                  onClick={clearWaypoints}
                  className="px-3 py-1 bg-bg-dark/20 hover:bg-bg-dark/30 rounded text-xs font-medium transition-colors"
                >
                  清空
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {simulationMode && (
        <div className="absolute top-4 left-4 right-4 z-[400]">
          <div className="bg-amber/90 backdrop-blur text-bg-dark rounded-lg px-4 py-3 text-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 font-medium">
                <span className="w-2 h-2 bg-bg-dark rounded-full animate-pulse"></span>
                🛩️ 模拟飞行中
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs bg-bg-dark/20 px-2 py-0.5 rounded">
                  航段 {simulationState ? simulationState.segmentIndex + 1 : 0}/{Math.max(waypoints.length - 1, 0)}
                </span>
                <span className="font-mono">{simulationProgress.toFixed(0)}%</span>
              </div>
            </div>
            <div className="w-full bg-bg-dark/30 rounded-full h-2 mb-2">
              <div
                className="bg-bg-dark rounded-full h-2 transition-all duration-100"
                style={{ width: `${simulationProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                起点
              </span>
              <span>
                总距离: {(distance / 1000).toFixed(2)} km
              </span>
              <span className="flex items-center gap-1">
                终点
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
              </span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .drone-icon {
          background: transparent !important;
          border: none !important;
        }
        .drone-icon svg {
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }
        .leaflet-tooltip-top:before,
        .leaflet-tooltip-bottom:before,
        .leaflet-tooltip-left:before,
        .leaflet-tooltip-right:before {
          display: none;
        }
        .leaflet-tooltip {
          background: rgba(17, 24, 39, 0.95) !important;
          border: 1px solid rgba(75, 85, 99, 0.5) !important;
          color: #e5e7eb !important;
          border-radius: 6px !important;
          padding: 8px 10px !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
        }
      `}</style>

      {editMode && !readOnly && (
        <div className="absolute bottom-4 left-4 right-4 z-[400]">
          <div className="bg-bg-panel/95 backdrop-blur border border-border-dark rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-text-primary">
                航点坐标（经度,纬度 每行一个）
              </label>
              {errors.length > 0 && (
                <div className="flex items-center gap-1 text-danger text-xs">
                  <AlertCircle className="w-3 h-3" />
                  {errors.length} 个错误
                </div>
              )}
            </div>
            <textarea
              value={textInput}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={'116.470000,39.910000\n116.480000,39.920000'}
              rows={3}
              className="w-full px-3 py-2 bg-bg-card border border-border-dark rounded-lg text-xs font-mono text-text-primary placeholder-text-muted focus:outline-none focus:border-cyan/50 resize-none"
            />
            {errors.length > 0 && (
              <div className="mt-2 space-y-1">
                {errors.slice(0, 3).map((err, idx) => (
                  <p key={idx} className="text-xs text-danger flex items-center gap-1">
                    <X className="w-3 h-3" />
                    {err}
                  </p>
                ))}
                {errors.length > 3 && (
                  <p className="text-xs text-text-muted">...还有 {errors.length - 3} 个错误</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {editMode && !readOnly && selectedIndex !== null && waypoints[selectedIndex] && (
        <div className="absolute top-20 right-4 z-[400]">
          <div className="bg-bg-panel/95 backdrop-blur border border-border-dark rounded-lg p-3 w-56">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan" />
              航点 #{selectedIndex + 1}
            </h4>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-text-muted block mb-1">经度</label>
                <input
                  type="number"
                  step="0.000001"
                  value={waypoints[selectedIndex].lon}
                  onChange={(e) => {
                    const newWaypoints = [...waypoints]
                    newWaypoints[selectedIndex] = {
                      ...newWaypoints[selectedIndex],
                      lon: parseFloat(e.target.value) || 0,
                    }
                    onChange(newWaypoints)
                  }}
                  className="w-full px-2 py-1.5 bg-bg-card border border-border-dark rounded text-xs text-text-primary focus:outline-none focus:border-cyan/50"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">纬度</label>
                <input
                  type="number"
                  step="0.000001"
                  value={waypoints[selectedIndex].lat}
                  onChange={(e) => {
                    const newWaypoints = [...waypoints]
                    newWaypoints[selectedIndex] = {
                      ...newWaypoints[selectedIndex],
                      lat: parseFloat(e.target.value) || 0,
                    }
                    onChange(newWaypoints)
                  }}
                  className="w-full px-2 py-1.5 bg-bg-card border border-border-dark rounded text-xs text-text-primary focus:outline-none focus:border-cyan/50"
                />
              </div>
              <div className="flex gap-2 pt-2">
                {selectedIndex > 0 && (
                  <button
                    onClick={() => handleInsertBefore(selectedIndex)}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-cyan/20 text-cyan rounded text-xs hover:bg-cyan/30"
                  >
                    <Plus className="w-3 h-3" />
                    插入
                  </button>
                )}
                {waypoints.length > 2 && (
                  <button
                    onClick={() => handleDelete(selectedIndex)}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-danger/20 text-danger rounded text-xs hover:bg-danger/30"
                  >
                    <Trash2 className="w-3 h-3" />
                    删除
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {editMode && !readOnly && waypoints.length > 1 && (
        <div className="absolute bottom-40 left-4 z-[400]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-text-muted">起点</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-text-muted">中间点</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-text-muted">终点</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
