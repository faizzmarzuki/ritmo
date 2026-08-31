import { PersonStanding } from 'lucide-react'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import MuscleAnatomy, { MUSCLE_NAMES, recoveryColor } from '@/components/MuscleAnatomy'
import { api } from '@/lib/api'
import { useApi } from '@/hooks/useApi'

const LEGEND = [
  { label: 'Just trained', t: 1 },
  { label: 'Recovering', t: 0.45 },
  { label: 'Ready', t: 0 },
]

/**
 * Anatomy card — the muscles hit by logged gym exercises glow red on workout
 * day and fade through yellow back to white (~72h) as they recover.
 */
export default function MuscleRecoveryCard() {
  const { data } = useApi(() => api.muscleRecovery(), [], ['activity'], 'muscle-recovery')
  const muscles = data?.muscles || {}
  const worked = Object.entries(muscles)
    .filter(([, m]) => m.intensity > 0.02)
    .sort((a, b) => b[1].intensity - a[1].intensity)

  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <PersonStanding className="size-4 text-[var(--neon)]" />
          Muscle recovery
        </CardTitle>
        <CardAction>
          <Badge variant="outline" className="text-[10px]">~{data?.recoveryHours ?? 72}h to recover</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex h-full flex-col justify-between gap-3">
        <MuscleAnatomy muscles={muscles} />
        <div className="space-y-2">
          <div className="text-muted-foreground flex items-center justify-center gap-3 text-[10px]">
            {LEGEND.map(({ label, t }) => (
              <span key={label} className="flex items-center gap-1">
                <span
                  className="border-border size-2.5 rounded-full border"
                  style={{ background: recoveryColor(t) }}
                />
                {label}
              </span>
            ))}
          </div>
          {worked.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-1">
              {worked.map(([key, m]) => (
                <Badge key={key} variant="outline" className="gap-1 text-[10px] font-normal">
                  <span className="size-1.5 rounded-full" style={{ background: recoveryColor(m.intensity) }} />
                  {MUSCLE_NAMES[key] || key}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center text-[11px]">
              Log a gym session with its exercises and the muscles you hit light up here.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
