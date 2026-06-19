import { useState, useEffect } from 'react'
import { statsApi, alertsApi, workOrdersApi } from '../services/api'
import type { OverviewStats, Alert, WorkOrder } from '../types'
import StatCard from '../components/StatCard'
import MapComponent from '../components/MapComponent'
import Badge from '../components/Badge'
import {
  Power,
  Zap,
  AlertTriangle,
  Wrench,
  TrendingUp,
  Activity,
  FileSearch,
  Clock,
} from 'lucide-react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, Tooltip } from 'react-leaflet'
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
} from 'recharts'
import dayjs from 'dayjs'

export default function Dashboard() {
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([])
  const [recentWorkOrders, setRecentWorkOrders] = useState<WorkOrder[]>([])
  const [trendData, setTrendData] = useState<any[]>([])
  const [lineData, setLineData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [statsRes, alertsRes, woRes, trendRes, linesRes] = await Promise.all([
        statsApi.overview(),
        alertsApi.list({ page_size: 5, ordering: '-created_at' }),
        workOrdersApi.list({ page_size: 5, ordering: '-created_at' }),
        statsApi.trends(7),
        statsApi.lines(),
      ])
      setStats(statsRes.data)
      setRecentAlerts(alertsRes.data.results || alertsRes.data)
      setRecentWorkOrders(woRes.data.results || woRes.data)
      setTrendData(trendRes.data.daily || [])
      setLineData(linesRes.data || [])
    } catch (e) {
      console.error('Failed to load dashboard data', e)
    } finally {
      setLoading(false)
    }
  }

  const defectTypeData = stats
    ? [
        { name: '危急', value: stats.by_severity.critical, color: '#FF4D4F' },
        { name: '重大', value: stats.by_severity.major, color: '#FF8A00' },
        { name: '一般', value: stats.by_severity.minor, color: '#F5B301' },
      ]
    : []

  const alertLevelColor: Record<string, string> = {
    critical: 'danger',
    major: 'warning',
    minor: 'amber',
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="输电线路"
          value={stats?.lines || 0}
          icon={<Power className="w-6 h-6" />}
          color="cyan"
        />
        <StatCard
          title="杆塔总数"
          value={stats?.towers || 0}
          icon={<Zap className="w-6 h-6" />}
          color="amber"
        />
        <StatCard
          title="缺陷总数"
          value={stats?.defects || 0}
          icon={<FileSearch className="w-6 h-6" />}
          color="warning"
          trendLabel="今日新增"
        />
        <StatCard
          title="待处置告警"
          value={stats?.alerts || 0}
          icon={<AlertTriangle className="w-6 h-6" />}
          color="danger"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border-dark flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan" />
              线路空间分布
            </h3>
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan"></span>线路
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber"></span>杆塔
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-danger animate-pulse"></span>告警点
              </span>
            </div>
          </div>
          <div className="h-96">
            <MapComponent center={[39.91, 116.47]} zoom={11}>
              {lineData.filter((line: any) => line.coordinates).map((line: any) => (
                <Polyline
                  key={line.id}
                  positions={line.coordinates.map((c: [number, number]) => [c[1], c[0]])}
                  color="#22D3EE"
                  weight={3}
                  opacity={0.8}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                    <div className="text-xs">
                      <p className="font-semibold text-cyan">{line.name}</p>
                      <p>缺陷: {line.total_defects} 处</p>
                    </div>
                  </Tooltip>
                </Polyline>
              ))}
            </MapComponent>
          </div>
        </div>

        {/* Recent alerts */}
        <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border-dark flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-danger" />
              最新告警
            </h3>
            <span className="text-xs text-danger">
              {recentAlerts.filter((a) => a.status === 'open').length} 条待处置
            </span>
          </div>
          <div className="divide-y divide-border-dark max-h-96 overflow-y-auto">
            {recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className="px-5 py-3 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <p className="text-sm font-medium truncate">{alert.title}</p>
                  <Badge variant={alertLevelColor[alert.level] as any} size="sm">
                    {alert.level_display}
                  </Badge>
                </div>
                <p className="text-xs text-text-muted line-clamp-2 mb-2">
                  {alert.tower_code && `#${alert.tower_code} `}
                  {alert.content}
                </p>
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {dayjs(alert.created_at).fromNow()}
                  </span>
                  <Badge
                    variant={alert.status === 'open' ? 'danger' : 'success'}
                    size="sm"
                  >
                    {alert.status_display}
                  </Badge>
                </div>
              </div>
            ))}
            {recentAlerts.length === 0 && (
              <div className="p-8 text-center text-text-muted text-sm">
                暂无告警信息
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend chart */}
        <div className="lg:col-span-2 bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border-dark">
            <h3 className="font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan" />
              缺陷趋势（近7天）
            </h3>
          </div>
          <div className="p-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
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
                  labelStyle={{ color: '#F1F5F9' }}
                  formatter={(value: number) => [`${value} 处`, '缺陷']}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#22D3EE"
                  strokeWidth={2}
                  dot={{ fill: '#22D3EE', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#22D3EE' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Defect severity pie */}
        <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border-dark">
            <h3 className="font-semibold flex items-center gap-2">
              <FileSearch className="w-5 h-5 text-amber" />
              缺陷严重度分布
            </h3>
          </div>
          <div className="p-5 h-72 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={defectTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {defectTypeData.map((entry, index) => (
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
          <div className="px-5 pb-4 flex justify-around">
            {defectTypeData.map((item) => (
              <div key={item.name} className="text-center">
                <p className="text-lg font-bold" style={{ color: item.color }}>
                  {item.value}
                </p>
                <p className="text-xs text-text-muted">{item.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent work orders */}
      <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border-dark flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Wrench className="w-5 h-5 text-success" />
            最新工单
          </h3>
          <span className="text-xs text-text-muted">
            待处理 {stats?.pending_workorders || 0} 条
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-muted text-xs bg-bg-card/50">
                <th className="text-left px-5 py-3 font-medium">工单编号</th>
                <th className="text-left px-4 py-3 font-medium">标题</th>
                <th className="text-left px-4 py-3 font-medium">杆塔</th>
                <th className="text-left px-4 py-3 font-medium">严重度</th>
                <th className="text-left px-4 py-3 font-medium">状态</th>
                <th className="text-left px-4 py-3 font-medium">责任人</th>
                <th className="text-left px-4 py-3 font-medium">创建时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dark">
              {recentWorkOrders.map((wo) => (
                <tr key={wo.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3 font-mono text-cyan text-xs">
                    {wo.code}
                  </td>
                  <td className="px-4 py-3">{wo.title}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {wo.tower_code}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        wo.severity === 'critical'
                          ? 'danger'
                          : wo.severity === 'major'
                          ? 'warning'
                          : 'amber'
                      }
                      size="sm"
                    >
                      {wo.severity_display}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        wo.status === 'closed'
                          ? 'success'
                          : wo.status === 'processing'
                          ? 'cyan'
                          : 'default'
                      }
                      size="sm"
                    >
                      {wo.status_display}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {wo.assignee_name || '未指派'}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {dayjs(wo.created_at).format('YYYY-MM-DD HH:mm')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
