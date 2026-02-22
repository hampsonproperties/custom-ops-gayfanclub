'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface QuickReplyTemplate {
  id: string
  name: string
  subject_template: string
  body_template: string
  category: string
  hotkey: string | null
  is_active: boolean
  created_at: string
}

export function useQuickReplyTemplates() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['quick-reply-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quick_reply_templates')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      return data as QuickReplyTemplate[]
    },
  })
}

export function applyTemplate(
  template: QuickReplyTemplate,
  variables: Record<string, string>
): { subject: string; body: string } {
  let subject = template.subject_template
  let body = template.body_template

  // Replace merge fields
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`
    subject = subject.replace(new RegExp(placeholder, 'g'), value)
    body = body.replace(new RegExp(placeholder, 'g'), value)
  })

  return { subject, body }
}
