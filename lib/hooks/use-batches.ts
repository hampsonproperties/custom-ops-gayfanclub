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

      // Get batch items with work item details
      const { data: items, error: itemsError } = await supabase
        .from('batch_items')
        .select('*, work_item:work_items(*)')
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
