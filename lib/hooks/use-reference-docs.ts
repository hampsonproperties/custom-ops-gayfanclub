'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type ReferenceDoc = Database['public']['Tables']['reference_docs']['Row']
type ReferenceDocInsert = Database['public']['Tables']['reference_docs']['Insert']

export type { ReferenceDoc }

export function useReferenceDocs() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['reference-docs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reference_docs')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as ReferenceDoc[]
    },
  })
}

export function useUploadReferenceDoc() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({
      file,
      name,
      category,
    }: {
      file: File
      name: string
      category: string
    }) => {
      const { data: { user } } = await supabase.auth.getUser()

      // Upload file to storage
      const timestamp = Date.now()
      const storagePath = `reference-docs/${timestamp}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('custom-ops-files')
        .upload(storagePath, file)

      if (uploadError) throw uploadError

      // Extract text content for AI
      let contentText: string | null = null

      if (file.type === 'text/plain' || file.type === 'text/markdown' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        contentText = await file.text()
      } else if (file.type === 'application/pdf') {
        // Send to server for PDF text extraction
        const formData = new FormData()
        formData.append('file', file)
        const extractResponse = await fetch('/api/ai/extract-text', {
          method: 'POST',
          body: formData,
        })
        if (extractResponse.ok) {
          const { text } = await extractResponse.json()
          contentText = text
        }
      }

      // Create database record
      const record: ReferenceDocInsert = {
        name,
        category,
        original_filename: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        size_bytes: file.size,
        content_text: contentText,
        uploaded_by_user_id: user?.id || null,
      }

      const { data, error } = await supabase
        .from('reference_docs')
        .insert(record)
        .select()
        .single()

      if (error) throw error
      return data as ReferenceDoc
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-docs'] })
    },
  })
}

export function useToggleReferenceDoc() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('reference_docs')
        .update({ is_active: isActive })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-docs'] })
    },
  })
}

export function useDeleteReferenceDoc() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath: string }) => {
      // Delete from storage
      await supabase.storage
        .from('custom-ops-files')
        .remove([storagePath])

      // Delete database record
      const { error } = await supabase
        .from('reference_docs')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-docs'] })
    },
  })
}
