import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

type Template = Database['public']['Tables']['templates']['Row']

/**
 * Get an email template by its key
 */
export async function getTemplateByKey(key: string): Promise<Template | null> {
  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('key', key)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error(`Failed to fetch template with key "${key}":`, error)
    return null
  }

  return data
}

/**
 * Render a template by replacing merge fields with actual values
 * Merge fields use {{fieldName}} syntax
 */
export function renderTemplate(
  template: Template,
  mergeFields: Record<string, string | undefined>
): { subject: string; body: string } {
  let subject = template.subject_template
  let body = template.body_html_template

  // Replace all merge fields in subject and body
  Object.entries(mergeFields).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`
    const replacement = value || ''

    subject = subject.replace(new RegExp(placeholder, 'g'), replacement)
    body = body.replace(new RegExp(placeholder, 'g'), replacement)
  })

  // Warn about any unreplaced merge fields (optional, helps debugging)
  const unreplacedPattern = /\{\{(\w+)\}\}/g
  const unreplacedInSubject = subject.match(unreplacedPattern)
  const unreplacedInBody = body.match(unreplacedPattern)

  if (unreplacedInSubject || unreplacedInBody) {
    console.warn('Unreplaced merge fields found:', {
      subject: unreplacedInSubject,
      body: unreplacedInBody,
    })
  }

  return { subject, body }
}

/**
 * Get and render a template in one call
 */
export async function getAndRenderTemplate(
  key: string,
  mergeFields: Record<string, string | undefined>
): Promise<{ subject: string; body: string } | null> {
  const template = await getTemplateByKey(key)

  if (!template) {
    return null
  }

  return renderTemplate(template, mergeFields)
}
