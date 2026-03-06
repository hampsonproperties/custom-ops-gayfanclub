'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface EmailSignatureData {
  signature_name: string | null
  signature_title: string | null
  signature_logo_url: string | null
  email_signature_html: string | null
}

export function useMyEmailSignature() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['email-signature', 'me'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('users')
        .select('signature_name, signature_title, signature_logo_url, email_signature_html')
        .eq('id', user.id)
        .single()

      if (error) throw error
      return data as EmailSignatureData
    },
  })
}

export function useSaveEmailSignature() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (input: {
      signature_name: string
      signature_title: string
      signature_logo_url: string
      email_signature_html: string
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('users')
        .update(input)
        .eq('id', user.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-signature'] })
    },
  })
}

export function useUploadSignatureLogo() {
  const supabase = createClient()

  return useMutation({
    mutationFn: async (file: File) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const path = `signatures/${user.id}/logo.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('custom-ops-files')
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('custom-ops-files')
        .getPublicUrl(path)

      return urlData.publicUrl
    },
  })
}

/**
 * Build the full HTML signature from parts.
 * Used both in the settings UI (preview) and on the server (send route).
 */
export function buildSignatureHtml(input: {
  name: string
  title: string
  logoUrl: string
}): string {
  const { name, title, logoUrl } = input

  const parts: string[] = []

  parts.push('<div style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e5e5;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333;">')

  if (logoUrl) {
    parts.push(`<img src="${logoUrl}" alt="Logo" style="height:40px;margin-bottom:8px;display:block;" />`)
  }

  if (name) {
    parts.push(`<div style="font-weight:bold;font-size:14px;">${escapeHtml(name)}</div>`)
  }

  if (title) {
    parts.push(`<div style="color:#666;font-size:12px;">${escapeHtml(title)}</div>`)
  }

  parts.push('<div style="margin-top:4px;font-size:12px;color:#666;">The Gay Fan Club</div>')
  parts.push('</div>')

  return parts.join('\n')
}

/**
 * Build a plain text fallback signature.
 */
export function buildSignaturePlainText(input: {
  name: string
  title: string
}): string {
  const lines: string[] = ['', '--']
  if (input.name) lines.push(input.name)
  if (input.title) lines.push(input.title)
  lines.push('The Gay Fan Club')
  return lines.join('\n')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
