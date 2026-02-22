'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface Tag {
  id: string
  name: string
  color: string
  created_at: string
}

export interface WorkItemTag {
  work_item_id: string
  tag_id: string
  created_at: string
  tag: Tag
}

export function useAllTags() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name')

      if (error) throw error
      return data as Tag[]
    },
  })
}

export function useWorkItemTags(workItemId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['work-item-tags', workItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_item_tags')
        .select('*, tag:tags(*)')
        .eq('work_item_id', workItemId)

      if (error) throw error
      return data as WorkItemTag[]
    },
    enabled: !!workItemId,
  })
}

export function useAddTag() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({
      workItemId,
      tagId,
    }: {
      workItemId: string
      tagId: string
    }) => {
      const { data, error } = await supabase
        .from('work_item_tags')
        .insert({ work_item_id: workItemId, tag_id: tagId })
        .select()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['work-item-tags', variables.workItemId] })
      queryClient.invalidateQueries({ queryKey: ['work-item', variables.workItemId] })
    },
  })
}

export function useRemoveTag() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({
      workItemId,
      tagId,
    }: {
      workItemId: string
      tagId: string
    }) => {
      const { error } = await supabase
        .from('work_item_tags')
        .delete()
        .eq('work_item_id', workItemId)
        .eq('tag_id', tagId)

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['work-item-tags', variables.workItemId] })
      queryClient.invalidateQueries({ queryKey: ['work-item', variables.workItemId] })
    },
  })
}
