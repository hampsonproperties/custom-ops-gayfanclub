'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

const QUEUE_KEY = 'tgfc-queue'
const MAX_AGE_MS = 4 * 60 * 60 * 1000 // 4 hours

interface QueueData {
  source: string
  type: 'customer' | 'work-item'
  ids: string[]
  createdAt: number
}

interface QueueNavigationResult {
  /** Whether a valid queue context exists for this page */
  hasQueue: boolean
  /** Source label (e.g., "Needs My Reply") */
  source: string | null
  /** Current position (1-based for display) */
  position: number | null
  /** Total items in the queue */
  total: number | null
  /** Navigate to the previous item (null if at start) */
  goToPrevious: (() => void) | null
  /** Navigate to the next item (null if at end) */
  goToNext: (() => void) | null
  /** Clear the queue context */
  clearQueue: () => void
}

function getHref(type: 'customer' | 'work-item', id: string): string {
  return type === 'customer'
    ? `/customers/${id}?tab=activity`
    : `/work-items/${id}`
}

function readQueue(): QueueData | null {
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY)
    if (!raw) return null
    const data: QueueData = JSON.parse(raw)
    // Expire stale queues
    if (Date.now() - data.createdAt > MAX_AGE_MS) {
      sessionStorage.removeItem(QUEUE_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

/**
 * Saves a navigation queue to sessionStorage.
 * Call this from list pages when the user clicks an item.
 */
export function setQueue(params: {
  source: string
  type: 'customer' | 'work-item'
  ids: string[]
}): void {
  const data: QueueData = {
    source: params.source,
    type: params.type,
    ids: params.ids,
    createdAt: Date.now(),
  }
  try {
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(data))
  } catch {
    // sessionStorage full or unavailable — silently ignore
  }
}

/**
 * Reads the queue from sessionStorage and returns navigation
 * helpers if the current page's itemId is in the queue.
 */
export function useQueueNavigation(
  itemId: string,
  itemType: 'customer' | 'work-item'
): QueueNavigationResult {
  const router = useRouter()
  const [queue, setQueueState] = useState<QueueData | null>(null)

  // Read queue on mount and when itemId changes
  useEffect(() => {
    setQueueState(readQueue())
  }, [itemId])

  const currentIndex = useMemo(() => {
    if (!queue || queue.type !== itemType) return -1
    return queue.ids.indexOf(itemId)
  }, [queue, itemId, itemType])

  const hasQueue = queue !== null && currentIndex >= 0

  const goToPrevious = useCallback(() => {
    if (!queue || currentIndex <= 0) return
    const prevId = queue.ids[currentIndex - 1]
    router.push(getHref(queue.type, prevId))
  }, [queue, currentIndex, router])

  const goToNext = useCallback(() => {
    if (!queue || currentIndex >= queue.ids.length - 1) return
    const nextId = queue.ids[currentIndex + 1]
    router.push(getHref(queue.type, nextId))
  }, [queue, currentIndex, router])

  const clearQueue = useCallback(() => {
    sessionStorage.removeItem(QUEUE_KEY)
    setQueueState(null)
  }, [])

  if (!hasQueue) {
    return {
      hasQueue: false,
      source: null,
      position: null,
      total: null,
      goToPrevious: null,
      goToNext: null,
      clearQueue,
    }
  }

  return {
    hasQueue: true,
    source: queue!.source,
    position: currentIndex + 1,
    total: queue!.ids.length,
    goToPrevious: currentIndex > 0 ? goToPrevious : null,
    goToNext: currentIndex < queue!.ids.length - 1 ? goToNext : null,
    clearQueue,
  }
}
