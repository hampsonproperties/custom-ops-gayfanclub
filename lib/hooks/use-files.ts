'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type File = Database['public']['Tables']['files']['Row']
type FileInsert = Database['public']['Tables']['files']['Insert']

export function useFiles(workItemId?: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['files', workItemId],
    queryFn: async () => {
      let query = supabase
        .from('files')
        .select('*')
        .order('created_at', { ascending: false })

      if (workItemId) {
        query = query.eq('work_item_id', workItemId)
      }

      const { data, error } = await query

      if (error) throw error
      return data as File[]
    },
    enabled: !!workItemId,
    staleTime: 1000 * 60, // 1 minute
  })
}

export function useUploadFile() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      workItemId,
      file,
      kind,
      note,
    }: {
      workItemId: string
      file: File
      kind: 'preview' | 'design' | 'proof' | 'other'
      note?: string
    }) => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()

      // Get latest version for this kind
      const { data: existingFiles } = await supabase
        .from('files')
        .select('version')
        .eq('work_item_id', workItemId)
        .eq('kind', kind)
        .order('version', { ascending: false })
        .limit(1)

      const version = (existingFiles?.[0]?.version || 0) + 1

      // Upload to Supabase Storage
      const filePath = `work-items/${workItemId}/${kind}-v${version}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('custom-ops-files')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Create file record
      const fileRecord: FileInsert = {
        work_item_id: workItemId,
        kind,
        version,
        original_filename: file.name,
        normalized_filename: `${kind}-v${version}-${file.name}`,
        storage_bucket: 'custom-ops-files',
        storage_path: filePath,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by_user_id: user?.id || null,
        note: note || null,
      }

      const { data, error } = await supabase
        .from('files')
        .insert(fileRecord)
        .select()
        .single()

      if (error) throw error
      return data as File
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['files', variables.workItemId] })
    },
  })
}

export function useDeleteFile() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ fileId, workItemId }: { fileId: string; workItemId: string }) => {
      // Get file to delete from storage
      const { data: file } = await supabase
        .from('files')
        .select('storage_bucket, storage_path')
        .eq('id', fileId)
        .single()

      // Delete from storage if it's a Supabase file (not external)
      if (file && file.storage_bucket === 'custom-ops-files') {
        await supabase.storage
          .from(file.storage_bucket)
          .remove([file.storage_path])
      }

      // Delete database record
      const { error } = await supabase
        .from('files')
        .delete()
        .eq('id', fileId)

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['files', variables.workItemId] })
    },
  })
}

export function getFileUrl(file: File): string {
  // If it's an external URL (Customify), return as-is
  if (file.storage_bucket === 'customify' || file.storage_bucket === 'external') {
    return file.storage_path
  }

  // Otherwise get Supabase Storage public URL
  const supabase = createClient()
  const { data } = supabase.storage
    .from(file.storage_bucket)
    .getPublicUrl(file.storage_path)

  return data.publicUrl
}
