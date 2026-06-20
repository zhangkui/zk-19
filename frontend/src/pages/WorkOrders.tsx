import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { workOrdersApi, towersApi } from '../services/api'
import type { WorkOrder, Tower } from '../types'
import Badge from '../components/Badge'
import Modal, { FormField, inputClass, selectClass, textareaClass } from '../components/Modal'
import {
  Wrench,
  Plus,
  Search,
  Filter,
  ChevronRight,
  Clock,
  User,
} from 'lucide-react'
import dayjs from 'dayjs'
import { useAuthStore } from '../store/authStore'
import { isAdmin, isCrew } from '../utils'

const severityColors: Record<string, string> = {
  critical: 'danger',
  major: 'warning',
  minor: 'amber',
}

const priorityColors: Record<string, string> = {
  urgent: 'danger',
  high: 'warning',
  normal: 'cyan',
  low: 'default',
}

const statusColors: Record<string, string> = {
  created: 'cyan',
  assigned: 'amber',
  processing: 'cyan',
  review: 'warning',
  closed: 'success',
  cancelled: 'default',
}

const statusLabels: Record<string, string> = {
  created: '已创建',
  assigned: '已派发',
  processing: '处理中',
  review: '待复核',
  closed: '已闭环',
  cancelled: '已取消',
}

