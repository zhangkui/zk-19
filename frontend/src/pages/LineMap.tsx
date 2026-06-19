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
  Layers,
} from 'lucide-react'
import { Polyline, CircleMarker, Tooltip } from 'react-leaflet'

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

export default function LineMap() {
  const [lines, setLines] = useState<Line[]>([])
  const [towers, setTowers] = useState<Tower[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [selectedLine, setSelectedLine] = useState<Line | null>(null)
  const [selectedTower, setSelectedTower] = useState<Tower | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<'lines' | 'towers' | 'sections'>('lines')
  const [submitting, setSubmitting] = useState(false)

  const [lineModalOpen, setLineModalOpen] = useState(false)
  const [editingLine, setEditingLine] = useState<Line | null>(null)
  const [towerModalOpen, setTowerModalOpen] = useState(false)
  const [sectionModalOpen, setSectionModalOpen] = useState(false)

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
      await towersApi.create(data)
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
    setSectionForm({
      line: selectedLine?.id || '',
      name: '',
      start_km: '',
      end_km: '',
      description: '',
    })
    setSectionModalOpen(true)
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
      await sectionsApi.create(data)
      setSectionModalOpen(false)
      await loadSections(Number(sectionForm.line))
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
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
                {towers.length === 0 && (
                  <div className="p-8 text-center text-text-muted text-sm">
                    <TowerIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    暂无杆塔，点击"新增杆塔"创建
                  </div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border-dark">
                {sections.map((section) => (
                  <div
                    key={section.id}
                    className="p-3 hover:bg-white/5 border-l-2 border-transparent transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{section.name}</span>
                      <Badge variant="default" size="sm">
                        {section.tower_count} 塔
                      </Badge>
                    </div>
                    <div className="text-xs text-text-muted">
                      {section.start_km}km - {section.end_km}km
                    </div>
                  </div>
                ))}
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
                {Object.entries(voltageColors).slice(0, 4).map(([label, color]) => (
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
        title="新增杆塔"
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
        title="新增区段"
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
