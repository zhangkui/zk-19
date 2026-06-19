import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { defectsApi } from '../services/api'
import type { Defect } from '../types'
import Badge from '../components/Badge'
import {
  FileSearch,
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import dayjs from 'dayjs'

const severityColors: Record<string, string> = {
  critical: 'danger',
  major: 'warning',
  minor: 'amber',
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: '待审核', color: 'amber', icon: Clock },
  confirmed: { label: '已确认', color: 'success', icon: CheckCircle },
  rejected: { label: '已驳回', color: 'default', icon: XCircle },
}

export default function Defects() {
  const [defects, setDefects] = useState<Defect[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    loadDefects()
  }, [typeFilter, severityFilter, statusFilter])

  const loadDefects = async () => {
    setLoading(true)
    try {
      const params: any = { page_size: 50 }
      if (typeFilter) params.defect_type = typeFilter
      if (severityFilter) params.severity = severityFilter
      if (statusFilter) params.status = statusFilter
      if (searchText) params.search = searchText
      const res = await defectsApi.list(params)
      setDefects(res.data.results || res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">缺陷识别</h2>
          <p className="text-text-muted text-sm mt-1">
            共 {defects.length} 条缺陷记录
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadDefects()}
            placeholder="搜索缺陷描述、类型..."
            className="w-full pl-10 pr-4 py-2 bg-bg-panel border border-border-dark rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-cyan/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-text-muted" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-bg-panel border border-border-dark rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan/50"
          >
            <option value="">全部类型</option>
            <option value="insulator">绝缘子</option>
            <option value="tower">塔体</option>
            <option value="hardware">金具</option>
            <option value="conductor">导线</option>
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 bg-bg-panel border border-border-dark rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan/50"
          >
            <option value="">全部严重度</option>
            <option value="critical">危急</option>
            <option value="major">重大</option>
            <option value="minor">一般</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-bg-panel border border-border-dark rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan/50"
          >
            <option value="">全部状态</option>
            <option value="pending">待审核</option>
            <option value="confirmed">已确认</option>
            <option value="rejected">已驳回</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Object.entries(statusConfig).map(([key, config]) => {
          const Icon = config.icon
          const count = defects.filter((d) => d.status === key).length
          return (
            <div
              key={key}
              className="bg-bg-panel border border-border-dark rounded-lg p-4 flex items-center gap-3"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center`}>
              <Icon className={`w-5 h-5 text-${config.color}`} />
            </div>
              <div>
                <p className="text-2xl font-display font-bold">{count}</p>
                <p className="text-xs text-text-muted">{config.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Defect grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {defects.map((defect) => {
          const status = statusConfig[defect.status]
          const StatusIcon = status.icon
          return (
            <div
              key={defect.id}
              onClick={() => navigate(`/defects/${defect.id}`)}
              className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden cursor-pointer hover:border-cyan/30 hover:shadow-glow-cyan transition-all group"
            >
              {/* Image */}
              <div className="relative aspect-video bg-bg-card">
                {defect.media_thumbnail ? (
                  <img
                    src={defect.media_thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-muted">
                    <FileSearch className="w-10 h-10 opacity-50" />
                  </div>
                )}
                {/* Bbox overlay */}
                {defect.bbox && defect.media_thumbnail && (
                  <div
                    className="absolute border-2 border-cyan bg-cyan/10"
                    style={{
                      left: `${(defect.bbox.x / 600) * 100}%`,
                      top: `${(defect.bbox.y / 400) * 100}%`,
                      width: `${(defect.bbox.width / 600) * 100}%`,
                      height: `${(defect.bbox.height / 400) * 100}%`,
                    }}
                  ></div>
                )}
                {/* Status badge */}
                <div className="absolute top-2 left-2">
                  <Badge variant={status.color as any} size="sm">
                    <span className="flex items-center gap-1">
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </span>
                  </Badge>
                </div>
                {/* Severity badge */}
                <div className="absolute top-2 right-2">
                  <Badge variant={severityColors[defect.severity] as any} size="sm">
                    {defect.severity_display}
                  </Badge>
                </div>
                {/* Confidence */}
                <div className="absolute bottom-2 right-2">
                  <div className="bg-black/60 px-2 py-1 rounded text-xs text-cyan font-mono">
                    {Math.round(defect.confidence * 100)}%
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">
                    {defect.defect_type_display} - {defect.subtype}
                  </p>
                </div>
                <div className="text-xs text-text-muted space-y-1">
                  <p>杆塔：{defect.tower_code}</p>
                  <p>线路：{defect.tower_line}</p>
                  <p>时间：{dayjs(defect.created_at).format('MM-DD HH:mm')}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {defects.length === 0 && !loading && (
        <div className="bg-bg-panel border border-border-dark rounded-xl p-12 text-center text-text-muted">
          <FileSearch className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>暂无缺陷数据</p>
        </div>
      )}
    </div>
  )
}
