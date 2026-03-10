'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

interface QueueNavigatorProps {
  source: string
  position: number
  total: number
  onPrevious: (() => void) | null
  onNext: (() => void) | null
  onClose: () => void
}

export function QueueNavigator({
  source,
  position,
  total,
  onPrevious,
  onNext,
  onClose,
}: QueueNavigatorProps) {
  // Keyboard shortcuts: j = next, k = previous
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement)?.isContentEditable) return

      if (e.key === 'j' && onNext) {
        e.preventDefault()
        onNext()
      } else if (e.key === 'k' && onPrevious) {
        e.preventDefault()
        onPrevious()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onNext, onPrevious])

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-1.5 bg-muted/50 border rounded-md text-sm">
      <span className="text-muted-foreground truncate">{source}</span>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onPrevious ?? undefined}
          disabled={!onPrevious}
          title="Previous (k)"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="text-muted-foreground tabular-nums min-w-[4ch] text-center">
          {position} / {total}
        </span>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onNext ?? undefined}
          disabled={!onNext}
          title="Next (j)"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 ml-1 text-muted-foreground hover:text-foreground"
          onClick={onClose}
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
