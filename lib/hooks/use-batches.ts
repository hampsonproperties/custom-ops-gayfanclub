'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type Batch = Database['public']['Tables']['batches']['Row']
type BatchInsert = Database['public']['Tables']['batches']['Insert']
type BatchUpdate = Database['public']['Tables']['batches']['Update']

export function useBatches() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['batches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Batch[]
    },
  })
}

export function useBatch(id: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['batch', id],
    queryFn: async () => {
      // Get batch with its items
      const { data: batch, error: batchError } = await supabase
        .from('batches')
        .select('*')
        .eq('id', id)
        .single()

      if (batchError) throw batchError

      // Get batch items with work item details and files
      const { data: items, error: itemsError } = await supabase
        .from('batch_items')
        .select(`
          *,
          work_item:work_items(
            *,
            files(*)
          )
        `)
        .eq('batch_id', id)
        .order('position', { ascending: true })

      if (itemsError) throw itemsError

      return {
        ...batch,
        items: items || [],
      }
    },
    enabled: !!id,
  })
}

export function useCreateBatch() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ name, workItemIds }: { name: string; workItemIds: string[] }) => {
      const { data: { user } } = await supabase.auth.getUser()

      // Create batch
      const { data: batch, error: batchError } = await supabase
        .from('batches')
        .insert({
          name,
          status: 'draft',
          created_by_user_id: user?.id || null,
        })
        .select()
        .single()

      if (batchError) throw batchError

      // Add work items to batch
      const batchItems = workItemIds.map((workItemId, index) => ({
        batch_id: batch.id,
        work_item_id: workItemId,
        position: index + 1,
      }))

      const { error: itemsError } = await supabase
        .from('batch_items')
        .insert(batchItems)

      if (itemsError) throw itemsError

      // Update work items to link to this batch
      const { error: updateError } = await supabase
        .from('work_items')
        .update({
          batch_id: batch.id,
          batched_at: new Date().toISOString(),
          status: 'batched',
        })
        .in('id', workItemIds)

      if (updateError) throw updateError

      // Recalculate follow-ups for all batched items
      // Status 'batched' should pause follow-ups (set to NULL)
      try {
        for (const workItemId of workItemIds) {
          const { data: nextFollowUp } = await supabase
            .rpc('calculate_next_follow_up', { work_item_id: workItemId })

          if (nextFollowUp !== undefined) {
            await supabase
              .from('work_items')
              .update({ next_follow_up_at: nextFollowUp })
              .eq('id', workItemId)
          }
        }
      } catch (followUpError) {
        console.error('[Create Batch] Error calculating follow-ups:', followUpError)
        // Don't fail the whole operation if follow-up calc fails
      }

      return batch
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['work-items'] })
    },
  })
}

export function useConfirmBatch() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (batchId: string) => {
      const { data, error } = await supabase
        .from('batches')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', batchId)
        .select()
        .single()

      if (error) throw error

      // Queue progress emails (Email 1 & 2) in background
      fetch(`/api/batches/${batchId}/queue-progress-emails`, {
        method: 'POST',
      }).catch((error) => {
        console.error('[Confirm Batch] Failed to queue progress emails:', error)
      })

      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['batch', data.id] })
    },
  })
}

export function useExportBatch() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (batchId: string) => {
      const { data, error } = await supabase
        .from('batches')
        .update({
          status: 'exported',
          exported_at: new Date().toISOString(),
        })
        .eq('id', batchId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['batch', data.id] })
    },
  })
}

export function useUpdateBatchTracking() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ batchId, trackingNumber }: { batchId: string; trackingNumber: string }) => {
      const { data, error } = await supabase
        .from('batches')
        .update({
          tracking_number: trackingNumber,
          shipped_at: new Date().toISOString(),
        })
        .eq('id', batchId)
        .select()
        .single()

      if (error) throw error

      // Queue en route email (Email 3) in background
      fetch(`/api/batches/${batchId}/queue-tracking-email`, {
        method: 'POST',
      }).catch((error) => {
        console.error('[Update Batch Tracking] Failed to queue en route email:', error)
      })

      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['batch', data.id] })
    },
  })
}

export function useMarkBatchReceived() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ batchId, receivedAt }: { batchId: string; receivedAt?: string }) => {
      const response = await fetch(`/api/batches/${batchId}/mark-received`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receivedAt }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to mark batch as received')
      }

      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['batch', data.batchId] })
      queryClient.invalidateQueries({ queryKey: ['batch-email-status', data.batchId] })
    },
  })
}