export default function WorkOrders() {
  const { user } = useAuthStore()
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [towers, setTowers] = useState<Tower[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    tower: '' as number | string,
    severity: 'minor',
    priority: 'normal',
    planned_start: '',
    planned_end: '',
  })
  const navigate = useNavigate()

  const canCreate = isAdmin(user)

  useEffect(() => {
    loadWorkOrders()
    loadTowers()
  }, [statusFilter, severityFilter])

  const loadTowers = async () => {
    try {
      const res = await towersApi.list({ page_size: 200 })
      setTowers(res.data.results || res.data)
    } catch (e) {
      console.error(e)
    }
  }

  const loadWorkOrders = async () => {
    setLoading(true)
    try {
      const params: any = { page_size: 50, ordering: '-created_at' }
      if (statusFilter) params.status = statusFilter
      if (severityFilter) params.severity = severityFilter
      if (searchText) params.search = searchText
      const res = await workOrdersApi.list(params)
      setWorkOrders(res.data.results || res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setForm({
      title: '',
      description: '',
      tower: towers.length > 0 ? towers[0].id : '',
      severity: 'minor',
      priority: 'normal',
      planned_start: '',
      planned_end: '',
    })
    setModalOpen(true)
  }

  const handleCreate = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.tower) return
    setSubmitting(true)
    try {
      const data: any = {
        title: form.title,
        description: form.description,
        tower: Number(form.tower),
        severity: form.severity,
        priority: form.priority,
      }
      if (form.planned_start) data.planned_start = form.planned_start
      if (form.planned_end) data.planned_end = form.planned_end
      await workOrdersApi.create(data)
      setModalOpen(false)
      loadWorkOrders()
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  const statusStats = ['created', 'assigned', 'processing', 'review', 'closed']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">消缺工单</h2>
          <p className="text-text-muted text-sm mt-1">
            共 {workOrders.length} 条工单
            {isCrew(user) && '（仅显示分配给我的工单）'}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors">
            <Plus className="w-4 h-4" />
            新建工单
          </button>
        )}
      </div>

      {/* Status stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statusStats.map((status) => {
          const count = workOrders.filter((wo) => wo.status === status).length
          return (
            <div
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
              className={`bg-bg-panel border rounded-lg p-4 cursor-pointer transition-all ${
                statusFilter === status
                  ? 'border-cyan shadow-glow-cyan'
                  : 'border-border-dark hover:border-cyan/30'
              }`}
            >
              <p className="text-2xl font-display font-bold text-center">
                {count}
              </p>
              <p className="text-xs text-text-muted text-center mt-1">
                {statusLabels[status]}
              </p>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadWorkOrders()}
            placeholder="搜索工单编号、标题..."
            className="w-full pl-10 pr-4 py-2 bg-bg-panel border border-border-dark rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-cyan/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-text-muted" />
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
            <option value="created">已创建</option>
            <option value="assigned">已派发</option>
            <option value="processing">处理中</option>
            <option value="review">待复核</option>
            <option value="closed">已闭环</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
      </div>

      {/* Work order list */}
      <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-muted text-xs bg-bg-card/50">
                <th className="text-left px-5 py-3 font-medium">工单编号</th>
                <th className="text-left px-4 py-3 font-medium">标题</th>
                <th className="text-left px-4 py-3 font-medium">杆塔</th>
                <th className="text-left px-4 py-3 font-medium">严重度</th>
                <th className="text-left px-4 py-3 font-medium">优先级</th>
                <th className="text-left px-4 py-3 font-medium">状态</th>
                <th className="text-left px-4 py-3 font-medium">责任人</th>
                <th className="text-left px-4 py-3 font-medium">创建时间</th>
                <th className="text-right px-5 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dark">
              {workOrders.map((wo) => (
                <tr
                  key={wo.id}
                  className="hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => navigate(`/workorders/${wo.id}`)}
                >
                  <td className="px-5 py-4 font-mono text-cyan text-xs">
                    {wo.code}
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium max-w-xs truncate">{wo.title}</p>
                  </td>
                  <td className="px-4 py-4 text-text-secondary">
                    {wo.tower_code}
                    <span className="text-text-muted text-xs block">
                      {wo.tower_line}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={severityColors[wo.severity] as any} size="sm">
                      {wo.severity_display}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={priorityColors[wo.priority] as any} size="sm">
                      {wo.priority_display}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={statusColors[wo.status] as any} size="sm">
                      {wo.status_display}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    {wo.assignee_name ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-cyan/20 flex items-center justify-center">
                          <User className="w-3 h-3 text-cyan" />
                        </div>
                        <span className="text-text-secondary">{wo.assignee_name}</span>
                      </div>
                    ) : (
                      <span className="text-text-muted">未指派</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-text-muted">
                    {dayjs(wo.created_at).format('YYYY-MM-DD HH:mm')}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-cyan hover:text-cyan-dark text-sm">
                      详情
                      <ChevronRight className="w-4 h-4 inline ml-1" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {workOrders.length === 0 && !loading && (
          <div className="p-12 text-center text-text-muted">
            <Wrench className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无工单数据</p>
          </div>
        )}
      </div>

      {/* Create Work Order Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="新建工单"
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={submitting || !form.title.trim() || !form.description.trim() || !form.tower}
              className="px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors text-sm disabled:opacity-50"
            >
              {submitting ? '创建中...' : '创建'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="工单标题" required>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="请输入工单标题"
              className={inputClass}
            />
          </FormField>
          <FormField label="关联杆塔" required>
            <select
              value={form.tower}
              onChange={(e) => setForm({ ...form, tower: Number(e.target.value) })}
              className={selectClass}
            >
              <option value="">请选择杆塔</option>
              {towers.map((tower) => (
                <option key={tower.id} value={tower.id}>
                  {tower.code}
                </option>
              ))}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="严重程度">
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
                className={selectClass}
              >
                <option value="critical">危急</option>
                <option value="major">重大</option>
                <option value="minor">一般</option>
              </select>
            </FormField>
            <FormField label="优先级">
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className={selectClass}
              >
                <option value="urgent">紧急</option>
                <option value="high">高</option>
                <option value="normal">普通</option>
                <option value="low">低</option>
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="计划开始时间">
              <input
                type="datetime-local"
                value={form.planned_start}
                onChange={(e) => setForm({ ...form, planned_start: e.target.value })}
                className={inputClass}
              />
            </FormField>
            <FormField label="计划完成时间">
              <input
                type="datetime-local"
                value={form.planned_end}
                onChange={(e) => setForm({ ...form, planned_end: e.target.value })}
                className={inputClass}
              />
            </FormField>
          </div>
          <FormField label="工单描述" required>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="请输入工单描述"
              rows={3}
              className={textareaClass}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  )
}
