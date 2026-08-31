import { cn } from '@/lib/utils'

/**
 * The app's one empty-state pattern: visual → title → description → action,
 * centred in the space the missing content would have filled. Every empty
 * state says what is missing and offers a single next step, so a blank screen
 * never reads as a broken one.
 *
 * `size="sm"` is the inline variant for an empty region inside a card, where
 * the surrounding card already carries its own title and icon.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = 'default',
  className,
}) {
  const sm = size === 'sm'
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        sm ? 'gap-2 px-3 py-5' : 'gap-3 px-6 py-10',
        className,
      )}
    >
      {Icon && (
        <div
          className={cn(
            'bg-[var(--neon)]/10 text-[var(--neon)] flex shrink-0 items-center justify-center',
            sm ? 'size-9 rounded-xl' : 'size-12 rounded-2xl',
          )}
        >
          <Icon className={sm ? 'size-4' : 'size-6'} />
        </div>
      )}
      <div className="space-y-1">
        <p className={cn('text-foreground font-medium', sm ? 'text-xs' : 'text-sm')}>{title}</p>
        {description && (
          <p className={cn('text-muted-foreground mx-auto text-xs text-pretty', sm ? 'max-w-[34ch]' : 'max-w-[40ch]')}>
            {description}
          </p>
        )}
      </div>
      {action && <div className={sm ? 'pt-0.5' : 'pt-1'}>{action}</div>}
    </div>
  )
}
