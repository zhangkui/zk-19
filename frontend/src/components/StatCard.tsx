import { cn } from '../utils'

interface StatCardProps {
  title: string
  value: string | number
  icon?: React.ReactNode
  trend?: number
  trendLabel?: string
  color?: 'cyan' | 'amber' | 'success' | 'danger' | 'warning'
  className?: string
}

export default function StatCard({
  title,
  value,
  icon,
  trend,
  trendLabel,
  color = 'cyan',
  className,
}: StatCardProps) {
  const colorClasses = {
    cyan: 'text-cyan border-cyan/30 bg-cyan/5',
    amber: 'text-amber border-amber/30 bg-amber/5',
    success: 'text-success border-success/30 bg-success/5',
    danger: 'text-danger border-danger/30 bg-danger/5',
    warning: 'text-warning border-warning/30 bg-warning/5',
  }

  const iconBgClasses = {
    cyan: 'bg-cyan/20 text-cyan',
    amber: 'bg-amber/20 text-amber',
    success: 'bg-success/20 text-success',
    danger: 'bg-danger/20 text-danger',
    warning: 'bg-warning/20 text-warning',
  }

  return (
    <div
      className={cn(
        'relative bg-bg-panel border border-border-dark rounded-xl p-5 overflow-hidden',
        'hover:border-cyan/30 transition-all duration-300',
        className
      )}
    >
      {/* Glow effect */}
      <div className={cn('absolute top-0 left-0 right-0 h-0.5', colorClasses[color])}></div>

      <div className="flex items-start justify-between">
        <div>
          <p className="text-text-muted text-sm mb-2">{title}</p>
          <p className={cn('font-display text-3xl font-bold', colorClasses[color])}>
            {value}
          </p>
          {trend !== undefined && (
            <p className="text-xs text-text-muted mt-2">
              {trendLabel && <span className="mr-1">{trendLabel}</span>}
              <span className={trend >= 0 ? 'text-danger' : 'text-success'}>
                {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
              </span>
            </p>
          )}
        </div>
        {icon && (
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', iconBgClasses[color])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
