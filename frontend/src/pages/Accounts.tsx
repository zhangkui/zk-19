import { useState, useEffect } from 'react'
import { authApi } from '../services/api'
import type { User } from '../types'
import Badge from '../components/Badge'
import Modal, { FormField, inputClass, selectClass } from '../components/Modal'
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  UserPlus,
  Phone,
  Mail,
  Shield,
} from 'lucide-react'
import dayjs from 'dayjs'
import { ROLE_OPTIONS, ROLE_LABELS } from '../utils'
import type { Role } from '../utils'

const roleBadgeColor: Record<Role, string> = {
  superadmin: 'danger',
  admin: 'cyan',
  pilot: 'amber',
  reviewer: 'success',
  crew: 'warning',
}

const emptyForm = {
  username: '',
  name: '',
  password: '',
  role: 'pilot' as Role,
  phone: '',
  email: '',
  is_active: true,
}

export default function Accounts() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const res = await authApi.getUsers({ page_size: 100 })
      setUsers(res.data.results || res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const filtered = users.filter((u) => {
    const matchSearch =
      !searchText ||
      u.username.toLowerCase().includes(searchText.toLowerCase()) ||
      (u.name && u.name.toLowerCase().includes(searchText.toLowerCase())) ||
      (u.phone && u.phone.includes(searchText)) ||
      (u.email && u.email.toLowerCase().includes(searchText.toLowerCase()))
    const matchRole = !roleFilter || u.role === roleFilter
    return matchSearch && matchRole
  })

  const openCreate = () => {
    setEditingUser(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (u: User) => {
    setEditingUser(u)
    setForm({
      username: u.username,
      name: u.name || '',
      password: '',
      role: u.role as Role,
      phone: u.phone || '',
      email: u.email || '',
      is_active: u.is_active,
    })
    setModalOpen(true)
  }

  const handleDelete = async (u: User) => {
    if (!confirm(`确定要禁用账号【${u.name || u.username}】吗？`)) return
    try {
      await authApi.deleteUser(u.id)
      alert('账号已禁用')
      loadUsers()
    } catch (e: any) {
      alert(e.response?.data?.error || '操作失败')
    }
  }

  const handleSubmit = async () => {
    if (!form.username) {
      alert('请输入用户名')
      return
    }
    if (!editingUser && !form.password) {
      alert('请输入初始密码')
      return
    }
    try {
      setSubmitting(true)
      if (editingUser) {
        const payload: any = { ...form }
        if (!payload.password) delete payload.password
        await authApi.updateUser(editingUser.id, payload)
      } else {
        await authApi.createUser(form)
      }
      setModalOpen(false)
      loadUsers()
    } catch (e: any) {
      alert(e.response?.data?.detail || e.response?.data?.username?.[0] || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const stats = {
    total: users.length,
    superadmin: users.filter((u) => u.role === 'superadmin').length,
    admin: users.filter((u) => u.role === 'admin').length,
    pilot: users.filter((u) => u.role === 'pilot').length,
    reviewer: users.filter((u) => u.role === 'reviewer').length,
    crew: users.filter((u) => u.role === 'crew').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">账号管理</h2>
          <p className="text-text-muted text-sm mt-1">
            管理系统用户账号与角色分配（仅超级管理员可见）
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          新增账号
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-text-muted mt-1">全部账号</div>
        </div>
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <div className="text-2xl font-bold text-rose-400">{stats.superadmin}</div>
          <div className="text-xs text-text-muted mt-1">超级管理员</div>
        </div>
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <div className="text-2xl font-bold text-cyan">{stats.admin}</div>
          <div className="text-xs text-text-muted mt-1">调度管理员</div>
        </div>
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <div className="text-2xl font-bold text-amber">{stats.pilot}</div>
          <div className="text-xs text-text-muted mt-1">无人机飞手</div>
        </div>
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <div className="text-2xl font-bold text-success">{stats.reviewer}</div>
          <div className="text-xs text-text-muted mt-1">缺陷审核员</div>
        </div>
        <div className="bg-bg-panel border border-border-dark rounded-xl p-4">
          <div className="text-2xl font-bold text-warning">{stats.crew}</div>
          <div className="text-xs text-text-muted mt-1">检修班组</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-bg-panel border border-border-dark rounded-lg px-3 py-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="搜索用户名/姓名/电话/邮箱..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className={selectClass + ' w-auto'}
        >
          <option value="">全部角色</option>
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-bg-panel border border-border-dark rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-muted text-xs uppercase border-b border-border-dark bg-bg-card/50">
                <th className="text-left px-5 py-3 font-medium">账号</th>
                <th className="text-left px-5 py-3 font-medium">姓名</th>
                <th className="text-left px-5 py-3 font-medium">角色</th>
                <th className="text-left px-5 py-3 font-medium">电话</th>
                <th className="text-left px-5 py-3 font-medium">邮箱</th>
                <th className="text-left px-5 py-3 font-medium">状态</th>
                <th className="text-left px-5 py-3 font-medium">创建时间</th>
                <th className="text-right px-5 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dark">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-cyan/20 flex items-center justify-center">
                        <Users className="w-4 h-4 text-cyan" />
                      </div>
                      <span className="font-medium">{u.username}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-text-secondary">
                    {u.name || '-'}
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={roleBadgeColor[u.role as Role]} size="sm">
                      {ROLE_LABELS[u.role as Role]}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-text-secondary">
                    {u.phone ? (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {u.phone}
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-5 py-4 text-text-secondary">
                    {u.email ? (
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        <span className="truncate max-w-[160px]">{u.email}</span>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {u.is_active ? (
                      <Badge variant="success" size="sm">
                        启用
                      </Badge>
                    ) : (
                      <Badge variant="default" size="sm">
                        禁用
                      </Badge>
                    )}
                  </td>
                  <td className="px-5 py-4 text-text-secondary text-xs">
                    {dayjs(u.date_joined).format('YYYY-MM-DD HH:mm')}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-text-secondary hover:text-cyan transition-colors"
                        title="编辑"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {u.role !== 'superadmin' && (
                        <button
                          onClick={() => handleDelete(u)}
                          className="p-1.5 rounded-lg hover:bg-white/5 text-text-secondary hover:text-danger transition-colors"
                          title={u.is_active ? '禁用' : '已禁用'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-text-muted">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    暂无账号数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? '编辑账号' : '新增账号'}
        width="max-w-md"
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 border border-border-dark rounded-lg text-sm hover:bg-white/5 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 bg-cyan text-bg-dark font-medium rounded-lg hover:bg-cyan-dark transition-colors disabled:opacity-50 text-sm"
            >
              {submitting ? '提交中...' : '确定'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="用户名" required>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className={inputClass}
              placeholder="请输入用户名"
              disabled={!!editingUser}
            />
          </FormField>
          <FormField label="姓名">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
              placeholder="请输入真实姓名"
            />
          </FormField>
          <FormField label={editingUser ? '新密码（留空不修改）' : '初始密码'} required={!editingUser}>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={inputClass}
              placeholder={editingUser ? '留空则不修改密码' : '请输入初始密码'}
            />
          </FormField>
          <FormField label="角色" required>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              className={selectClass}
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="电话">
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputClass}
                placeholder="联系电话"
              />
            </FormField>
            <FormField label="邮箱">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass}
                placeholder="邮箱地址"
              />
            </FormField>
          </div>
          {editingUser && (
            <FormField label="账号状态">
              <select
                value={form.is_active ? 'true' : 'false'}
                onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}
                className={selectClass}
              >
                <option value="true">启用</option>
                <option value="false">禁用</option>
              </select>
            </FormField>
          )}
        </div>
      </Modal>
    </div>
  )
}
