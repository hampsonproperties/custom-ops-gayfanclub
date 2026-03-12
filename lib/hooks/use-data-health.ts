import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface DataHealthDiagnostics {
  unlinked_shopify: number
  aggregate_mismatches: number
  aggregate_details: Array<{
    customer_id: string
    display_name: string | null
    email: string | null
    stored_total: number
    actual_total: number
    difference: number
  }>
  duplicate_customers: number
  duplicate_details: Array<{
    email: string
    count: number
  }>
  orphaned_orders: number
  unlinked_communications: number
  orphaned_work_items: number
  dlq_failed: number
}

export interface DiagnosticsResponse {
  success: boolean
  diagnostics: DataHealthDiagnostics
  errors?: string[]
  timestamp: string
}

/**
 * Fetches data health diagnostics.
 * Manual trigger only (no auto-refetch) since these are heavy queries.
 */
export function useDataHealth() {
  return useQuery<DiagnosticsResponse>({
    queryKey: ['data-health'],
    queryFn: async () => {
      const resp = await fetch('/api/data-health/diagnostics', { method: 'POST' })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Failed to run diagnostics' }))
        throw new Error(err.error || 'Failed to run diagnostics')
      }
      return resp.json()
    },
    enabled: false, // Only run when manually triggered
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    retry: false,
  })
}

/**
 * Recalculate all customer aggregates (total_spent, total_orders, etc.)
 */
export function useRecalculateAggregates() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const resp = await fetch('/api/data-health/recalculate-aggregates', { method: 'POST' })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Failed to recalculate' }))
        throw new Error(err.error || 'Failed to recalculate aggregates')
      }
      return resp.json()
    },
    onSuccess: () => {
      // Invalidate data health to refresh counts
      queryClient.invalidateQueries({ queryKey: ['data-health'] })
    },
  })
}

/**
 * Re-link orphaned orders to customers
 */
export function useRelinkOrders() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const resp = await fetch('/api/data-health/relink-orders', { method: 'POST' })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Failed to re-link orders' }))
        throw new Error(err.error || 'Failed to re-link orders')
      }
      return resp.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-health'] })
    },
  })
}

/**
 * Re-link unlinked emails to customers
 */
export function useRelinkEmails() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const resp = await fetch('/api/data-health/relink-emails', { method: 'POST' })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Failed to re-link emails' }))
        throw new Error(err.error || 'Failed to re-link emails')
      }
      return resp.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-health'] })
    },
  })
}

/**
 * Backfill design files from Customify API (replace old Shopify-parsed files)
 */
export function useBackfillFiles() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ dryRun = false }: { dryRun?: boolean } = {}) => {
      const url = dryRun
        ? '/api/data-health/backfill-files?dry_run=true'
        : '/api/data-health/backfill-files'
      const resp = await fetch(url, { method: 'POST' })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Failed to backfill files' }))
        throw new Error(err.error || 'Failed to backfill files')
      }
      return resp.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-health'] })
    },
  })
}

/**
 * Bulk link customers to Shopify (existing route, reused here)
 */
export function useBulkShopifyLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const resp = await fetch('/api/shopify/link-customers', { method: 'POST' })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Failed to link customers' }))
        throw new Error(err.error || 'Failed to link customers to Shopify')
      }
      return resp.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-health'] })
    },
  })
}
