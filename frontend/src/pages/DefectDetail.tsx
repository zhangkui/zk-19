import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { defectsApi, alertsApi, workOrdersApi } from '../services/api'
import type { Defect, Alert, WorkOrder } from '../types'
import Badge from '../components/Badge'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  FileSearch,
  AlertTriangle,
  Wrench,
  MapPin,
  Clock,
} from 'lucide-react'
import dayjs from 'dayjs'
import { useAuthStore } from '../store/authStore'
import { isAdmin, isReviewer } from '../utils'

export default function DefectDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [defect, setDefect] = useState<Defect | null>(null)
  const [relatedAlerts, setRelatedAlerts] = useState<Alert[]>([])
  const [relatedWorkOrders, setRelatedWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewNote, setReviewNote] = useState('')

  const canReview = defect?.status === 'pending' && (isAdmin(user) || isReviewer(user))

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  const loadData = async () => {
    try {
      const res = await defectsApi.get(Number(id))
      setDefect(res.data)

      const [alertsRes, woRes] = await Promise.all([
        alertsApi.list({ defect: id, page_size: 10 }),
        workOrdersApi.list({ defect: id, page_size: 10 }),
      ])
      setRelatedAlerts(alertsRes.data.results || alertsRes.data)
      setRelatedWorkOrders(woRes.data.results || woRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (action: 'confirm' | 'reject') => {
    if (!defect) return
    try {
      await defectsApi.review(defect.id, action, reviewNote)
      loadData()
    } catch (e) {
      console.error(e)
    }
  }

  if (loading || !defect) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-cyan border-t-transparent rounded-full"></div>
      </div>
    )
  }

  const severityColor = {
    critical: 'danger',
    major: 'warning',
    minor: 'amber',
  }[defect.severity]

  const statusColor = {
    pending: 'amber',
    confirmed: 'success',
    rejected: 'default',
  }[defect.status]

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
              <h2 className="text-xl font-bold">缺陷详情</h2>
              <Badge variant={statusColor as any}>{defect.status_display}</Badge>
              <Badge variant={severityColor as any}>{defect.severity_display}</Badge>
            </div>
            <p className="text-text-muted text-sm mt-1">
              {defect.defect_type_display} - {defect.subtype}
            </p>
          </div>
        </div>
        {canReview && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleReview('reject')}
              className="flex items-center gap-2 px-4 py-2 border border-danger/50 text-danger rounded-lg hover:bg-danger/10 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              驳回
            </button>
            <button
              onClick={() => handleReview('confirm')}
              className="flex items-center gap-2 px-4 py-2 bg-success text-bg-dark font-medium rounded-lg hover:bg-success/90 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              确认缺陷
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Image */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border-dark">
              <h3 className="font-semibold">缺陷影像</h3>
            </div>
            <div className="relative bg-bg-card">
              {defect.media_detail?.file_url ? (
                <img
                  src={defect.media_detail.file_url}
                  alt=""
                  className="w-full max-h-[500px] object-contain mx-auto"
                />
              ) : (
                <div className="h-96 flex items-center justify-center text-text-muted">
                  <FileSearch className="w-16 h-16 opacity-30" />
                </div>
              )}
              {/* Bbox */}
              {defect.bbox && defect.media_detail?.file_url && (
                <div
                  className="absolute border-2 border-cyan bg-cyan/10 animate-pulse"
                  style={{
                    left: `${(defect.bbox.x / 600) * 100}%`,
                    top: `${(defect.bbox.y / 400) * 100}%`,
                    width: `${(defect.bbox.width / 600) * 100}%`,
                    height: `${(defect.bbox.height / 400) * 100}%`,
                  }}
                >
                  <span className="absolute -top-6 left-0 bg-cyan text-bg-dark text-xs px-2 py-0.5 rounded">
                    {defect.defect_type_display}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {canReview && (
            <div className="bg-bg-panel border border-border-dark rounded-xl p-5">
              <h3 className="font-semibold mb-3">审核意见</h3>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="请输入审核意见..."
                className="w-full px-4 py-3 bg-bg-card border border-border-dark rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-cyan/50 resize-none h-24"
              />
            </div>
          )}

          {defect.status !== 'pending' && (
            <div className="bg-bg-panel border border-border-dark rounded-xl p-5">
              <h3 className="font-semibold mb-3">审核信息</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">审核人</span>
                  <span>{defect.reviewed_by_name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">审核时间</span>
                  <span>
                    {defect.reviewed_at
                      ? dayjs(defect.reviewed_at).format('YYYY-MM-DD HH:mm')
                      : '-'}
                  </span>
                </div>
                <div>
                  <p className="text-text-muted mb-1">审核意见</p>
                  <p className="bg-bg-card p-3 rounded-lg">{defect.review_note || '无'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Basic info */}
          <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border-dark">
              <h3 className="font-semibold">缺陷信息</h3>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">缺陷类型</span>
                <span>{defect.defect_type_display}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">缺陷子类</span>
                <span>{defect.subtype}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">严重程度</span>
                <Badge variant={severityColor as any} size="sm">
                  {defect.severity_display}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">AI置信度</span>
                <span className="font-mono text-cyan">
                  {Math.round(defect.confidence * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">创建时间</span>
                <span>{dayjs(defect.created_at).format('MM-DD HH:mm')}</span>
              </div>
            </div>
          </div>

          {/* Tower info */}
          <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border-dark">
              <h3 className="font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber" />
                关联杆塔
              </h3>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">杆塔编号</span>
                <span className="font-medium">{defect.tower_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">所属线路</span>
                <span>{defect.tower_line}</span>
              </div>
            </div>
          </div>

          {/* Related alerts */}
          <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border-dark">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-danger" />
                关联告警 ({relatedAlerts.length})
              </h3>
            </div>
            <div className="divide-y divide-border-dark max-h-48 overflow-y-auto">
              {relatedAlerts.map((alert) => (
                <div key={alert.id} className="p-3 hover:bg-white/5 cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm truncate">{alert.title}</span>
                    <Badge
                      variant={
                        alert.level === 'critical'
                          ? 'danger'
                          : alert.level === 'major'
                          ? 'warning'
                          : 'amber'
                      }
                      size="sm"
                    >
                      {alert.level_display}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-muted">
                    {dayjs(alert.created_at).format('MM-DD HH:mm')}
                  </p>
                </div>
              ))}
              {relatedAlerts.length === 0 && (
                <div className="p-4 text-center text-text-muted text-xs">
                  暂无关联告警
                </div>
              )}
            </div>
          </div>

          {/* Related work orders */}
          <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border-dark">
              <h3 className="font-semibold flex items-center gap-2">
                <Wrench className="w-4 h-4 text-success" />
                关联工单 ({relatedWorkOrders.length})
              </h3>
            </div>
            <div className="divide-y divide-border-dark max-h-48 overflow-y-auto">
              {relatedWorkOrders.map((wo) => (
                <div
                  key={wo.id}
                  onClick={() => navigate(`/workorders/${wo.id}`)}
                  className="p-3 hover:bg-white/5 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-mono text-cyan">{wo.code}</span>
                    <Badge variant="default" size="sm">
                      {wo.status_display}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-muted truncate">{wo.title}</p>
                </div>
              ))}
              {relatedWorkOrders.length === 0 && (
                <div className="p-4 text-center text-text-muted text-xs">
                  暂无关联工单
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
