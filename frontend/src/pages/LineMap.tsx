import { useState, useEffect, useRef } from 'react'
import { linesApi, towersApi, sectionsApi, changeHistoryApi } from '../services/api'
import type { Line, Tower, Section, ChangeHistory as ChangeHistoryType } from '../types'
import type { MapPoint } from '../components/MapComponent'
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
  MapPin,
  Upload,
  Download,
  History,
  Scissors,
  Magnet,
  CheckCircle,
  AlertCircle,
  FileText,
} from 'lucide-react'
import { Polyline, CircleMarker, Tooltip } from 'react-leaflet'
import { useAuthStore } from '../store/authStore'
import { isAdmin } from '../utils'
import dayjs from 'dayjs'

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

function isValidLon(v: string | number): boolean {
  if (v === '' || v === null || v === undefined) return true
  const n = Number(v)
  return !isNaN(n) && n >= -180 && n <= 180
}

function isValidLat(v: string | number): boolean {
  if (v === '' || v === null || v === undefined) return true
  const n = Number(v)
  return !isNaN(n) && n >= -90 && n <= 90
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function LineMap() {
  const { user } = useAuthStore()
  const [lines, setLines] = useState<Line[]>([])
  const [towers, setTowers] = useState<Tower[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [history, setHistory] = useState<ChangeHistoryType[]>([])
  const [selectedLine, setSelectedLine] = useState<Line | null>(null)
  const [selectedTower, setSelectedTower] = useState<Tower | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<'lines' | 'towers' | 'sections' | 'history'>('lines')
  const [submitting, setSubmitting] = useState(false)
  const [showSections, setShowSections] = useState(true)
  const [enableSnap, setEnableSnap] = useState(true)

  const [pickMode, setPickMode] = useState<null | 'line' | 'tower'>(null)
  const [tempPoints, setTempPoints] = useState<MapPoint[]>([])

  const [lineModalOpen, setLineModalOpen] = useState(false)
  const [editingLine, setEditingLine] = useState<Line | null>(null)
  const [towerModalOpen, setTowerModalOpen] = useState(false)
  const [editingTower, setEditingTower] = useState<Tower | null>(null)
  const [sectionModalOpen, setSectionModalOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<Section | null>(null)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [splitModalOpen, setSplitModalOpen] = useState(false)
  const [splitSections, setSplitSections] = useState<{ name: string; start_km: string; end_km: string }[]>([
    { name: '', start_km: '0', end_km: '2' },
  ])

  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLineId, setImportLineId] = useState<string>('')
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [lineForm, setLineForm] = useState({
    name: '',
    voltage: '220kV',
    description: '',
    waypoints: '',
  })
  const [lineFormErrors, setLineFormErrors] = useState<{ waypoints?: string }>({})

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
  const [towerFormErrors, setTowerFormErrors] = useState<{ lon?: string; lat?: string }>({})

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
    loadHistory()
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

  const loadHistory = async () => {
    try {
      const res = await changeHistoryApi.list({ page_size: 50, ordering: '-created_at' })
      setHistory(res.data.results || res.data)
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

  const parseWaypointsText = (text: string): [number, number][] => {
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [lon, lat] = l.split(',').map((v) => parseFloat(v.trim()))
        return [lon, lat] as [number, number]
      })
      .filter((wp) => !isNaN(wp[0]) && !isNaN(wp[1]))
  }

  const openCreateLine = () => {
    setEditingLine(null)
    setLineForm({ name: '', voltage: '220kV', description: '', waypoints: '' })
    setLineFormErrors({})
    setTempPoints([])
    setPickMode('line')
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
    setTempPoints(
      (selectedLine.coordinates || []).map((c, idx) => ({
        lon: c[0],
        lat: c[1],
        label: `#${idx + 1}`,
      }))
    )
    setLineFormErrors({})
    setPickMode('line')
    setLineModalOpen(true)
  }

  const handleLinePickPoint = (lat: number, lon: number) => {
    const newPt: MapPoint = { lon, lat, label: `#${tempPoints.length + 1}` }
    const newPts = [...tempPoints, newPt]
    setTempPoints(newPts)
    setLineForm({
      ...lineForm,
      waypoints: newPts.map((p) => `${p.lon},${p.lat}`).join('\n'),
    })
  }

  const handleTowerPickPoint = (lat: number, lon: number) => {
    const newPts = [{ lon, lat, label: '杆塔位置' }]
    setTempPoints(newPts)
    setTowerForm({
      ...towerForm,
      lon: String(Number(lon.toFixed(6))),
      lat: String(Number(lat.toFixed(6))),
    })
    setTowerFormErrors({})
  }

  const handleClearTempPoints = () => {
    setTempPoints([])
    if (pickMode === 'line') {
      setLineForm({ ...lineForm, waypoints: '' })
    } else if (pickMode === 'tower') {
      setTowerForm({ ...towerForm, lon: '', lat: '' })
    }
  }

  const closeLineModal = () => {
    setPickMode(null)
    setTempPoints([])
    setLineModalOpen(false)
  }

  const handleSaveLine = async () => {
    if (!lineForm.name.trim()) return
    const waypoints = parseWaypointsText(lineForm.waypoints)
    if (waypoints.length > 0 && waypoints.length < 2) {
      setLineFormErrors({ waypoints: '至少需要2个坐标点' })
      return
    }
    for (const wp of waypoints) {
      if (!isValidLon(wp[0]) || !isValidLat(wp[1])) {
        setLineFormErrors({ waypoints: '坐标格式或范围不正确（经度-180~180，纬度-90~90）' })
        return
      }
    }
    setSubmitting(true)
    try {
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
      setPickMode(null)
      setTempPoints([])
      setLineModalOpen(false)
      await loadLines()
      await loadHistory()
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
    setTowerFormErrors({})
    setTempPoints([])
    setPickMode('tower')
    setTowerModalOpen(true)
  }

  const openEditTower = (tower: Tower) => {
    setEditingTower(tower)
    setTowerForm({
      line: tower.line ?? '',
      section: tower.section ?? '',
      code: tower.code,
      tower_type: tower.tower_type,
      height: tower.height ?? '',
      sequence: tower.sequence ?? '',
      lon: tower.coordinates?.lon ?? '',
      lat: tower.coordinates?.lat ?? '',
    })
    setTempPoints(
      tower.coordinates
        ? [{ lon: tower.coordinates.lon, lat: tower.coordinates.lat, label: tower.code }]
        : []
    )
    setTowerFormErrors({})
    setPickMode('tower')
    setTowerModalOpen(true)
  }

  const closeTowerModal = () => {
    setPickMode(null)
    setTempPoints([])
    setTowerModalOpen(false)
  }

  const handleDeleteTower = async (tower: Tower) => {
    if (!confirm(`确定要删除杆塔【${tower.code}】吗？此操作不可恢复。`)) return
    try {
      await towersApi.delete(tower.id)
      if (selectedLine) {
        await loadTowers(selectedLine.id)
        await loadLines()
        await loadHistory()
      }
    } catch (e) {
      console.error(e)
      alert('删除失败')
    }
  }

  const handleSaveTower = async () => {
    if (!towerForm.line || !towerForm.code.trim()) return
    const errors: { lon?: string; lat?: string } = {}
    if (towerForm.lon !== '' && !isValidLon(towerForm.lon)) {
      errors.lon = '经度范围必须在-180到180之间'
    }
    if (towerForm.lat !== '' && !isValidLat(towerForm.lat)) {
      errors.lat = '纬度范围必须在-90到90之间'
    }
    if (Object.keys(errors).length > 0) {
      setTowerFormErrors(errors)
      return
    }
    setSubmitting(true)
    try {
      const data: any = {
        line: Number(towerForm.line),
        code: towerForm.code,
        tower_type: towerForm.tower_type,
        snapped: enableSnap,
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
      setPickMode(null)
      setTempPoints([])
      setTowerModalOpen(false)
      await loadTowers(Number(towerForm.line))
      await loadLines()
      await loadHistory()
    } catch (e: any) {
      console.error(e)
      if (e.response?.data) {
        const resp = e.response.data
        if (resp.lon) setTowerFormErrors({ ...errors, lon: resp.lon[0] })
        if (resp.lat) setTowerFormErrors({ ...errors, lat: resp.lat[0] })
      }
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
      line: section.line ?? '',
      name: section.name,
      start_km: section.start_km ?? '',
      end_km: section.end_km ?? '',
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
        await loadHistory()
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
      await loadHistory()
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
      await loadHistory()
    } catch (e) {
      console.error(e)
      alert('删除失败')
    }
  }

  const handleExport = async (type: 'lines' | 'towers' | 'sections') => {
    try {
      let res: any
      if (type === 'lines') {
        res = await linesApi.export()
      } else if (type === 'towers') {
        res = await towersApi.export(selectedLine?.id)
      } else {
        res = await sectionsApi.export()
      }
      const filename = `${type}_${dayjs().format('YYYYMMDD_HHmmss')}.csv`
      downloadBlob(new Blob([res.data]), filename)
    } catch (e) {
      console.error(e)
      alert('导出失败')
    }
  }

  const handleImportFile = async () => {
    if (!importFile || !importLineId) {
      alert('请选择文件和线路')
      return
    }
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      formData.append('line_id', importLineId)
      const res = await towersApi.importCsv(formData)
      setImportResult(res.data)
      await loadTowers(Number(importLineId))
      await loadLines()
      await loadHistory()
    } catch (e: any) {
      console.error(e)
      alert(e.response?.data?.error || '导入失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadTemplate = () => {
    const headers = ['杆塔编号', '经度', '纬度', '杆塔类型', '高度(m)', '序号']
    const sampleRow = ['N001', '116.4700', '39.9100', 'straight', '45', '1']
    const bom = '\uFEFF'
    const csvContent = bom + [headers, sampleRow].map((row) => row.join(',')).join('\n')
    downloadBlob(new Blob([csvContent], { type: 'text/csv;charset=utf-8-sig' }), '杆塔导入模版.csv')
  }

  const handleSplitSections = async () => {
    if (!selectedLine) return
    const valid = splitSections.filter((s) => s.name.trim() && s.start_km !== '' && s.end_km !== '')
    if (valid.length === 0) {
      alert('请至少填写一个有效的区段')
      return
    }
    const parsed = valid.map((s) => ({
      name: s.name.trim(),
      start_km: Number(s.start_km),
      end_km: Number(s.end_km),
    }))
    for (const s of parsed) {
      if (isNaN(s.start_km) || isNaN(s.end_km)) {
        alert(`区段【${s.name}】公里标格式不正确`)
        return
      }
      if (s.start_km < 0 || s.end_km < 0) {
        alert(`区段【${s.name}】公里标不能为负数`)
        return
      }
      if (s.start_km >= s.end_km) {
        alert(`区段【${s.name}】起始公里标必须小于结束公里标`)
        return
      }
    }
    const nameSet = new Set<string>()
    for (const s of parsed) {
      if (nameSet.has(s.name)) {
        alert(`区段名称重复：${s.name}`)
        return
      }
      nameSet.add(s.name)
    }
    const sorted = [...parsed].sort((a, b) => a.start_km - b.start_km)
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].end_km > sorted[i + 1].start_km) {
        alert(`区段范围重叠：${sorted[i].name}(${sorted[i].start_km}-${sorted[i].end_km}km)与${sorted[i + 1].name}(${sorted[i + 1].start_km}-${sorted[i + 1].end_km}km)`)
        return
      }
    }
    const existingNames = new Set(sections.map((s) => s.name))
    for (const s of parsed) {
      if (existingNames.has(s.name)) {
        alert(`区段名称已存在：${s.name}`)
        return
      }
    }
    for (const s of parsed) {
      for (const ex of sections) {
        if (!(s.end_km <= ex.start_km || s.start_km >= ex.end_km)) {
          alert(`新区段${s.name}(${s.start_km}-${s.end_km}km)与已有区段${ex.name}(${ex.start_km}-${ex.end_km}km)范围重叠`)
          return
        }
      }
    }
    setSubmitting(true)
    try {
      await linesApi.splitSections(selectedLine.id, {
        sections: parsed.map((s) => ({
          name: s.name,
          start_km: s.start_km,
          end_km: s.end_km,
        })),
        auto_assign: true,
      })
      setSplitModalOpen(false)
      setSplitSections([{ name: '', start_km: '0', end_km: '2' }])
      await loadSections(selectedLine.id)
      await loadTowers(selectedLine.id)
      await loadHistory()
    } catch (e: any) {
      console.error(e)
      alert(e.response?.data?.error || '切分失败')
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

  const actionColorMap: Record<string, string> = {
    create: 'success',
    update: 'cyan',
    delete: 'danger',
    import: 'warning',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">线路地图建模</h2>
          <p className="text-text-muted text-sm mt-1">
            线路 — 区段 — 杆塔空间建模与管理
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          <button
            onClick={() => setEnableSnap(!enableSnap)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors text-sm ${
              enableSnap
                ? 'border-cyan/40 text-cyan bg-cyan/10'
                : 'border-border-dark text-text-secondary hover:text-text-primary hover:bg-white/5'
            }`}
            title="新增杆塔时自动吸附到线路附近（50米范围内）"
          >
            <Magnet className="w-4 h-4" />
            自动吸附
          </button>
          {canManage && (
            <>
              <div className="h-6 w-px bg-border-dark mx-1"></div>
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
              <button
                onClick={() => {
                  setImportLineId(selectedLine?.id ? String(selectedLine.id) : '')
                  setImportFile(null)
                  setImportResult(null)
                  setImportModalOpen(true)
                }}
                disabled={!selectedLine}
                className="flex items-center gap-2 px-4 py-2 border border-border-dark text-text-secondary hover:text-text-primary hover:bg-white/5 font-medium rounded-lg transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                导入杆塔
              </button>
              <button
                onClick={() => {
                  setSplitSections([{ name: '', start_km: '0', end_km: '2' }])
                  setSplitModalOpen(true)
                }}
                disabled={!selectedLine}
                className="flex items-center gap-2 px-4 py-2 border border-border-dark text-text-secondary hover:text-text-primary hover:bg-white/5 font-medium rounded-lg transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Scissors className="w-4 h-4" />
                切分区段
              </button>
              <div className="h-6 w-px bg-border-dark mx-1"></div>
              <button
                onClick={() => handleExport('lines')}
                className="flex items-center gap-2 px-3 py-2 border border-border-dark text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-lg transition-colors text-sm"
                title="导出线路CSV"
              >
                <Download className="w-4 h-4" />
                线路
              </button>
              <button
                onClick={() => handleExport('towers')}
                disabled={!selectedLine}
                className="flex items-center gap-2 px-3 py-2 border border-border-dark text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-lg transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                title="导出杆塔CSV"
              >
                <Download className="w-4 h-4" />
                杆塔
              </button>
              <button
                onClick={() => handleExport('sections')}
                className="flex items-center gap-2 px-3 py-2 border border-border-dark text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-lg transition-colors text-sm"
                title="导出区段CSV"
              >
                <Download className="w-4 h-4" />
                区段
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-13rem)]">
        <div className="w-80 bg-bg-panel border border-border-dark rounded-xl overflow-hidden flex flex-col">
          <div className="flex border-b border-border-dark">
            {[
              { key: 'lines', label: '线路', icon: Map },
              { key: 'towers', label: '杆塔', icon: TowerIcon },
              { key: 'sections', label: '区段', icon: Layers },
              { key: 'history', label: '历史', icon: History },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => {
                  setSidebarTab(key as any)
                  if (key === 'history') loadHistory()
                }}
                className={`flex-1 py-3 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                  sidebarTab === key
                    ? 'text-cyan border-b-2 border-cyan bg-cyan/5'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

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
                      {tower.section_name && (
                        <span className="ml-2" style={{ color: getSectionColor(tower.section) }}>
                          [{tower.section_name}]
                        </span>
                      )}
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
            ) : sidebarTab === 'sections' ? (
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
                    暂无区段，点击"新增区段"或"切分区段"创建
                  </div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border-dark">
                {history.map((h) => (
                  <div key={h.id} className="p-3 hover:bg-white/5 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">{h.object_name}</span>
                      <Badge variant={actionColorMap[h.action] as any} size="sm">
                        {h.action_display}
                      </Badge>
                    </div>
                    <div className="text-xs text-text-muted flex items-center gap-2">
                      <span className="text-text-secondary">{h.content_type_display}</span>
                      <span>·</span>
                      <span>{h.user_name || '系统'}</span>
                    </div>
                    <div className="text-xs text-text-muted mt-1">
                      {dayjs(h.created_at).format('MM-DD HH:mm')}
                    </div>
                  </div>
                ))}
                {history.length === 0 && (
                  <div className="p-8 text-center text-text-muted text-sm">
                    <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    暂无修改历史
                  </div>
                )}
              </div>
            )}
          </div>

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
                {selectedTower.section_name && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">区段</span>
                    <span style={{ color: getSectionColor(selectedTower.section) }}>
                      {selectedTower.section_name}
                    </span>
                  </div>
                )}
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

        <div className="flex-1 bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
          <div className="h-full relative">
            <MapComponent
              center={selectedLine?.coordinates?.[0] ? [selectedLine.coordinates[0][1], selectedLine.coordinates[0][0]] : [39.91, 116.47]}
              zoom={12}
              pickMode={!!pickMode}
              pickModeType={pickMode === 'line' ? 'multi' : 'single'}
              onPickPoint={pickMode === 'line' ? handleLinePickPoint : handleTowerPickPoint}
              tempPoints={tempPoints}
              onClearTempPoints={handleClearTempPoints}
            >
              {lines.map((line) =>
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
              )}
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

      <Modal
        open={lineModalOpen}
        onClose={closeLineModal}
        title={editingLine ? '编辑线路' : '新增线路'}
        width="max-w-lg"
        nonBlocking
        footer={
          <>
            <button
              onClick={closeLineModal}
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
          <div className="grid grid-cols-2 gap-4">
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
          </div>
          <div className="bg-bg-card border border-border-dark rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber" />
                地图选点
              </p>
              <span className="text-xs text-text-muted">
                已选 <span className="text-amber font-medium">{tempPoints.length}</span> 个点
              </span>
            </div>
            <p className="text-xs text-text-muted">
              打开弹窗后在右侧地图上点击选择坐标点，至少需要2个点。可在下方手动调整坐标。
            </p>
          </div>
          <FormField
            label={`线路坐标（经度,纬度 每行一个点，至少2个点）${tempPoints.length > 0 ? ` · 已选 ${tempPoints.length} 个点` : ''}`}
          >
            <textarea
              value={lineForm.waypoints}
              onChange={(e) => {
                setLineForm({ ...lineForm, waypoints: e.target.value })
                const wps = parseWaypointsText(e.target.value)
                setTempPoints(wps.map((c, idx) => ({ lon: c[0], lat: c[1], label: `#${idx + 1}` })))
              }}
              placeholder={'116.47,39.91\n116.48,39.92\n116.49,39.93'}
              rows={5}
              className={textareaClass}
            />
            {lineFormErrors.waypoints && (
              <p className="text-xs text-danger mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {lineFormErrors.waypoints}
              </p>
            )}
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

      <Modal
        open={towerModalOpen}
        onClose={closeTowerModal}
        title={editingTower ? '编辑杆塔' : '新增杆塔'}
        width="max-w-lg"
        nonBlocking
        footer={
          <>
            <button
              onClick={closeTowerModal}
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
                <option value="">自动分配</option>
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
            <FormField label="自动吸附">
              <div className="flex items-center h-[42px]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableSnap}
                    onChange={(e) => setEnableSnap(e.target.checked)}
                    className="w-4 h-4 rounded border-border-dark bg-bg-card text-cyan focus:ring-cyan/50"
                  />
                  <span className="text-sm text-text-secondary">50米内吸附</span>
                </label>
              </div>
            </FormField>
          </div>
          <div className="bg-bg-card border border-border-dark rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber" />
                地图点选坐标
              </p>
              {tempPoints.length > 0 && (
                <Badge variant="success" size="sm">
                  <CheckCircle className="w-3 h-3 inline mr-1" />
                  已选点
                </Badge>
              )}
            </div>
            <p className="text-xs text-text-muted">
              在右侧地图上点击选择杆塔位置，也可在下方手动输入经纬度。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="经度">
              <input
                type="number"
                step="0.000001"
                value={towerForm.lon}
                onChange={(e) => {
                  const v = e.target.value
                  setTowerForm({ ...towerForm, lon: v })
                  if (v !== '' && towerForm.lat !== '') {
                    const lon = Number(v)
                    const lat = Number(towerForm.lat)
                    if (!isNaN(lon) && !isNaN(lat)) {
                      setTempPoints([{ lon, lat, label: '杆塔位置' }])
                    }
                  } else {
                    setTempPoints([])
                  }
                }}
                placeholder="经度：-180 ~ 180，如 116.4700"
                className={`${inputClass} ${towerFormErrors.lon ? 'border-danger/50 focus:border-danger/50' : ''}`}
              />
              {towerFormErrors.lon && (
                <p className="text-xs text-danger mt-1">{towerFormErrors.lon}</p>
              )}
            </FormField>
            <FormField label="纬度">
              <input
                type="number"
                step="0.000001"
                value={towerForm.lat}
                onChange={(e) => {
                  const v = e.target.value
                  setTowerForm({ ...towerForm, lat: v })
                  if (v !== '' && towerForm.lon !== '') {
                    const lat = Number(v)
                    const lon = Number(towerForm.lon)
                    if (!isNaN(lon) && !isNaN(lat)) {
                      setTempPoints([{ lon, lat, label: '杆塔位置' }])
                    }
                  } else {
                    setTempPoints([])
                  }
                }}
                placeholder="纬度：-90 ~ 90，如 39.9100"
                className={`${inputClass} ${towerFormErrors.lat ? 'border-danger/50 focus:border-danger/50' : ''}`}
              />
              {towerFormErrors.lat && (
                <p className="text-xs text-danger mt-1">{towerFormErrors.lat}</p>
              )}
            </FormField>
          </div>
        </div>
      </Modal>

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

      <Modal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="杆塔坐标批量导入"
        footer={
          <>
            <button
              onClick={() => setImportModalOpen(false)}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              关闭
            </button>
            <button
              onClick={handleImportFile}
              disabled={submitting || !importFile || !importLineId}
              className="px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors text-sm disabled:opacity-50"
            >
              {submitting ? '导入中...' : '开始导入'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="目标线路" required>
            <select
              value={importLineId}
              onChange={(e) => setImportLineId(e.target.value)}
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
          <FormField label="CSV文件" required>
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                importFile
                  ? 'border-success/50 bg-success/5'
                  : 'border-border-dark hover:border-cyan/50 hover:bg-cyan/5'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] || null)
                  setImportResult(null)
                }}
              />
              {importFile ? (
                <div>
                  <FileText className="w-8 h-8 mx-auto mb-2 text-success" />
                  <p className="text-sm font-medium">{importFile.name}</p>
                  <p className="text-xs text-text-muted mt-1">
                    {(importFile.size / 1024).toFixed(1)} KB · 点击重新选择
                  </p>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 mx-auto mb-2 text-text-muted" />
                  <p className="text-sm font-medium">点击选择CSV文件</p>
                  <p className="text-xs text-text-muted mt-1">
                    支持 .csv 格式
                  </p>
                </div>
              )}
            </div>
          </FormField>
          <div className="bg-bg-card border border-border-dark rounded-lg p-3 text-xs text-text-muted">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-text-secondary">CSV列名要求（任一即可）：</p>
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1 px-2.5 py-1 border border-cyan/40 text-cyan rounded-md hover:bg-cyan/10 transition-colors text-xs font-medium"
              >
                <Download className="w-3 h-3" />
                下载模版
              </button>
            </div>
            <ul className="space-y-1 list-disc list-inside">
              <li>杆塔编号 / code / 编号</li>
              <li>经度 / lon / 经度(longitude)</li>
              <li>纬度 / lat / 纬度(latitude)</li>
              <li>可选：杆塔类型、高度、序号</li>
            </ul>
          </div>
          {importResult && (
            <div className={`rounded-lg p-4 ${importResult.errors.length > 0 ? 'bg-warning/10 border border-warning/30' : 'bg-success/10 border border-success/30'}`}>
              <div className="flex items-center gap-2 mb-2">
                {importResult.errors.length > 0 ? (
                  <AlertCircle className="w-5 h-5 text-warning" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-success" />
                )}
                <span className="font-medium text-sm">
                  {importResult.message}
                </span>
              </div>
              {importResult.errors.length > 0 && (
                <div className="text-xs text-text-muted mt-2 max-h-32 overflow-y-auto space-y-1">
                  {importResult.errors.map((err, i) => (
                    <p key={i} className="text-warning">· {err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={splitModalOpen}
        onClose={() => setSplitModalOpen(false)}
        title="按线路切分区段"
        width="max-w-xl"
        footer={
          <>
            <button
              onClick={() => setSplitModalOpen(false)}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              取消
            </button>
            <button
              onClick={handleSplitSections}
              disabled={submitting}
              className="px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors text-sm disabled:opacity-50"
            >
              {submitting ? '切分中...' : '确认切分'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-bg-card border border-border-dark rounded-lg p-3 text-xs text-text-muted">
            <p className="font-medium text-text-secondary mb-1">切分说明</p>
            <p>设置多个区段的公里标范围，切分后杆塔会根据在线路上的投影位置自动关联到对应区段。</p>
          </div>
          <div className="space-y-3">
            {splitSections.map((sec, idx) => (
              <div key={idx} className="flex items-end gap-3 p-3 bg-bg-card border border-border-dark rounded-lg">
                <div className="flex-1">
                  <FormField label={`区段 ${idx + 1} 名称`} required={idx === 0}>
                    <input
                      type="text"
                      value={sec.name}
                      onChange={(e) => {
                        const newSections = [...splitSections]
                        newSections[idx].name = e.target.value
                        setSplitSections(newSections)
                      }}
                      placeholder={`如：第${idx + 1}区段`}
                      className={inputClass}
                    />
                  </FormField>
                </div>
                <div className="w-28">
                  <FormField label="起始km">
                    <input
                      type="number"
                      step="0.01"
                      value={sec.start_km}
                      onChange={(e) => {
                        const newSections = [...splitSections]
                        newSections[idx].start_km = e.target.value
                        setSplitSections(newSections)
                      }}
                      className={inputClass}
                    />
                  </FormField>
                </div>
                <div className="w-28">
                  <FormField label="结束km">
                    <input
                      type="number"
                      step="0.01"
                      value={sec.end_km}
                      onChange={(e) => {
                        const newSections = [...splitSections]
                        newSections[idx].end_km = e.target.value
                        setSplitSections(newSections)
                      }}
                      className={inputClass}
                    />
                  </FormField>
                </div>
                {splitSections.length > 1 && (
                  <button
                    onClick={() => {
                      const newSections = splitSections.filter((_, i) => i !== idx)
                      setSplitSections(newSections)
                    }}
                    className="p-2 text-text-muted hover:text-danger hover:bg-white/5 rounded-lg transition-colors mb-[2px]"
                    title="删除该区段"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              const last = splitSections[splitSections.length - 1]
              setSplitSections([
                ...splitSections,
                {
                  name: '',
                  start_km: last ? last.end_km : '0',
                  end_km: last ? String(Number(last.end_km) + 2) : '2',
                },
              ])
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-border-dark text-text-muted hover:text-text-primary hover:bg-white/5 rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            添加区段
          </button>
        </div>
      </Modal>
    </div>
  )
}

