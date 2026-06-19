import { useState, useEffect } from 'react'
import { statsApi } from '../services/api'
import type { LineStat, SectionStat, TowerRank, HeatmapPoint, TrendData } from '../types'
import MapComponent from '../components/MapComponent'
import Badge from '../components/Badge'
import {
  BarChart3,
  TrendingUp,
  MapPin,
  AlertTriangle,
  PieChart as PieChartIcon,
  Activity,
} from 'lucide-react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, Popup } from 'react-leaflet'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import dayjs from 'dayjs'

export default function Analytics() {
  const [lineStats, setLineStats] = useState<LineStat[]>([])
  const [sectionStats, setSectionStats] = useState<SectionStat[]>([])
  const [towerRank, setTowerRank] = useState<TowerRank[]>([])
  const [heatmapData, setHeatmapData] = useState<HeatmapPoint[]>([])
  const [trendData, setTrendData] = useState<any>(null)
  const [defectTypes, setDefectTypes] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'sections' | 'lines' | 'towers'>('sections')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [linesRes, sectionsRes, towerRes, heatmapRes, trendRes, typesRes] = await Promise.all([
        statsApi.lines(),
        statsApi.sections(),
        statsApi.towerRank(20),
        statsApi.heatmap(),
        statsApi.trends(30),
        statsApi.defectTypes(),
      ])
      setLineStats(linesRes.data || [])
      setSectionStats(sectionsRes.data || [])
      setTowerRank(towerRes.data || [])
      setHeatmapData(heatmapRes.data || [])
      setTrendData(trendRes.data || { daily: [], by_type: {} })
      setDefectTypes(typesRes.data || {})
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const typeColorMap: Record<string, string> = {
    insulator: '#22D3EE',
    tower: '#F5B301',
    hardware: '#3DD68C',
    conductor: '#FF8A00',
    other: '#9333EA',
  }

  const typeLabelMap: Record<string, string> = {
    insulator: '绝缘子',
    tower: '塔体',
    hardware: '金具',
    conductor: '导线',
    other: '其他',
  }

  const pieData = Object.entries(defectTypes).map(([key, value]: [string, any]) => ({
    name: typeLabelMap[key] || key,
    value: value?.total || 0,
    color: typeColorMap[key] || '#64748B',
  }))

  const barData = sectionStats.slice(0, 10).map((s) => ({
    name: s.name,
    total: s.total_defects,
    critical: s.critical,
    major: s.major,
    minor: s.minor,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">高发故障区段统计分析</h2>
          <p className="text-text-muted text-sm mt-1">
            基于 PostGIS 空间聚合的缺陷数据统计
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <p className="text-text-muted text-sm mb-1">总缺陷数</p>
          <p className="font-display text-2xl font-bold text-danger">
            {lineStats.reduce((sum, l) => sum + l.total_defects, 0)}
          </p>
        </div>
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <p className="text-text-muted text-sm mb-1">涉及线路</p>
          <p className="font-display text-2xl font-bold text-cyan">
            {lineStats.length}
          </p>
        </div>
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <p className="text-text-muted text-sm mb-1">涉及区段</p>
          <p className="font-display text-2xl font-bold text-amber">
            {sectionStats.length}
          </p>
        </div>
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <p className="text-text-muted text-sm mb-1">最高发杆塔</p>
          <p className="font-display text-lg font-bold text-warning">
            {towerRank[0]?.code || '-'}
          </p>
          <p className="text-xs text-text-muted">
            {towerRank[0]?.defect_count || 0} 处缺陷
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border-dark flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-danger" />
              缺陷热力分布
            </h3>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span>缺陷密度</span>
              <div className="flex gap-0.5">
                {['bg-amber/20', 'bg-amber/50', 'bg-warning/70', 'bg-danger'].map((c, i) => (
                  <div key={i} className={`w-4 h-3 ${c}`}></div>
                ))}
              </div>
            </div>
          </div>
          <div className="h-96">
            <MapComponent center={[39.91, 116.47]} zoom={11}>
              {/* Lines */}
              {lineStats.map((line) =>
                line.coordinates && (
                  <Polyline
                    key={line.id}
                    positions={line.coordinates.map((c) => [c[1], c[0]])}
                    color="#22D3EE"
                    weight={2}
                    opacity={0.4}
                  />
                )
              )}
              {/* Heatmap points */}
              {heatmapData.map((point) => {
                const intensity = point.intensity || point.defect_count / 10
                const radius = 5 + point.defect_count * 2
                let color = '#F5B301'
                if (point.defect_count >= 5) color = '#FF8A00'
                if (point.defect_count >= 8) color = '#FF4D4F'
                return (
                  <CircleMarker
                    key={point.id}
                    center={[point.lat, point.lon]}
                    radius={Math.min(radius, 20)}
                    fillColor={color}
                    color={color}
                    weight={0}
                    fillOpacity={0.3 + intensity * 0.5}
                  >
                    <Tooltip direction="top" offset={[0, -5]}>
                      <div className="text-xs">
                        <p className="font-semibold">{point.code}</p>
                        <p>{point.line_name}</p>
                        <p className="text-danger">{point.defect_count} 处缺陷</p>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                )
              })}
            </MapComponent>
          </div>
        </div>

        {/* Tower ranking */}
        <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border-dark">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              缺陷杆塔 Top 10
            </h3>
          </div>
          <div className="divide-y divide-border-dark max-h-96 overflow-y-auto">
            {towerRank.slice(0, 10).map((tower, idx) => (
              <div key={tower.id} className="px-5 py-3 hover:bg-white/5">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx < 3
                        ? 'bg-danger/20 text-danger'
                        : 'bg-bg-card text-text-muted'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{tower.code}</span>
                      <span className="text-sm text-danger font-mono">
                        {tower.defect_count}
                      </span>
                    </div>
                    <div className="h-1.5 bg-bg-card rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber to-danger rounded-full"
                        style={{
                          width: `${Math.min(
                            (tower.defect_count / (towerRank[0]?.defect_count || 1)) * 100,
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-text-muted mt-1">{tower.line_name}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend chart */}
        <div className="lg:col-span-2 bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border-dark">
            <h3 className="font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan" />
              缺陷趋势（近30天）
            </h3>
          </div>
          <div className="p-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData?.daily || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232B36" />
                <XAxis
                  dataKey="date"
                  stroke="#64748B"
                  fontSize={11}
                  tickFormatter={(v) => dayjs(v).format('MM/DD')}
                />
                <YAxis stroke="#64748B" fontSize={11} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#11161D',
                    border: '1px solid #232B36',
                    borderRadius: '8px',
                    color: '#F1F5F9',
                  }}
                  formatter={(value: number) => [`${value} 处`, '缺陷']}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#22D3EE"
                  strokeWidth={2}
                  dot={{ fill: '#22D3EE', strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, fill: '#22D3EE' }}
                  name="缺陷数"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Defect type pie */}
        <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border-dark">
            <h3 className="font-semibold flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-amber" />
              缺陷类型分布
            </h3>
          </div>
          <div className="p-5 h-72 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#11161D',
                    border: '1px solid #232B36',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, name: string) => [`${value} 处`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="px-5 pb-4 grid grid-cols-2 gap-2">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                ></div>
                <span className="text-xs text-text-secondary">{item.name}</span>
                <span className="text-xs font-mono ml-auto">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section ranking bar */}
      <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border-dark flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan" />
            区段缺陷排名 Top 10
          </h3>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-danger rounded"></div>
              危急
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-warning rounded"></div>
              重大
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 bg-amber rounded"></div>
              一般
            </span>
          </div>
        </div>
        <div className="p-5 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={barData}
              layout="vertical"
              margin={{ left: 10, right: 30, top: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#232B36" horizontal={true} vertical={false} />
              <XAxis type="number" stroke="#64748B" fontSize={11} />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#64748B"
                fontSize={11}
                width={100}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: '#11161D',
                  border: '1px solid #232B36',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar dataKey="critical" name="危急" fill="#FF4D4F" stackId="a" />
              <Bar dataKey="major" name="重大" fill="#FF8A00" stackId="a" />
              <Bar dataKey="minor" name="一般" fill="#F5B301" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
