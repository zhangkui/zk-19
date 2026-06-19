import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
