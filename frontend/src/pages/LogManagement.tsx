import { useState, useEffect, useMemo } from 'react'
import { systemLogsApi, dronesApi } from '../services/api'
import type { SystemLog, Drone } from '../types'
import Badge from '../components/Badge'
import {
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  Radio,
  Cpu,
  AlertTriangle,
  Info,
  XCircle,
  AlertCircle,
  MapPin,
} from 'lucide-react'
import dayjs from 'dayjs'

const logTypeOptions = [
  { value: '', label: '全部类型' },
  { value: 'push', label: '系统推送' },
  { value: 'report', label: '无人机上报' },
]

const logLevelOptions = [
  { value: '', label: '全部级别' },
  { value: 'info', label: '信息' },
  { value: 'warning', label: '警告' },
  { value: 'error', label: '错误' },
  { value: 'critical', label: '严重' },
]

const logCategoryOptions = [
  { value: '', label: '全部类别' },
  { value: 'heartbeat', label: '心跳上报' },
  { value: 'telemetry', label: '遥测上报' },
  { value: 'media', label: '媒体上报' },
  { value: 'event', label: '事件上报' },
  { value: 'task_summary', label: '任务汇总' },
  { value: 'task_bind', label: '任务绑定' },
  { value: 'task_unbind', label: '任务解绑' },
  { value: 'task_start', label: '任务开始' },
  { value: 'task_pause', label: '任务暂停' },
  { value: 'task_resume', label: '任务恢复' },
  { value: 'task_stop', label: '任务停止' },
  { value: 'return_home', label: '返航指令' },
  { value: 'command', label: '通用指令' },
  { value: 'other', label: '其他' },
]

const levelColors: Record<string, string> = {
  info: 'bg-cyan/20 text-cyan',
  warning: 'bg-amber/20 text-amber',
  error: 'bg-danger/20 text-danger',
  critical: 'bg-rose-500/20 text-rose-500',
}

const levelIcons: Record<string, any> = {
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
  critical: AlertCircle,
}

