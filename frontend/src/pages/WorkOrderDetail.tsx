import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { workOrdersApi, authApi } from '../services/api'
import type { WorkOrder, WorkOrderLog, User as UserType } from '../types'
import Badge from '../components/Badge'
import {
  ArrowLeft,
  User as UserIcon,
  Clock,
  MessageSquare,
  Send,
  CheckCircle,
  XCircle,
  Play,
  FileCheck,
} from 'lucide-react'
import dayjs from 'dayjs'

const severityColors: Record<string, string> = {
  critical: 'danger',
  major: 'warning',
  minor: 'amber',
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

const actionLabels: Record<string, string> = {
  create: '创建工单',
  assign: '派发工单',
  start: '开始处理',
  progress: '进度更新',
  submit_review: '提交复核',
  review_pass: '复核通过',
  review_fail: '复核驳回',
  close: '闭环工单',
  cancel: '取消工单',
  note: '备注',
}

export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [noteText, setNoteText] = useState('')
  const [selectedAssignee, setSelectedAssignee] = useState<number | ''>('')
  const [showAssignModal, setShowAssignModal] = useState(false)

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  const loadData = async () => {
    try {
      const [woRes, usersRes] = await Promise.all([
        workOrdersApi.get(Number(id)),
        authApi.getUsers({ role: 'crew' }),
      ])
      setWorkOrder(woRes.data)
      setUsers(usersRes.data.results || usersRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleTransition = async (action: string) => {
    if (!workOrder) return
    try {
      const params: any = { action, note: noteText }
      if (action === 'assign' && selectedAssignee) {
        params.assignee_id = selectedAssignee
      }
      await workOrdersApi.transition(workOrder.id, action, noteText, params.assignee_id)
      setNoteText('')
      setShowAssignModal(false)
      loadData()
    } catch (e) {
      console.error(e)
    }
  }

  const handleAddNote = async () => {
    if (!workOrder || !noteText.trim()) return
    try {
      await workOrdersApi.addLog(workOrder.id, noteText)
      setNoteText('')
      loadData()
    } catch (e) {
      console.error(e)
    }
  }

  if (loading || !workOrder) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-cyan border-t-transparent rounded-full"></div>
      </div>
    )
  }

  const canAssign = ['created'].includes(workOrder.status)
  const canStart = ['assigned'].includes(workOrder.status)
  const canSubmitReview = ['processing'].includes(workOrder.status)
  const canReview = ['review'].includes(workOrder.status)
  const canClose = ['review', 'processing'].includes(workOrder.status)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">{workOrder.title}</h2>
              <Badge variant={statusColors[workOrder.status] as any}>
                {workOrder.status_display}
              </Badge>
            </div>
            <p className="text-text-muted text-sm mt-1">
              工单编号：{workOrder.code}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canAssign && (
            <button
              onClick={() => setShowAssignModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors"
            >
              <UserIcon className="w-4 h-4" />
              派发工单
            </button>
          )}
          {canStart && (
            <button
              onClick={() => handleTransition('start')}
              className="flex items-center gap-2 px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors"
            >
              <Play className="w-4 h-4" />
              开始处理
            </button>
          )}
          {canSubmitReview && (
            <button
              onClick={() => handleTransition('submit_review')}
              className="flex items-center gap-2 px-4 py-2 bg-amber text-bg-dark font-medium rounded-lg hover:bg-amber/90 transition-colors"
            >
              <FileCheck className="w-4 h-4" />
              提交复核
            </button>
          )}
          {canReview && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleTransition('review_fail')}
                className="flex items-center gap-2 px-4 py-2 border border-danger/50 text-danger rounded-lg hover:bg-danger/10 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                驳回
              </button>
              <button
                onClick={() => handleTransition('review_pass')}
                className="flex items-center gap-2 px-4 py-2 bg-success text-bg-dark font-medium rounded-lg hover:bg-success/90 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                通过
              </button>
            </div>
          )}
          {canClose && (
            <button
              onClick={() => handleTransition('close')}
              className="flex items-center gap-2 px-4 py-2 border border-success/50 text-success rounded-lg hover:bg-success/10 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              闭环
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-bg-panel border border-border-dark rounded-xl p-5">
            <h3 className="font-semibold mb-3">工单描述</h3>
            <p className="text-text-secondary">{workOrder.description}</p>
          </div>

          {/* Timeline */}
          <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border-dark">
              <h3 className="font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan" />
                流转记录
              </h3>
            </div>
            <div className="p-5">
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border-dark"></div>

                <div className="space-y-6">
                  {workOrder.logs?.map((log: WorkOrderLog, idx: number) => (
                    <div key={log.id} className="relative pl-10">
                      {/* Dot */}
                      <div
                        className={`absolute left-2 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          log.action === 'review_pass' || log.action === 'close'
                            ? 'border-success bg-success/20'
                            : log.action === 'create'
                            ? 'border-cyan bg-cyan/20'
                            : 'border-amber bg-amber/20'
                        }`}
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            log.action === 'review_pass' || log.action === 'close'
                              ? 'bg-success'
                              : log.action === 'create'
                              ? 'bg-cyan'
                              : 'bg-amber'
                          }`}
                        ></div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">
                            {actionLabels[log.action] || log.action}
                          </span>
                          <Badge variant="default" size="sm">
                            {log.operator_name || '系统'}
                          </Badge>
                          <span className="text-xs text-text-muted">
                            {dayjs(log.created_at).format('YYYY-MM-DD HH:mm')}
                          </span>
                        </div>
                        {log.note && (
                          <p className="text-sm text-text-secondary bg-bg-card rounded-lg p-3">
                            {log.note}
                          </p>
                        )}
                        {log.from_status && log.to_status && (
                          <p className="text-xs text-text-muted mt-1">
                            {statusLabels[log.from_status]} → {statusLabels[log.to_status]}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Add note */}
            <div className="px-5 pb-5">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="添加备注..."
                  className="flex-1 px-4 py-2.5 bg-bg-card border border-border-dark rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-cyan/50"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                />
                <button
                  onClick={handleAddNote}
                  disabled={!noteText.trim()}
                  className="px-4 py-2.5 bg-cyan text-bg-dark rounded-lg hover:bg-cyan-dark transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right - info */}
        <div className="space-y-6">
          {/* Basic info */}
          <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border-dark">
              <h3 className="font-semibold">工单信息</h3>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">工单编号</span>
                <span className="font-mono text-cyan">{workOrder.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">严重程度</span>
                <Badge variant={severityColors[workOrder.severity] as any} size="sm">
                  {workOrder.severity_display}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">优先级</span>
                <Badge variant="cyan" size="sm">
                  {workOrder.priority_display}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">当前状态</span>
                <Badge variant={statusColors[workOrder.status] as any} size="sm">
                  {workOrder.status_display}
                </Badge>
              </div>
            </div>
          </div>

          {/* Tower info */}
          <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border-dark">
              <h3 className="font-semibold">位置信息</h3>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">杆塔编号</span>
                <span className="font-medium">{workOrder.tower_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">所属线路</span>
                <span>{workOrder.tower_line}</span>
              </div>
            </div>
          </div>

          {/* People info */}
          <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border-dark">
              <h3 className="font-semibold">相关人员</h3>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">创建人</span>
                <span>{workOrder.created_by_name || '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">责任人</span>
                <span>
                  {workOrder.assignee_name ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-cyan/20 flex items-center justify-center">
                        <User className="w-3 h-3 text-cyan" />
                      </div>
                      {workOrder.assignee_name}
                    </div>
                  ) : (
                    <span className="text-text-muted">未指派</span>
                  )}
                </span>
              </div>
              {workOrder.reviewer_name && (
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">复核人</span>
                  <span>{workOrder.reviewer_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Time info */}
          <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border-dark">
              <h3 className="font-semibold">时间信息</h3>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">创建时间</span>
                <span>{dayjs(workOrder.created_at).format('MM-DD HH:mm')}</span>
              </div>
              {workOrder.planned_start && (
                <div className="flex justify-between">
                  <span className="text-text-muted">计划开始</span>
                  <span>{dayjs(workOrder.planned_start).format('MM-DD HH:mm')}</span>
                </div>
              )}
              {workOrder.planned_end && (
                <div className="flex justify-between">
                  <span className="text-text-muted">计划完成</span>
                  <span>{dayjs(workOrder.planned_end).format('MM-DD HH:mm')}</span>
                </div>
              )}
              {workOrder.actual_start && (
                <div className="flex justify-between">
                  <span className="text-text-muted">实际开始</span>
                  <span className="text-success">{dayjs(workOrder.actual_start).format('MM-DD HH:mm')}</span>
                </div>
              )}
              {workOrder.closed_at && (
                <div className="flex justify-between">
                  <span className="text-text-muted">闭环时间</span>
                  <span className="text-success">{dayjs(workOrder.closed_at).format('MM-DD HH:mm')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Assign modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-panel border border-border-dark rounded-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-lg mb-4">派发工单</h3>
            <div className="mb-4">
              <label className="text-sm text-text-muted mb-2 block">选择责任人</label>
              <select
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-4 py-2.5 bg-bg-card border border-border-dark rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan/50"
              >
                <option value="">请选择</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.username})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleTransition('assign')}
                disabled={!selectedAssignee}
                className="px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors disabled:opacity-50"
              >
                确认派发
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
