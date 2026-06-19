import { useState, useEffect } from 'react'
import { linesApi, towersApi } from '../services/api'
import type { Line, Tower } from '../types'
import MapComponent from '../components/MapComponent'
import Badge from '../components/Badge'
import {
  Map,
  Tower as TowerIcon,
  ChevronRight,
  Plus,
  Info,
} from 'lucide-react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, Tooltip } from 'react-leaflet'
import dayjs from 'dayjs'

export default function LineMap() {
  const [lines, setLines] = useState<Line[]>([])
  const [towers, setTowers] = useState<Tower[]>([])
  const [selectedLine, setSelectedLine] = useState<Line | null>(null)
  const [selectedTower, setSelectedTower] = useState<Tower | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<'lines' | 'towers'>('lines')

  useEffect(() => {
    loadLines()
  }, [])

  const loadLines = async () => {
    try {
      const res = await linesApi.list({ page_size: 100 })
      const data = res.data.results || res.data
      setLines(data)
      if (data.length > 0) {
        setSelectedLine(data[0])
        loadTowers(data[0].id)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadTowers = async (lineId: number) => {
    try {
      const res = await towersApi.list({ line: lineId, page_size: 200 })
      setTowers(res.data.results || res.data)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSelectLine = (line: Line) => {
    setSelectedLine(line)
    setSelectedTower(null)
    loadTowers(line.id)
  }

  const voltageColors: Record<string, string> = {
    '110kV': '#22D3EE',
    '220kV': '#F5B301',
    '500kV': '#FF4D4F',
    '750kV': '#9333EA',
    '1000kV': '#3DD68C',
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-10rem)]">
      {/* Sidebar */}
      <div className="w-80 bg-bg-panel border border-border-dark rounded-xl overflow-hidden flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-border-dark">
          <button
            onClick={() => setSidebarTab('lines')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              sidebarTab === 'lines'
                ? 'text-cyan border-b-2 border-cyan bg-cyan/5'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            线路列表
          </button>
          <button
            onClick={() => setSidebarTab('towers')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              sidebarTab === 'towers'
                ? 'text-cyan border-b-2 border-cyan bg-cyan/5'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            杆塔列表
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {sidebarTab === 'lines' ? (
            <div className="divide-y divide-border-dark">
              {lines.map((line) => (
                <div
                  key={line.id}
                  onClick={() => handleSelectLine(line)}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedLine?.id === line.id
                      ? 'bg-cyan/10 border-l-2 border-cyan'
                      : 'hover:bg-white/5 border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: voltageColors[line.voltage] || '#22D3EE' }}
                      ></div>
                      <span className="font-medium text-sm">{line.name}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <Badge variant="cyan" size="sm">
                      {line.voltage_display}
                    </Badge>
                    <span>{line.tower_count} 基杆塔</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border-dark">
              {towers.map((tower) => (
                <div
                  key={tower.id}
                  onClick={() => setSelectedTower(tower)}
                  className={`p-3 cursor-pointer transition-colors ${
                    selectedTower?.id === tower.id
                      ? 'bg-amber/10 border-l-2 border-amber'
                      : 'hover:bg-white/5 border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{tower.code}</span>
                    {tower.defect_count !== undefined && tower.defect_count > 0 && (
                      <Badge variant="danger" size="sm">
                        {tower.defect_count} 缺陷
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-text-muted">
                    {tower.tower_type_display} · {tower.height}m
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected info panel */}
        {selectedTower && (
          <div className="border-t border-border-dark p-4 bg-bg-card">
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <TowerIcon className="w-4 h-4 text-amber" />
              杆塔详情
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">编号</span>
                <span>{selectedTower.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">类型</span>
                <span>{selectedTower.tower_type_display}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">高度</span>
                <span>{selectedTower.height}m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">序号</span>
                <span>#{selectedTower.sequence}</span>
              </div>
              {selectedTower.coordinates && (
                <div className="flex justify-between">
                  <span className="text-text-muted">坐标</span>
                  <span className="font-mono text-xs">
                    {selectedTower.coordinates.lon.toFixed(4)},{' '}
                    {selectedTower.coordinates.lat.toFixed(4)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
        <div className="h-full relative">
          <MapComponent
            center={selectedLine?.coordinates?.[0] ? [selectedLine.coordinates[0][1], selectedLine.coordinates[0][0]] : [39.91, 116.47]}
            zoom={12}
          >
            {lines.map((line) => (
              line.coordinates && (
                <Polyline
                  key={line.id}
                  positions={line.coordinates.map((c) => [c[1], c[0]])}
                  color={voltageColors[line.voltage] || '#22D3EE'}
                  weight={selectedLine?.id === line.id ? 4 : 2.5}
                  opacity={selectedLine?.id === line.id ? 1 : 0.5}
                  eventHandlers={{
                    click: () => handleSelectLine(line),
                  }}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                    <div className="text-xs">
                      <p className="font-semibold" style={{ color: voltageColors[line.voltage] }}>
                        {line.name}
                      </p>
                      <p>{line.voltage_display}</p>
                    </div>
                  </Tooltip>
                </Polyline>
              )
            ))}
            {towers.map((tower) =>
              tower.coordinates ? (
                <CircleMarker
                  key={tower.id}
                  center={[tower.coordinates.lat, tower.coordinates.lon]}
                  radius={selectedTower?.id === tower.id ? 8 : 5}
                  fillColor={selectedTower?.id === tower.id ? '#F5B301' : '#22D3EE'}
                  color={selectedTower?.id === tower.id ? '#F5B301' : '#22D3EE'}
                  weight={2}
                  opacity={1}
                  fillOpacity={0.8}
                  eventHandlers={{
                    click: () => setSelectedTower(tower),
                  }}
                >
                  <Tooltip direction="top" offset={[0, -5]} opacity={1}>
                    <div className="text-xs">
                      <p className="font-semibold">{tower.code}</p>
                      <p>{tower.tower_type_display}</p>
                    </div>
                  </Tooltip>
                </CircleMarker>
              ) : null
            )}
          </MapComponent>

          {/* Map legend */}
          <div className="absolute top-4 right-4 bg-bg-panel/90 backdrop-blur border border-border-dark rounded-lg p-3 text-xs">
            <p className="font-medium mb-2">图例</p>
            <div className="space-y-1.5">
              {Object.entries(voltageColors).slice(0, 4).map(([label, color) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-3 h-0.5" style={{ backgroundColor: color }}></div>
                  <span className="text-text-muted">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
