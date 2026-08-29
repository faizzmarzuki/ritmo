import { TrendingDown, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export default function StatCard({ icon: Icon, label, value, unit, note, trend, good }) {
  return (
    <Card size="sm" className="py-3.5">
      <CardContent className="space-y-1.5 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg">
            <Icon className="size-4" />
          </div>
          {trend?.value ? (
            <Badge
              variant="outline"
              className={
                good
                  ? 'border-transparent bg-[var(--neon)]/10 text-[var(--neon)]'
                  : 'border-transparent bg-red-500/10 text-red-600 dark:text-red-400'
              }
            >
              {trend.up ? <TrendingUp data-icon="inline-start" /> : <TrendingDown data-icon="inline-start" />}
              {trend.value}
            </Badge>
          ) : null}
        </div>
        <div>
          <p className="text-muted-foreground truncate text-xs font-medium">{label}</p>
          <p className="mt-0.5 text-xl font-bold tracking-tight tabular-nums">
            {value == null ? '—' : value.toLocaleString()}
            {unit && <span className="text-muted-foreground ml-1 text-xs font-medium">{unit}</span>}
          </p>
        </div>
        <p className="text-muted-foreground hidden truncate text-[11px] xl:block">{note}</p>
      </CardContent>
    </Card>
  )
}
