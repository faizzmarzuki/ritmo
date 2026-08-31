import { ANATOMY_VIEWBOX, FRONT, BACK } from '@/components/anatomyPaths'

/**
 * Front/back muscle anatomy figures. Each muscle group is a set of SVG paths
 * (see anatomyPaths.js) tinted by training freshness from
 * GET /api/strength/recovery: intensity 1 = just trained (red), fading through
 * yellow to white (fully recovered). Line art renders on top of the fills.
 *
 * `muscles` is { [muscleKey]: { intensity: 0..1, lastWorked: 'YYYY-MM-DD' } }.
 */

export const MUSCLE_NAMES = {
  shoulders: 'Shoulders', chest: 'Chest', biceps: 'Biceps', triceps: 'Triceps',
  forearms: 'Forearms', abs: 'Abs', obliques: 'Obliques', traps: 'Traps',
  lats: 'Lats', lowerback: 'Lower back', glutes: 'Glutes', quads: 'Quads',
  hamstrings: 'Hamstrings', calves: 'Calves',
}

const WHITE = [250, 250, 249]
const YELLOW = [250, 204, 21]
const RED = [239, 68, 68]
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))

export function recoveryColor(intensity) {
  const t = Math.max(0, Math.min(1, intensity || 0))
  const rgb = t < 0.5 ? mix(WHITE, YELLOW, t * 2) : mix(YELLOW, RED, (t - 0.5) * 2)
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
}

function trainedLabel(info) {
  if (!info?.intensity) return 'recovered'
  if (!info.lastWorked) return 'recovering'
  const days = Math.round((Date.now() - new Date(`${info.lastWorked}T12:00:00`)) / 864e5)
  if (days <= 0) return 'trained today'
  if (days === 1) return 'trained yesterday'
  return `trained ${days} days ago`
}

function Figure({ data, muscles, label }) {
  return (
    <svg viewBox={ANATOMY_VIEWBOX} className="h-auto w-full" role="img" aria-label={`${label} muscle map`}>
      {Object.entries(data.muscles).map(([key, paths]) => (
        <g key={key} fill={recoveryColor(muscles[key]?.intensity)}>
          <title>{`${MUSCLE_NAMES[key] || key} — ${trainedLabel(muscles[key])}`}</title>
          {paths.map((d, i) => <path key={i} d={d} />)}
        </g>
      ))}
      <g fill="var(--muted)">
        {data.neutral.map((d, i) => <path key={i} d={d} />)}
      </g>
      <g
        fill="none"
        stroke="var(--anatomy-outline)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={data.strokeWidth}
      >
        {data.outline.paths.map((d, i) => <path key={i} d={d} />)}
        {data.outline.lines.map((l, i) => <line key={i} {...l} />)}
      </g>
    </svg>
  )
}

export default function MuscleAnatomy({ muscles = {}, className = '' }) {
  return (
    <div className={`flex items-start justify-center gap-3 ${className}`}>
      <figure className="flex w-full max-w-[170px] flex-col items-center gap-1">
        <Figure data={FRONT} muscles={muscles} label="Front" />
        <figcaption className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">Front</figcaption>
      </figure>
      <figure className="flex w-full max-w-[170px] flex-col items-center gap-1">
        <Figure data={BACK} muscles={muscles} label="Back" />
        <figcaption className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">Back</figcaption>
      </figure>
    </div>
  )
}