export default function LogManagement() {
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [drones, setDrones] = useState<Drone[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedDrone, setSelectedDrone] = useState<number | ''>('')
  const [selectedType, setSelectedType] = useState<string>('')
  const [selectedLevel, setSelectedLevel] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null)
  const [startTime, setStartTime] = useState<string>('')
  const [endTime, setEndTime] = useState<string>('')
  const [appliedStartTime, setAppliedStartTime] = useState<string>('')
  const [appliedEndTime, setAppliedEndTime] = useState<string>('')

  useEffect(() => {
    loadDrones()
  }, [])

  useEffect(() => {
    loadLogs()
  }, [page, selectedDrone, selectedType, selectedLevel, selectedCategory, appliedStartTime, appliedEndTime, searchKeyword])

  const loadDrones = async () => {
    try {
      const res = await dronesApi.list({ page_size: 100 })
      setDrones(res.data.results || res.data)
    } catch (e) {
      console.error(e)
    }
  }

  const loadLogs = async () => {
    setLoading(true)
    try {
      const params: any = {
        page,
        page_size: pageSize,
      }
      if (searchKeyword) params.search = searchKeyword
      if (selectedDrone) params.drone = selectedDrone
      if (selectedType) params.log_type = selectedType
      if (selectedLevel) params.log_level = selectedLevel
      if (selectedCategory) params.log_category = selectedCategory
      if (appliedStartTime) {
        params.report_time_after = new Date(appliedStartTime).toISOString()
      }
      if (appliedEndTime) {
        const endDate = new Date(appliedEndTime)
        endDate.setSeconds(59, 999)
        params.report_time_before = endDate.toISOString()
      }

      const res = await systemLogsApi.list(params)
      setLogs(res.data.results || res.data)
      setTotal(res.data.count || (res.data.results || res.data).length)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setAppliedStartTime(startTime)
    setAppliedEndTime(endTime)
    setPage(1)
  }

  const handleReset = () => {
    setSearchKeyword('')
    setSelectedDrone('')
    setSelectedType('')
    setSelectedLevel('')
    setSelectedCategory('')
    setStartTime('')
    setEndTime('')
    setAppliedStartTime('')
    setAppliedEndTime('')
    setPage(1)
  }

  const totalPages = Math.ceil(total / pageSize)

  const getLogTypeIcon = (log: SystemLog) => {
    if (log.log_type === 'push') {
      return <Radio className="w-4 h-4 text-cyan" />
    }
    return <Cpu className="w-4 h-4 text-amber" />
  }

  const LevelIcon = useMemo(() => {
    return (level: string) => {
      const Icon = levelIcons[level] || Info
      return <Icon className="w-4 h-4" />
    }
  }, [])

  const toggleExpand = (id: number) => {
    setExpandedLogId(expandedLogId === id ? null : id)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">日志管理</h2>
          <p className="text-text-muted text-sm mt-1">
            查看系统推送和无人机上报的日志记录，共 {total} 条记录
          </p>
        </div>
        <button
          onClick={loadLogs}
          className="flex items-center gap-2 px-4 py-2 bg-bg-panel border border-border-dark rounded-lg text-sm hover:bg-white/5 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {/* Filters */}
      <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-cyan" />
          <span className="text-sm font-medium">筛选条件</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="text-xs text-text-muted mb-1 block">关键词搜索</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索日志标题、内容、无人机名称、任务编号..."
                className="w-full pl-10 pr-4 py-2 bg-bg-card border border-border-dark rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-cyan/50"
              />
            </div>
          </div>

          {/* Drone */}
          <div>
            <label className="text-xs text-text-muted mb-1 block">无人机</label>
            <select
              value={selectedDrone}
              onChange={(e) => setSelectedDrone(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 bg-bg-card border border-border-dark rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan/50"
            >
              <option value="">全部无人机</option>
              {drones.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.serial_number})
                </option>
              ))}
            </select>
          </div>

          {/* Log Type */}
          <div>
            <label className="text-xs text-text-muted mb-1 block">日志类型</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 bg-bg-card border border-border-dark rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan/50"
            >
              {logTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Log Level */}
          <div>
            <label className="text-xs text-text-muted mb-1 block">日志级别</label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full px-3 py-2 bg-bg-card border border-border-dark rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan/50"
            >
              {logLevelOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Log Category */}
          <div>
            <label className="text-xs text-text-muted mb-1 block">日志类别</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-bg-card border border-border-dark rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan/50"
            >
              {logCategoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Start Time */}
          <div>
            <label className="text-xs text-text-muted mb-1 block">开始时间</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 bg-bg-card border border-border-dark rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan/50"
            />
          </div>

          {/* End Time */}
          <div>
            <label className="text-xs text-text-muted mb-1 block">结束时间</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 bg-bg-card border border-border-dark rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan/50"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border-dark">
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors text-sm"
          >
            搜索
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-bg-card border border-border-dark rounded-lg text-sm hover:bg-white/5 transition-colors"
          >
            重置
          </button>
        </div>
      </div>

      {/* Log List */}
      <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-2 border-cyan border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border-dark">
              {logs.map((log) => (
                <div key={log.id} className="group">
                  <div
                    onClick={() => toggleExpand(log.id)}
                    className="px-5 py-4 hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="mt-1">
                        {getLogTypeIcon(log)}
                      </div>

                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <Badge
                            className={levelColors[log.log_level]}
                            size="sm"
                          >
                            <span className="flex items-center gap-1">
                              {LevelIcon(log.log_level)}
                              {log.log_level_display}
                            </span>
                          </Badge>
                          <Badge variant="cyan" size="sm" outline>
                            {log.log_type_display}
                          </Badge>
                          <Badge variant="amber" size="sm" outline>
                            {log.log_category_display}
                          </Badge>
                          {log.drone_name && (
                            <Badge variant="success" size="sm" outline>
                              <Cpu className="w-3 h-3 mr-1" />
                              {log.drone_name}
                            </Badge>
                          )}
                          {log.task_code && (
                            <Badge variant="warning" size="sm" outline>
                              {log.task_code}
                            </Badge>
                          )}
                        </div>

                        <h4 className="font-medium text-text-primary mb-1 truncate">
                          {log.title}
                        </h4>

                        {log.content && (
                          <p className="text-sm text-text-muted line-clamp-1">
                            {log.content}
                          </p>
                        )}

                        {/* Meta Info */}
                        <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {dayjs(log.report_time).format('YYYY-MM-DD HH:mm:ss')}
                          </span>
                          {log.coordinates && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {log.coordinates.lat.toFixed(4)}, {log.coordinates.lon.toFixed(4)}
                            </span>
                          )}
                          {log.speed !== null && log.speed !== undefined && (
                            <span>速度: {log.speed.toFixed(1)} m/s</span>
                          )}
                          {log.altitude !== null && log.altitude !== undefined && (
                            <span>高度: {log.altitude.toFixed(1)} m</span>
                          )}
                          {log.battery !== null && log.battery !== undefined && (
                            <span>电量: {log.battery}%</span>
                          )}
                          {log.signal_strength !== null && log.signal_strength !== undefined && (
                            <span>信号: {log.signal_strength}%</span>
                          )}
                        </div>
                      </div>

                      {/* Expand Indicator */}
                      <div className="text-text-muted group-hover:text-text-primary transition-colors">
                        {expandedLogId === log.id ? (
                          <ChevronLeft className="w-5 h-5 rotate-90" />
                        ) : (
                          <ChevronRight className="w-5 h-5 -rotate-90" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedLogId === log.id && (
                    <div className="px-5 pb-4">
                      <div className="ml-9 bg-bg-card rounded-lg p-4 space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-text-muted text-xs mb-1">日志ID</p>
                            <p className="font-mono">{log.id}</p>
                          </div>
                          <div>
                            <p className="text-text-muted text-xs mb-1">无人机</p>
                            <p>{log.drone_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-text-muted text-xs mb-1">序列号</p>
                            <p className="font-mono">{log.drone_serial || '-'}</p>
                          </div>
                          <div>
                            <p className="text-text-muted text-xs mb-1">任务</p>
                            <p>{log.task_name || '-'}</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-text-muted text-xs mb-1">日志内容</p>
                          <p className="text-sm bg-bg-dark/50 rounded p-3 font-mono text-xs">
                            {log.content || '(无内容)'}
                          </p>
                        </div>

                        {log.raw_data && Object.keys(log.raw_data).length > 0 && (
                          <div>
                            <p className="text-text-muted text-xs mb-1">原始数据</p>
                            <pre className="text-sm bg-bg-dark/50 rounded p-3 font-mono text-xs overflow-x-auto max-h-48 overflow-y-auto">
                              {JSON.stringify(log.raw_data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {logs.length === 0 && (
              <div className="py-16 text-center text-text-muted">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>暂无日志记录</p>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-4 border-t border-border-dark flex items-center justify-between">
                <div className="text-sm text-text-muted">
                  共 {total} 条记录，第 {page} / {totalPages} 页
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum = i + 1
                      if (totalPages > 5) {
                        if (page > 3) {
                          pageNum = page - 2 + i
                        }
                        if (page > totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        }
                      }
                      if (pageNum < 1 || pageNum > totalPages) return null
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`w-8 h-8 rounded-lg text-sm transition-colors ${
                            page === pageNum
                              ? 'bg-cyan text-bg-dark font-medium'
                              : 'hover:bg-white/5'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
