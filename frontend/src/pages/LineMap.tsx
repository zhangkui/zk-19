import { useState, useEffect } from 'react'
import { linesApi, towersApi, sectionsApi } from '../services/api'
import type { Line, Tower, Section } from '../types'
import MapComponent from '../components/MapComponent'
import Badge from '../components/Badge'
import Modal, { FormField, inputClass, selectClass, textareaClass } from '../components/Modal'
import {
  Map,
  Zap as TowerIcon,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
  Layers,
} from 'lucide-react'
import { Polyline, CircleMarker, Tooltip } from 'react-leaflet'
import { useAuthStore } from '../store/authStore'
import { isAdmin } from '../utils'

const VOLTAGE_OPTIONS = [
  { value: '110kV', label: '110kV' },
  { value: '220kV', label: '220kV' },
  { value: '500kV', label: '500kV' },
  { value: '750kV', label: '750kV' },
  { value: '1000kV', label: '1000kV' },
]

const TOWER_TYPE_OPTIONS = [
  { value: 'straight', label: '直线塔' },
  { value: 'angle', label: '转角塔' },
  { value: 'terminal', label: '终端塔' },
  { value: 'tension', label: '耐张塔' },
]

const SECTION_COLORS = [
  '#22D3EE',
  '#3DD68C',
  '#F5B301',
  '#FF8A00',
  '#9333EA',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
]

