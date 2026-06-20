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

export function validateLon(value: number): string | null {
  if (isNaN(value)) {
    return '经度格式不正确，必须为数字'
  }
  if (value < -180 || value > 180) {
    return '经度范围必须在-180到180之间'
  }
  return null
}

export function validateLat(value: number): string | null {
  if (isNaN(value)) {
    return '纬度格式不正确，必须为数字'
  }
  if (value < -90 || value > 90) {
    return '纬度范围必须在-90到90之间'
  }
  return null
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function calculateTotalDistance(waypoints: { lat: number; lon: number }[]): number {
  if (waypoints.length < 2) return 0
  let total = 0
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += calculateDistance(
      waypoints[i].lat,
      waypoints[i].lon,
      waypoints[i + 1].lat,
      waypoints[i + 1].lon
    )
  }
  return total
}

export function calculateDuration(distance: number, speed: number): number {
  if (distance <= 0 || speed <= 0) return 0
  return Math.ceil(distance / speed / 60)
}

export function validateAltitude(altitude: number): { valid: boolean; message: string } {
  const minAltitude = 30
  const maxAltitude = 120
  if (altitude < minAltitude) {
    return { valid: false, message: `飞行高度过低，建议不低于${minAltitude}米` }
  }
  if (altitude > maxAltitude) {
    return { valid: false, message: `飞行高度过高，建议不超过${maxAltitude}米` }
  }
  return { valid: true, message: '高度合理' }
}

export function validateSpeed(speed: number): { valid: boolean; message: string } {
  const minSpeed = 2
  const maxSpeed = 15
  if (speed < minSpeed) {
    return { valid: false, message: `飞行速度过慢，建议不低于${minSpeed}m/s` }
  }
  if (speed > maxSpeed) {
    return { valid: false, message: `飞行速度过快，建议不超过${maxSpeed}m/s` }
  }
  return { valid: true, message: '速度合理' }
}
