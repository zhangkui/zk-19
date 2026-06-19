import { useState, useEffect } from 'react'
import { dronesApi } from '../services/api'
import type { Drone } from '../types'
import Badge from '../components/Badge'
import Modal, { FormField, inputClass, selectClass, textareaClass } from '../components/Modal'
import {
  Cpu,
  Plus,
  Edit,
  Trash2,
  Battery,
  Clock,
  Search,
  Filter,
} from 'lucide-react'
import dayjs from 'dayjs'

const STATUS_OPTIONS = [
  { value: 'idle', label: '空闲' },
  { value: 'busy', label: '作业中' },
  { value: 'maintenance', label: '维护中' },
  { value: 'offline', label: '离线' },
]

const statusColors: Record<string, string> = {
  idle: 'success',
  busy: 'cyan',
  maintenance: 'warning',
  offline: 'default',
}

export default function Drones() {
  const [drones, setDrones] = useState<Drone[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingDrone, setEditingDrone] = useState<Drone | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Drone | null>(null)

  const [form, setForm] = useState({
    name: '',
    model: '',
    serial_number: '',
    status: 'idle',
    battery: 100,
    max_flight_time: 30,
    payload: '',
  })

  useEffect(() => {
    loadDrones()
  }, [statusFilter, searchText])

  const loadDrones = async () => {
    setLoading(true)
    try {
      const params: any = { page_size: 100 }
      if (statusFilter) params.status = statusFilter
      if (searchText) params.search = searchText
      const res = await dronesApi.list(params)
      setDrones(res.data.results || res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditingDrone(null)
    setForm({
      name: '',
      model: '',
      serial_number: '',
      status: 'idle',
      battery: 100,
      max_flight_time: 30,
      payload: '',
    })
    setModalOpen(true)
  }

  const openEdit = (drone: Drone) => {
    setEditingDrone(drone)
    setForm({
      name: drone.name,
      model: drone.model,
      serial_number: drone.serial_number,
      status: drone.status,
      battery: drone.battery,
      max_flight_time: drone.max_flight_time,
      payload: drone.payload || '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.model.trim() || !form.serial_number.trim()) return
    setSubmitting(true)
    try {
      const data = {
        name: form.name,
        model: form.model,
        serial_number: form.serial_number,
        status: form.status,
        battery: Number(form.battery),
        max_flight_time: Number(form.max_flight_time),
        payload: form.payload,
      }
      if (editingDrone) {
        await dronesApi.update(editingDrone.id, data)
      } else {
        await dronesApi.create(data)
      }
      setModalOpen(false)
      loadDrones()
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSubmitting(true)
    try {
      await dronesApi.delete(deleteTarget.id)
      setDeleteTarget(null)
      loadDrones()
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  const batteryColor = (battery: number) => {
    if (battery > 60) return 'text-success'
    if (battery > 30) return 'text-warning'
    return 'text-danger'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">无人机数据维护</h2>
          <p className="text-text-muted text-sm mt-1">
            共 {drones.length} 台无人机
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          新增无人机
        </button>
      </div>

      {/* Status stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATUS_OPTIONS.map((opt) => {
          const count = drones.filter((d) => d.status === opt.value).length
          return (
            <div
              key={opt.value}
              onClick={() => setStatusFilter(statusFilter === opt.value ? '' : opt.value)}
              className={`bg-bg-panel border rounded-lg p-4 cursor-pointer transition-all ${
                statusFilter === opt.value
                  ? 'border-cyan shadow-glow-cyan'
                  : 'border-border-dark hover:border-cyan/30'
              }`}
            >
              <p className="text-2xl font-display font-bold text-center">{count}</p>
              <p className="text-xs text-text-muted text-center mt-1">{opt.label}</p>
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
            onKeyDown={(e) => e.key === 'Enter' && loadDrones()}
            placeholder="搜索名称、型号、序列号..."
            className="w-full pl-10 pr-4 py-2 bg-bg-panel border border-border-dark rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-cyan/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-text-muted" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-bg-panel border border-border-dark rounded-lg text-sm text-text-primary focus:outline-none focus:border-cyan/50"
          >
            <option value="">全部状态</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Drone list */}
      <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-muted text-xs bg-bg-card/50">
                <th className="text-left px-5 py-3 font-medium">名称</th>
                <th className="text-left px-4 py-3 font-medium">型号</th>
                <th className="text-left px-4 py-3 font-medium">序列号</th>
                <th className="text-left px-4 py-3 font-medium">状态</th>
                <th className="text-left px-4 py-3 font-medium">电量</th>
                <th className="text-left px-4 py-3 font-medium">最大续航</th>
                <th className="text-left px-4 py-3 font-medium">载荷</th>
                <th className="text-left px-4 py-3 font-medium">创建时间</th>
                <th className="text-right px-5 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dark">
              {drones.map((drone) => (
                <tr key={drone.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-4 font-medium flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-cyan/10 flex items-center justify-center">
                      <Cpu className="w-4 h-4 text-cyan" />
                    </div>
                    {drone.name}
                  </td>
                  <td className="px-4 py-4 text-text-secondary">{drone.model}</td>
                  <td className="px-4 py-4 font-mono text-xs text-cyan">
                    {drone.serial_number}
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={statusColors[drone.status] as any} size="sm">
                      {drone.status_display}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Battery className={`w-4 h-4 ${batteryColor(drone.battery)}`} />
                      <span className={batteryColor(drone.battery)}>{drone.battery}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-text-secondary">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {drone.max_flight_time}分钟
                    </span>
                  </td>
                  <td className="px-4 py-4 text-text-secondary">{drone.payload || '-'}</td>
                  <td className="px-4 py-4 text-text-muted">
                    {dayjs(drone.created_at).format('YYYY-MM-DD')}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(drone)}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted hover:text-cyan transition-colors"
                        title="编辑"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(drone)}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted hover:text-danger transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {drones.length === 0 && !loading && (
          <div className="p-12 text-center text-text-muted">
            <Cpu className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无无人机数据</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingDrone ? '编辑无人机' : '新增无人机'}
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={submitting || !form.name.trim() || !form.model.trim() || !form.serial_number.trim()}
              className="px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors text-sm disabled:opacity-50"
            >
              {submitting ? '保存中...' : '保存'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="无人机名称" required>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="请输入名称"
                className={inputClass}
              />
            </FormField>
            <FormField label="型号" required>
              <input
                type="text"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="如：DJI M300 RTK"
                className={inputClass}
              />
            </FormField>
          </div>
          <FormField label="序列号" required>
            <input
              type="text"
              value={form.serial_number}
              onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
              placeholder="请输入唯一序列号"
              className={inputClass}
            />
          </FormField>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="状态">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={selectClass}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="电量(%)">
              <input
                type="number"
                min="0"
                max="100"
                value={form.battery}
                onChange={(e) => setForm({ ...form, battery: Number(e.target.value) })}
                className={inputClass}
              />
            </FormField>
            <FormField label="最大续航(分钟)">
              <input
                type="number"
                min="0"
                value={form.max_flight_time}
                onChange={(e) => setForm({ ...form, max_flight_time: Number(e.target.value) })}
                className={inputClass}
              />
            </FormField>
          </div>
          <FormField label="载荷">
            <input
              type="text"
              value={form.payload}
              onChange={(e) => setForm({ ...form, payload: e.target.value })}
              placeholder="如：可见光相机+红外热成像"
              className={inputClass}
            />
          </FormField>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="确认删除"
        width="max-w-md"
        footer={
          <>
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              取消
            </button>
            <button
              onClick={handleDelete}
              disabled={submitting}
              className="px-4 py-2 bg-danger text-white font-medium rounded-lg hover:bg-danger/90 transition-colors text-sm disabled:opacity-50"
            >
              {submitting ? '删除中...' : '确认删除'}
            </button>
          </>
        }
      >
        <p className="text-text-secondary">
          确定要删除无人机 <span className="text-danger font-medium">{deleteTarget?.name}</span>（{deleteTarget?.serial_number}）吗？此操作不可撤销。
        </p>
      </Modal>
    </div>
  )
}