export default function LineMap() {
  const { user } = useAuthStore()
  const [lines, setLines] = useState<Line[]>([])
  const [towers, setTowers] = useState<Tower[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [selectedLine, setSelectedLine] = useState<Line | null>(null)
  const [selectedTower, setSelectedTower] = useState<Tower | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<'lines' | 'towers' | 'sections'>('lines')
  const [submitting, setSubmitting] = useState(false)
  const [showSections, setShowSections] = useState(true)

  const [lineModalOpen, setLineModalOpen] = useState(false)
  const [editingLine, setEditingLine] = useState<Line | null>(null)
  const [towerModalOpen, setTowerModalOpen] = useState(false)
  const [editingTower, setEditingTower] = useState<Tower | null>(null)
  const [sectionModalOpen, setSectionModalOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<Section | null>(null)

  const [lineForm, setLineForm] = useState({
    name: '',
    voltage: '220kV',
    description: '',
    waypoints: '',
  })
  const [towerForm, setTowerForm] = useState({
    line: '' as number | string,
    section: '' as number | string,
    code: '',
    tower_type: 'straight',
    height: '' as number | string,
    sequence: '' as number | string,
    lon: '' as number | string,
    lat: '' as number | string,
  })
  const [sectionForm, setSectionForm] = useState({
    line: '' as number | string,
    name: '',
    start_km: '' as number | string,
    end_km: '' as number | string,
    description: '',
  })

  const canManage = isAdmin(user)

  const getSectionColor = (sectionId: number | null): string => {
    if (!sectionId) return '#64748B'
    const idx = sections.findIndex((s) => s.id === sectionId)
    return SECTION_COLORS[idx % SECTION_COLORS.length]
  }

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
        loadSections(data[0].id)
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

  const loadSections = async (lineId: number) => {
    try {
      const res = await sectionsApi.list({ line: lineId, page_size: 100 })
      setSections(res.data.results || res.data)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSelectLine = (line: Line) => {
    setSelectedLine(line)
    setSelectedTower(null)
    loadTowers(line.id)
    loadSections(line.id)
  }

  const openCreateLine = () => {
    setEditingLine(null)
    setLineForm({ name: '', voltage: '220kV', description: '', waypoints: '' })
    setLineModalOpen(true)
  }

  const openEditLine = () => {
    if (!selectedLine) return
    setEditingLine(selectedLine)
    const coordsText = (selectedLine.coordinates || [])
      .map((c) => `${c[0]},${c[1]}`)
      .join('\n')
    setLineForm({
      name: selectedLine.name,
      voltage: selectedLine.voltage,
      description: selectedLine.description || '',
      waypoints: coordsText,
    })
    setLineModalOpen(true)
  }

  const handleSaveLine = async () => {
    if (!lineForm.name.trim()) return
    setSubmitting(true)
    try {
      const waypoints = lineForm.waypoints
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [lon, lat] = line.split(',').map((v) => parseFloat(v.trim()))
          return [lon, lat]
        })
        .filter((wp) => !isNaN(wp[0]) && !isNaN(wp[1]))

      const data: any = {
        name: lineForm.name,
        voltage: lineForm.voltage,
        description: lineForm.description,
      }
      if (waypoints.length >= 2) {
        data.waypoints = waypoints
      }

      if (editingLine) {
        await linesApi.update(editingLine.id, data)
      } else {
        await linesApi.create(data)
      }
      setLineModalOpen(false)
      await loadLines()
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  const openCreateTower = () => {
    setEditingTower(null)
    setTowerForm({
      line: selectedLine?.id || '',
      section: '',
      code: '',
      tower_type: 'straight',
      height: '',
      sequence: '',
      lon: '',
      lat: '',
    })
    setTowerModalOpen(true)
  }

  const openEditTower = (tower: Tower) => {
    setEditingTower(tower)
    setTowerForm({
      line: tower.line,
      section: tower.section || '',
      code: tower.code,
      tower_type: tower.tower_type,
      height: tower.height || '',
      sequence: tower.sequence || '',
      lon: tower.coordinates?.lon || '',
      lat: tower.coordinates?.lat || '',
    })
    setTowerModalOpen(true)
  }

  const handleDeleteTower = async (tower: Tower) => {
    if (!confirm(`确定要删除杆塔【${tower.code}】吗？此操作不可恢复。`)) return
    try {
      await towersApi.delete(tower.id)
      if (selectedLine) {
        await loadTowers(selectedLine.id)
        await loadLines()
      }
    } catch (e) {
      console.error(e)
      alert('删除失败')
    }
  }

  const handleSaveTower = async () => {
    if (!towerForm.line || !towerForm.code.trim()) return
    setSubmitting(true)
    try {
      const data: any = {
        line: Number(towerForm.line),
        code: towerForm.code,
        tower_type: towerForm.tower_type,
      }
      if (towerForm.section) data.section = Number(towerForm.section)
      if (towerForm.height !== '') data.height = Number(towerForm.height)
      if (towerForm.sequence !== '') data.sequence = Number(towerForm.sequence)
      if (towerForm.lon !== '' && towerForm.lat !== '') {
        data.lon = Number(towerForm.lon)
        data.lat = Number(towerForm.lat)
      }
      if (editingTower) {
        await towersApi.update(editingTower.id, data)
      } else {
        await towersApi.create(data)
      }
      setTowerModalOpen(false)
      await loadTowers(Number(towerForm.line))
      await loadLines()
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  const openCreateSection = () => {
    setEditingSection(null)
    setSectionForm({
      line: selectedLine?.id || '',
      name: '',
      start_km: '',
      end_km: '',
      description: '',
    })
    setSectionModalOpen(true)
  }

  const openEditSection = (section: Section) => {
    setEditingSection(section)
    setSectionForm({
      line: section.line,
      name: section.name,
      start_km: section.start_km || '',
      end_km: section.end_km || '',
      description: section.description || '',
    })
    setSectionModalOpen(true)
  }

  const handleDeleteSection = async (section: Section) => {
    if (!confirm(`确定要删除区段【${section.name}】吗？此操作不可恢复。`)) return
    try {
      await sectionsApi.delete(section.id)
      if (selectedLine) {
        await loadSections(selectedLine.id)
      }
    } catch (e) {
      console.error(e)
      alert('删除失败')
    }
  }

  const handleSaveSection = async () => {
    if (!sectionForm.line || !sectionForm.name.trim()) return
    setSubmitting(true)
    try {
      const data: any = {
        line: Number(sectionForm.line),
        name: sectionForm.name,
        start_km: sectionForm.start_km !== '' ? Number(sectionForm.start_km) : 0,
        end_km: sectionForm.end_km !== '' ? Number(sectionForm.end_km) : 0,
        description: sectionForm.description,
      }
      if (editingSection) {
        await sectionsApi.update(editingSection.id, data)
      } else {
        await sectionsApi.create(data)
      }
      setSectionModalOpen(false)
      await loadSections(Number(sectionForm.line))
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteLine = async (line: Line) => {
    if (!confirm(`确定要删除线路【${line.name}】吗？此操作不可恢复，相关杆塔和区段将保留。`)) return
    try {
      await linesApi.delete(line.id)
      if (selectedLine?.id === line.id) {
        setSelectedLine(null)
        setTowers([])
        setSections([])
      }
      await loadLines()
    } catch (e) {
      console.error(e)
      alert('删除失败')
    }
  }

  const voltageColors: Record<string, string> = {
    '110kV': '#22D3EE',
    '220kV': '#F5B301',
    '500kV': '#FF4D4F',
    '750kV': '#9333EA',
    '1000kV': '#3DD68C',
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">线路地图建模</h2>
          <p className="text-text-muted text-sm mt-1">
            线路 — 区段 — 杆塔空间建模与管理
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSections(!showSections)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors text-sm ${
              showSections
                ? 'border-success/40 text-success bg-success/10'
                : 'border-border-dark text-text-secondary hover:text-text-primary hover:bg-white/5'
            }`}
          >
            <Layers className="w-4 h-4" />
            区段显示
          </button>
          {canManage && (
            <>
              <button
                onClick={openCreateLine}
                className="flex items-center gap-2 px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                新增线路
              </button>
              <button
                onClick={openEditLine}
                disabled={!selectedLine}
                className="flex items-center gap-2 px-4 py-2 border border-cyan/40 text-cyan font-medium rounded-lg hover:bg-cyan/10 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Edit className="w-4 h-4" />
                编辑线路
              </button>
              <button
                onClick={openCreateTower}
                disabled={!selectedLine}
                className="flex items-center gap-2 px-4 py-2 border border-amber/40 text-amber font-medium rounded-lg hover:bg-amber/10 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                新增杆塔
              </button>
              <button
                onClick={openCreateSection}
                disabled={!selectedLine}
                className="flex items-center gap-2 px-4 py-2 border border-success/40 text-success font-medium rounded-lg hover:bg-success/10 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                新增区段
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-13rem)]">
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
            <button
              onClick={() => setSidebarTab('sections')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                sidebarTab === 'sections'
                  ? 'text-cyan border-b-2 border-cyan bg-cyan/5'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              区段列表
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
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: voltageColors[line.voltage] || '#22D3EE' }}
                        ></div>
                        <span className="font-medium text-sm truncate">{line.name}</span>
                      </div>
                      {canManage && (
                        <div className="flex items-center gap-1 -mr-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setSelectedLine(line)
                              openEditLine()
                            }}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-cyan transition-colors"
                            title="编辑线路"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteLine(line)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-danger transition-colors"
                            title="删除线路"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <ChevronRight className="w-4 h-4 text-text-muted ml-1 flex-shrink-0" />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <Badge variant="cyan" size="sm">
                        {line.voltage_display}
                      </Badge>
                      <span>{line.tower_count} 基杆塔</span>
                    </div>
                  </div>
                ))}
                {lines.length === 0 && (
                  <div className="p-8 text-center text-text-muted text-sm">
                    <Map className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    暂无线路，点击"新增线路"创建
                  </div>
                )}
              </div>
            ) : sidebarTab === 'towers' ? (
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
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-medium text-sm truncate">{tower.code}</span>
                        {tower.defect_count !== undefined && tower.defect_count > 0 && (
                          <Badge variant="danger" size="sm">
                            {tower.defect_count}
                          </Badge>
                        )}
                      </div>
                      {canManage && (
                        <div className="flex items-center gap-1 -mr-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openEditTower(tower)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-cyan transition-colors"
                            title="编辑杆塔"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTower(tower)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-danger transition-colors"
                            title="删除杆塔"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-text-muted">
                      {tower.tower_type_display} · {tower.height}m
                    </div>
                  </div>
                ))}
                {towers.length === 0 && (
                  <div className="p-8 text-center text-text-muted text-sm">
                    <TowerIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    暂无杆塔，点击"新增杆塔"创建
                  </div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border-dark">
                {sections.map((section) => {
                  const color = getSectionColor(section.id)
                  return (
                    <div
                      key={section.id}
                      className="p-3 hover:bg-white/5 border-l-2 border-transparent transition-colors"
                      style={{ borderLeftColor: color }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div
                            className="w-3 h-3 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: color }}
                          ></div>
                          <span className="font-medium text-sm truncate">{section.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="default" size="sm">
                            {section.tower_count}
                          </Badge>
                          {canManage && (
                            <div className="flex items-center gap-1 -mr-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => openEditSection(section)}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-cyan transition-colors"
                                title="编辑区段"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteSection(section)}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-danger transition-colors"
                                title="删除区段"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-text-muted">
                        {section.start_km}km - {section.end_km}km
                      </div>
                    </div>
                  )
                })}
                {sections.length === 0 && (
                  <div className="p-8 text-center text-text-muted text-sm">
                    <Layers className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    暂无区段，点击"新增区段"创建
                  </div>
                )}
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
                line.coordinates && line.coordinates.length > 0 && (
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
              {showSections && sections.map((section) => {
                const sectionTowers = towers.filter((t) => t.section === section.id && t.coordinates)
                if (sectionTowers.length < 2) return null
                const sortedTowers = [...sectionTowers].sort((a, b) => a.sequence - b.sequence)
                const positions = sortedTowers.map((t) => [t.coordinates!.lat, t.coordinates!.lon])
                const color = getSectionColor(section.id)
                return (
                  <Polyline
                    key={`section-line-${section.id}`}
                    positions={positions}
                    color={color}
                    weight={8}
                    opacity={0.35}
                    eventHandlers={{
                      click: () => {},
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                      <div className="text-xs">
                        <p className="font-semibold" style={{ color }}>{section.name}</p>
                        <p>{section.start_km}km - {section.end_km}km</p>
                      </div>
                    </Tooltip>
                  </Polyline>
                )
              })}
              {towers.map((tower) =>
                tower.coordinates ? (
                  <CircleMarker
                    key={tower.id}
                    center={[tower.coordinates.lat, tower.coordinates.lon]}
                    radius={selectedTower?.id === tower.id ? 10 : 7}
                    fillColor={selectedTower?.id === tower.id ? '#F5B301' : (showSections ? getSectionColor(tower.section) : '#22D3EE')}
                    color={selectedTower?.id === tower.id ? '#F5B301' : (showSections ? getSectionColor(tower.section) : '#22D3EE')}
                    weight={2}
                    opacity={1}
                    fillOpacity={0.9}
                    eventHandlers={{
                      click: () => setSelectedTower(tower),
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -5]} opacity={1}>
                      <div className="text-xs">
                        <p className="font-semibold">{tower.code}</p>
                        <p>{tower.tower_type_display}</p>
                        {showSections && tower.section && (
                          <p style={{ color: getSectionColor(tower.section) }}>
                            {sections.find((s) => s.id === tower.section)?.name}
                          </p>
                        )}
                      </div>
                    </Tooltip>
                  </CircleMarker>
                ) : null
              )}
            </MapComponent>

            {/* Map legend */}
            <div className="absolute top-4 right-4 bg-bg-panel/90 backdrop-blur border border-border-dark rounded-lg p-3 text-xs space-y-3 max-w-[220px]">
              <div>
                <p className="font-medium mb-2">电压等级</p>
                <div className="space-y-1.5">
                  {Object.entries(voltageColors).slice(0, 4).map(([label, color]) => (
                    <div key={label} className="flex items-center gap-2">
                      <div className="w-3 h-0.5" style={{ backgroundColor: color }}></div>
                      <span className="text-text-muted">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {showSections && sections.length > 0 && (
                <div>
                  <p className="font-medium mb-2">区段范围</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {sections.map((section) => {
                      const color = getSectionColor(section.id)
                      return (
                        <div key={section.id} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: color, opacity: 0.8 }}
                          ></div>
                          <span className="text-text-muted truncate" title={section.name}>
                            {section.name}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Line Form Modal */}
      <Modal
        open={lineModalOpen}
        onClose={() => setLineModalOpen(false)}
        title={editingLine ? '编辑线路' : '新增线路'}
        footer={
          <>
            <button
              onClick={() => setLineModalOpen(false)}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              取消
            </button>
            <button
              onClick={handleSaveLine}
              disabled={submitting || !lineForm.name.trim()}
              className="px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors text-sm disabled:opacity-50"
            >
              {submitting ? '保存中...' : '保存'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="线路名称" required>
            <input
              type="text"
              value={lineForm.name}
              onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })}
              placeholder="请输入线路名称"
              className={inputClass}
            />
          </FormField>
          <FormField label="电压等级" required>
            <select
              value={lineForm.voltage}
              onChange={(e) => setLineForm({ ...lineForm, voltage: e.target.value })}
              className={selectClass}
            >
              {VOLTAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="线路坐标（经度,纬度 每行一个点，至少2个点）">
            <textarea
              value={lineForm.waypoints}
              onChange={(e) => setLineForm({ ...lineForm, waypoints: e.target.value })}
              placeholder={'116.47,39.91\n116.48,39.92\n116.49,39.93'}
              rows={5}
              className={textareaClass}
            />
          </FormField>
          <FormField label="描述">
            <textarea
              value={lineForm.description}
              onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })}
              placeholder="请输入线路描述"
              rows={2}
              className={textareaClass}
            />
          </FormField>
        </div>
      </Modal>

      {/* Tower Form Modal */}
      <Modal
        open={towerModalOpen}
        onClose={() => setTowerModalOpen(false)}
        title={editingTower ? '编辑杆塔' : '新增杆塔'}
        footer={
          <>
            <button
              onClick={() => setTowerModalOpen(false)}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              取消
            </button>
            <button
              onClick={handleSaveTower}
              disabled={submitting || !towerForm.line || !towerForm.code.trim()}
              className="px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors text-sm disabled:opacity-50"
            >
              {submitting ? '保存中...' : '保存'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="所属线路" required>
              <select
                value={towerForm.line}
                onChange={(e) => {
                  const lineId = Number(e.target.value)
                  setTowerForm({ ...towerForm, line: lineId, section: '' })
                  loadSections(lineId)
                }}
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
            <FormField label="所属区段">
              <select
                value={towerForm.section}
                onChange={(e) => setTowerForm({ ...towerForm, section: e.target.value })}
                className={selectClass}
              >
                <option value="">无</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="杆塔编号" required>
              <input
                type="text"
                value={towerForm.code}
                onChange={(e) => setTowerForm({ ...towerForm, code: e.target.value })}
                placeholder="如：N001"
                className={inputClass}
              />
            </FormField>
            <FormField label="杆塔类型">
              <select
                value={towerForm.tower_type}
                onChange={(e) => setTowerForm({ ...towerForm, tower_type: e.target.value })}
                className={selectClass}
              >
                {TOWER_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="高度(m)">
              <input
                type="number"
                value={towerForm.height}
                onChange={(e) => setTowerForm({ ...towerForm, height: e.target.value })}
                placeholder="如：45"
                className={inputClass}
              />
            </FormField>
            <FormField label="序号">
              <input
                type="number"
                value={towerForm.sequence}
                onChange={(e) => setTowerForm({ ...towerForm, sequence: e.target.value })}
                placeholder="如：1"
                className={inputClass}
              />
            </FormField>
            <div></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="经度">
              <input
                type="number"
                step="0.0001"
                value={towerForm.lon}
                onChange={(e) => setTowerForm({ ...towerForm, lon: e.target.value })}
                placeholder="如：116.4700"
                className={inputClass}
              />
            </FormField>
            <FormField label="纬度">
              <input
                type="number"
                step="0.0001"
                value={towerForm.lat}
                onChange={(e) => setTowerForm({ ...towerForm, lat: e.target.value })}
                placeholder="如：39.9100"
                className={inputClass}
              />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* Section Form Modal */}
      <Modal
        open={sectionModalOpen}
        onClose={() => setSectionModalOpen(false)}
        title={editingSection ? '编辑区段' : '新增区段'}
        footer={
          <>
            <button
              onClick={() => setSectionModalOpen(false)}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              取消
            </button>
            <button
              onClick={handleSaveSection}
              disabled={submitting || !sectionForm.line || !sectionForm.name.trim()}
              className="px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors text-sm disabled:opacity-50"
            >
              {submitting ? '保存中...' : '保存'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="所属线路" required>
            <select
              value={sectionForm.line}
              onChange={(e) => setSectionForm({ ...sectionForm, line: Number(e.target.value) })}
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
          <FormField label="区段名称" required>
            <input
              type="text"
              value={sectionForm.name}
              onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
              placeholder="请输入区段名称"
              className={inputClass}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="起始公里标(km)">
              <input
                type="number"
                step="0.01"
                value={sectionForm.start_km}
                onChange={(e) => setSectionForm({ ...sectionForm, start_km: e.target.value })}
                placeholder="如：0.00"
                className={inputClass}
              />
            </FormField>
            <FormField label="结束公里标(km)">
              <input
                type="number"
                step="0.01"
                value={sectionForm.end_km}
                onChange={(e) => setSectionForm({ ...sectionForm, end_km: e.target.value })}
                placeholder="如：5.00"
                className={inputClass}
              />
            </FormField>
          </div>
          <FormField label="描述">
            <textarea
              value={sectionForm.description}
              onChange={(e) => setSectionForm({ ...sectionForm, description: e.target.value })}
              placeholder="请输入区段描述"
              rows={2}
              className={textareaClass}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  )
}
