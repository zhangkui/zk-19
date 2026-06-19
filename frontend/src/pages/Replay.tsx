import { useState, useEffect } from 'react'
import { mediaApi, tasksApi, towersApi, linesApi } from '../services/api'
import type { InspectionMedia, InspectionTask, Tower, Line } from '../types'
import MapComponent from '../components/MapComponent'
import Badge from '../components/Badge'
import {
  Image,
  Play,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Camera,
  ZoomIn,
} from 'lucide-react'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import dayjs from 'dayjs'

export default function Replay() {
  const [mediaList, setMediaList] = useState<InspectionMedia[]>([])
  const [tasks, setTasks] = useState<InspectionTask[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [towers, setTowers] = useState<Tower[]>([])
  const [selectedTask, setSelectedTask] = useState<number | ''>('')
  const [selectedLine, setSelectedLine] = useState<number | ''>('')
  const [selectedTower, setSelectedTower] = useState<number | ''>('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    loadMedia()
  }, [selectedTask, selectedLine, selectedTower])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (playing && mediaList.length > 0) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % mediaList.length)
      }, 2000)
    }
    return () => clearInterval(interval)
  }, [playing, mediaList.length])

  const loadInitialData = async () => {
    try {
      const [tasksRes, linesRes] = await Promise.all([
        tasksApi.list({ page_size: 20 }),
        linesApi.list({ page_size: 20 }),
      ])
      setTasks(tasksRes.data.results || tasksRes.data)
      setLines(linesRes.data.results || linesRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadMedia = async () => {
    try {
      const params: any = { page_size: 100 }
      if (selectedTask) params.task = selectedTask
      if (selectedTower) params.tower = selectedTower
      const res = await mediaApi.list(params)
      setMediaList(res.data.results || res.data)
      setCurrentIndex(0)
    } catch (e) {
      console.error(e)
    }
  }

  const handleLineChange = async (lineId: number | '') => {
    setSelectedLine(lineId)
    setSelectedTower('')
    if (lineId) {
      try {
        const res = await towersApi.list({ line: lineId, page_size: 100 })
        setTowers(res.data.results || res.data)
      } catch (e) {
        console.error(e)
      }
    } else {
      setTowers([])
    }
  }

  const currentMedia = mediaList[currentIndex]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">巡检影像回放</h2>
          <p className="text-text-muted text-sm mt-1">
            共 {mediaList.length} 张影像
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="text-xs text-text-muted mb-1 block">任务</label>
          <select
            value={selectedTask}
            onChange={(e) => setSelectedTask(e.target.value ? Number(e.target.value) : '')}
            className="px-3 py-2 bg-bg-panel border border-border-dark rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan/50 min-w-48"
          >
            <option value="">全部任务</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} - {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">线路</label>
          <select
            value={selectedLine}
            onChange={(e) => handleLineChange(e.target.value ? Number(e.target.value) : '')}
            className="px-3 py-2 bg-bg-panel border border-border-dark rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan/50 min-w-40"
          >
            <option value="">全部线路</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">杆塔</label>
          <select
            value={selectedTower}
            onChange={(e) => setSelectedTower(e.target.value ? Number(e.target.value) : '')}
            className="px-3 py-2 bg-bg-panel border border-border-dark rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan/50 min-w-40"
            disabled={!selectedLine}
          >
            <option value="">全部杆塔</option>
            {towers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main viewer */}
        <div className="lg:col-span-2 bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border-dark flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Camera className="w-5 h-5 text-cyan" />
              影像回放
            </h3>
            <span className="text-sm text-text-muted">
              {currentIndex + 1} / {mediaList.length}
            </span>
          </div>
          <div className="relative bg-bg-card aspect-video">
            {currentMedia ? (
              <img
                src={currentMedia.file_url || currentMedia.thumbnail_url}
                alt=""
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-muted">
                <Image className="w-16 h-16 opacity-30" />
              </div>
            )}
            {/* Defect indicator */}
            {currentMedia?.has_defect && (
              <div className="absolute top-4 right-4">
                <Badge variant="danger">
                  {currentMedia.defect_count} 处缺陷
                </Badge>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="px-5 py-4 border-t border-border-dark flex items-center justify-between">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setPlaying(!playing)}
                className="flex items-center gap-2 px-6 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors"
                disabled={mediaList.length === 0}
              >
                <Play className="w-4 h-4" />
                {playing ? '暂停' : '播放'}
              </button>
            </div>

            <button
              onClick={() => setCurrentIndex((prev) => Math.min(mediaList.length - 1, prev + 1))}
              disabled={currentIndex >= mediaList.length - 1}
              className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Thumbnail strip */}
          <div className="px-5 pb-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {mediaList.map((media, idx) => (
                <div
                  key={media.id}
                  onClick={() => {
                    setCurrentIndex(idx)
                    setPlaying(false)
                  }}
                  className={`flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                    idx === currentIndex
                      ? 'border-cyan shadow-glow-cyan'
                      : 'border-transparent hover:border-border-dark'
                  }`}
                >
                  <img
                    src={media.thumbnail_url || media.file_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Map */}
          <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border-dark">
              <h3 className="font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber" />
                拍摄位置
              </h3>
            </div>
            <div className="h-60">
              <MapComponent
                center={
                  currentMedia?.coordinates
                    ? [currentMedia.coordinates.lat, currentMedia.coordinates.lon]
                    : [39.91, 116.47]
                }
                zoom={14}
              >
                {mediaList.map((media, idx) =>
                  media.coordinates && (
                    <CircleMarker
                      key={media.id}
                      center={[media.coordinates.lat, media.coordinates.lon]}
                      radius={idx === currentIndex ? 8 : 4}
                      fillColor={idx === currentIndex ? '#22D3EE' : media.has_defect ? '#FF4D4F' : '#F5B301'}
                      color={idx === currentIndex ? '#22D3EE' : media.has_defect ? '#FF4D4F' : '#F5B301'}
                      weight={2}
                      opacity={1}
                      fillOpacity={0.8}
                      eventHandlers={{
                        click: () => {
                          setCurrentIndex(idx)
                          setPlaying(false)
                        },
                      }}
                    >
                      <Tooltip direction="top" offset={[0, -5]}>
                        <span className="text-xs">
                          #{idx + 1}{' '}
                          {media.has_defect && `· ${media.defect_count}缺陷`}
                        </span>
                      </Tooltip>
                    </CircleMarker>
                  )
                )}
              </MapComponent>
            </div>
          </div>

          {/* Media info */}
          {currentMedia && (
            <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border-dark">
                <h3 className="font-semibold">影像信息</h3>
              </div>
              <div className="p-5 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">编号</span>
                  <span className="font-mono">#{currentMedia.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">类型</span>
                  <span>{currentMedia.media_type_display}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">杆塔</span>
                  <span>{currentMedia.tower_code || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">拍摄时间</span>
                  <span>
                    {currentMedia.captured_at
                      ? dayjs(currentMedia.captured_at).format('MM-DD HH:mm')
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">飞行高度</span>
                  <span>{currentMedia.altitude || '-'} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">是否有缺陷</span>
                  <Badge variant={currentMedia.has_defect ? 'danger' : 'success'} size="sm">
                    {currentMedia.has_defect ? `${currentMedia.defect_count}处` : '无'}
                  </Badge>
                </div>
                {currentMedia.coordinates && (
                  <div>
                    <p className="text-text-muted mb-1">坐标</p>
                    <p className="font-mono text-xs bg-bg-card p-2 rounded">
                      {currentMedia.coordinates.lon.toFixed(6)},{' '}
                      {currentMedia.coordinates.lat.toFixed(6)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
