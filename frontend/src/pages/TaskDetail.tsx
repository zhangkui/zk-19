import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { tasksApi, mediaApi, defectsApi } from '../services/api'
import type { InspectionTask, InspectionMedia, Defect } from '../types'
import MapComponent from '../components/MapComponent'
import Badge from '../components/Badge'
import {
  ArrowLeft,
  Play,
  Pause,
  Upload,
  Camera,
  AlertTriangle,
  Clock,
  MapPin,
  FileImage,
} from 'lucide-react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip } from 'react-leaflet'
import dayjs from 'dayjs'

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [task, setTask] = useState<InspectionTask | null>(null)
  const [mediaList, setMediaList] = useState<InspectionMedia[]>([])
  const [defects, setDefects] = useState<Defect[]>([])
  const [activeTab, setActiveTab] = useState<'media' | 'defects' | 'info'>('media')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  const loadData = async () => {
    try {
      const [taskRes, mediaRes, defectsRes] = await Promise.all([
        tasksApi.get(Number(id)),
        mediaApi.list({ task: id, page_size: 50 }),
        defectsApi.list({ task: id, page_size: 50 }),
      ])
      setTask(taskRes.data)
      setMediaList(mediaRes.data.results || mediaRes.data)
      setDefects(defectsRes.data.results || defectsRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !task) return

    setUploading(true)
    const formData = new FormData()
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i])
    }

    try {
      await tasksApi.upload(task.id, formData)
      loadData()
    } catch (err) {
      console.error('Upload failed', err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-cyan border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (!task) {
    return <div>任务不存在</div>
  }

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
              <h2 className="text-xl font-bold">{task.name}</h2>
              <Badge variant="cyan" size="sm">
                {task.code}
              </Badge>
            </div>
            <p className="text-text-muted text-sm mt-1">
              {task.route_name} · {task.drone_name} · {task.pilot_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {task.status === 'pending' && (
            <button className="flex items-center gap-2 px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors">
              <Play className="w-4 h-4" />
              开始任务
            </button>
          )}
          {task.status === 'running' && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {uploading ? '上传中...' : '上传影像'}
              </button>
              <button className="flex items-center gap-2 px-4 py-2 border border-success/50 text-success rounded-lg hover:bg-success/10 transition-colors">
                <Pause className="w-4 h-4" />
                完成任务
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <p className="text-text-muted text-sm mb-1">任务状态</p>
          <p className="font-display text-2xl font-bold text-cyan">
            {task.status_display}
          </p>
        </div>
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <p className="text-text-muted text-sm mb-1">影像数量</p>
          <p className="font-display text-2xl font-bold text-amber">
            {task.media_count}
          </p>
        </div>
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <p className="text-text-muted text-sm mb-1">发现缺陷</p>
          <p className="font-display text-2xl font-bold text-danger">
            {task.defect_count}
          </p>
        </div>
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <p className="text-text-muted text-sm mb-1">计划日期</p>
          <p className="font-display text-xl font-bold text-success">
            {task.planned_date || '-'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border-dark">
            <h3 className="font-semibold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan" />
              巡检轨迹
            </h3>
          </div>
          <div className="h-80">
            <MapComponent center={[39.91, 116.47} zoom={12}>
              {mediaList.map((media) =>
                media.coordinates && (
                  <CircleMarker
                    key={media.id}
                    center={[media.coordinates.lat, media.coordinates.lon]}
                    radius={media.has_defect ? 7 : 5}
                    fillColor={media.has_defect ? '#FF4D4F' : '#22D3EE'}
                    color={media.has_defect ? '#FF4D4F' : '#22D3EE'}
                    weight={2}
                    opacity={1}
                    fillOpacity={0.8}
                  >
                    <Tooltip direction="top" offset={[0, -5]}>
                      <span className="text-xs">
                        {media.tower_code || '影像'}{' '}
                        {media.has_defect && `· ${media.defect_count}缺陷`}
                      </span>
                    </Tooltip>
                  </CircleMarker>
                )
              )}
            </MapComponent>
          </div>
        </div>

        {/* Tabs panel */}
        <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden flex flex-col">
          <div className="flex border-b border-border-dark">
            <button
              onClick={() => setActiveTab('media')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'media'
                  ? 'text-cyan border-b-2 border-cyan bg-cyan/5'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <FileImage className="w-4 h-4 inline mr-2" />
              影像 ({mediaList.length})
            </button>
            <button
              onClick={() => setActiveTab('defects')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'defects'
                  ? 'text-cyan border-b-2 border-cyan bg-cyan/5'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              缺陷 ({defects.length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {activeTab === 'media' && (
              <div className="grid grid-cols-2 gap-2">
                {mediaList.map((media) => (
                  <div
                    key={media.id}
                    className="relative aspect-square bg-bg-card rounded-lg overflow-hidden cursor-pointer group"
                  >
                    <img
                      src={media.thumbnail_url || media.file_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    {media.has_defect && (
                      <div className="absolute top-1 right-1">
                      <Badge variant="danger" size="sm">
                        {media.defect_count}
                      </Badge>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-xs text-white truncate">
                        {media.tower_code || '影像'}{' '}
                      </p>
                    </div>
                  </div>
                ))}
                {mediaList.length === 0 && (
                  <div className="col-span-2 p-8 text-center text-text-muted text-sm">
                  暂无影像数据
                </div>
                )}
              </div>
            )}

            {activeTab === 'defects' && (
              <div className="space-y-2">
                {defects.map((defect) => (
                  <div
                    key={defect.id}
                    className="p-3 bg-bg-card rounded-lg cursor-pointer hover:bg-bg-card/80 transition-colors"
                    onClick={() => navigate(`/defects/${defect.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {defect.defect_type_display} - {defect.subtype}
                      </span>
                      <Badge
                        variant={
                          defect.severity === 'critical'
                            ? 'danger'
                            : defect.severity === 'major'
                            ? 'warning'
                            : 'amber'
                        }
                        size="sm"
                      >
                        {defect.severity_display}
                      </Badge>
                    </div>
                    <div className="text-xs text-text-muted">
                      {defect.tower_code} · 置信度 {defect.confidence}
                    </div>
                  </div>
                ))}
                {defects.length === 0 && (
                  <div className="p-8 text-center text-text-muted text-sm">
                    暂无缺陷数据
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task info */}
      <div className="bg-bg-panel border border-border-dark rounded-xl p-5">
        <h3 className="font-semibold mb-4">任务信息</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-text-muted mb-1">开始时间</p>
            <p>{task.started_at ? dayjs(task.started_at).format('YYYY-MM-DD HH:mm') : '-'}</p>
          </div>
          <div>
            <p className="text-text-muted mb-1">结束时间</p>
            <p>{task.ended_at ? dayjs(task.ended_at).format('YYYY-MM-DD HH:mm') : '-'}</p>
          </div>
          <div>
            <p className="text-text-muted mb-1">创建时间</p>
            <p>{dayjs(task.created_at).format('YYYY-MM-DD HH:mm')}</p>
          </div>
          <div>
            <p className="text-text-muted mb-1">备注</p>
            <p>{task.notes || '-'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
