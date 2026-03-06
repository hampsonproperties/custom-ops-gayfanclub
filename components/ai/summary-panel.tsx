'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

const log = logger('summary-panel')

interface SummaryPanelProps {
  workItemId?: string
  customerId?: string
}

export function SummaryPanel({ workItemId, customerId }: SummaryPanelProps) {
  const [summary, setSummary] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  const handleSummarize = async () => {
    setIsLoading(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15_000)
      const response = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workItemId, customerId }),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate summary')
      }

      const { summary: text } = await response.json()
      setSummary(text)
      setIsExpanded(true)
    } catch (error) {
      log.error('Summary error', { error })
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('AI is temporarily unavailable. Please try again in a moment.')
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to generate summary')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Show generate button if no summary yet
  if (!summary && !isLoading) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleSummarize}
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        Summarize with AI
      </Button>
    )
  }

  // Show loading state
  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Reading emails, notes, and history...</span>
        </CardContent>
      </Card>
    )
  }

  // Show summary card
  return (
    <Card>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-purple-500" />
          AI Summary
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation()
              handleSummarize()
            }}
            title="Regenerate summary"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {isExpanded && (
        <CardContent className="pt-0 pb-4">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{summary}</p>
        </CardContent>
      )}
    </Card>
  )
}
