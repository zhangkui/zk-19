import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { User } from '../types'

export type Role = 'superadmin' | 'admin' | 'pilot' | 'reviewer' | 'crew'

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: '超级管理员',
  admin: '调度管理员',
  pilot: '无人机飞手',
  reviewer: '缺陷审核员',
  crew: '检修班组',
}

export const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'admin', label: '调度管理员' },
  { value: 'pilot', label: '无人机飞手' },
  { value: 'reviewer', label: '缺陷审核员' },
  { value: 'crew', label: '检修班组' },
]

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function hasRole(user: User | null, ...roles: Role[]): boolean {
  if (!user) return false
  if (user.role === 'superadmin') return true
  return roles.includes(user.role as Role)
}

export function isSuperAdmin(user: User | null): boolean {
  return user?.role === 'superadmin'
}

export function isAdmin(user: User | null): boolean {
  return hasRole(user, 'admin')
}

export function isPilot(user: User | null): boolean {
  return hasRole(user, 'pilot')
}

export function isReviewer(user: User | null): boolean {
  return hasRole(user, 'reviewer')
}

export function isCrew(user: User | null): boolean {
  return hasRole(user, 'crew')
}

export const MENU_ROLE_ACCESS: Record<string, Role[]> = {
  '/': ['superadmin', 'admin', 'pilot', 'reviewer', 'crew'],
  '/lines': ['superadmin', 'admin', 'pilot', 'reviewer', 'crew'],
  '/routes': ['superadmin', 'admin'],
  '/drones': ['superadmin', 'admin'],
  '/tasks': ['superadmin', 'admin', 'pilot'],
  '/defects': ['superadmin', 'admin', 'reviewer', 'pilot', 'crew'],
  '/alerts': ['superadmin', 'admin', 'reviewer'],
  '/replay': ['superadmin', 'admin', 'pilot', 'reviewer'],
  '/workorders': ['superadmin', 'admin', 'crew'],
  '/analytics': ['superadmin', 'admin'],
  '/accounts': ['superadmin'],
}

export function canAccessPath(user: User | null, path: string): boolean {
  if (!user) return false
  if (user.role === 'superadmin') return true
  const allowedRoles = MENU_ROLE_ACCESS[path]
  if (!allowedRoles) return false
  return allowedRoles.includes(user.role as Role)
}

export const severityColors: Record<string, string> = {
  critical: 'text-danger',
  major: 'text-warning',
  minor: 'text-amber',
}

export const severityBgColors: Record<string, string> = {
  critical: 'bg-danger/20 text-danger border-danger/30',
  major: 'bg-warning/20 text-warning border-warning/30',
  minor: 'bg-amber/20 text-amber border-amber/30',
}

export const statusColors: Record<string, string> = {
  pending: 'text-amber',
  confirmed: 'text-success',
  rejected: 'text-muted',
  open: 'text-danger',
  processing: 'text-cyan',
  handled: 'text-success',
  closed: 'text-muted',
  created: 'text-cyan',
  assigned: 'text-amber',
  doing: 'text-cyan',
  review: 'text-purple-400',
  completed: 'text-success',
  cancelled: 'text-muted',
  idle: 'text-success',
  busy: 'text-cyan',
  maintenance: 'text-warning',
  offline: 'text-muted',
}

export const defectTypeLabels: Record<string, string> = {
  insulator: '绝缘子',
  tower: '塔体',
  hardware: '金具',
  conductor: '导线',
  other: '其他',
}

export const defectSubtypeLabels: Record<string, Record<string, string>> = {
  insulator: {
    breakage: '破损',
    tilt: '串歪斜',
    pollution: '污秽',
    missing: '缺失',
  },
  tower: {
    rust: '锈蚀',
    bolt_missing: '螺栓缺失',
    deformation: '变形',
    crack: '裂纹',
  },
  hardware: {
    loose: '松动',
    rust: '锈蚀',
    damage: '损坏',
  },
  conductor: {
    broken_strand: '断股',
    discharge: '放电痕迹',
    foreign_matter: '异物悬挂',
  },
  other: { other: '其他' },
}
