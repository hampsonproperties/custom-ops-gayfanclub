import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { validateBody } from '@/lib/api/validate'
import { summarizeBody } from '@/lib/api/schemas'
import { logger } from '@/lib/logger'
import { serverError } from '@/lib/api/errors'

const log = logger('ai-summarize')

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const SUMMARY_PROMPT = `You are an operations assistant for Gay Fan Club, a custom merchandise company specializing in hand fans, banners, and promotional items.

YOUR JOB: Write a plain English summary of where things stand with this customer or project. You're briefing a busy founder who needs to get up to speed fast.

STYLE:
- Write like a knowledgeable team member giving a quick verbal update
- Lead with the most important thing (what's happening NOW)
- Then fill in the backstory and key details
- Use short paragraphs
- Include specific details: names, dates, dollar amounts, order numbers
- If there are open questions or next steps, call them out clearly
- End with what needs to happen next (if anything)

RULES:
1. Be factual — only reference what's in the data
2. Don't make up details or speculate
3. If the email thread shows a problem or concern, mention it
4. Mention timeline context (how long ago things happened)
5. Keep it under 300 words
6. No bullet points — write flowing prose
7. No greeting or sign-off — just the summary`

async function gatherProjectContext(supabase: any, workItemId: string): Promise<string> {
  let context = ''

  // Get the work item with customer
  const { data: project } = await supabase
    .from('work_items')
    .select('*, customer:customers(*)')
    .eq('id', workItemId)
    .single()

  if (!project) return 'Project not found.'

  context += `PROJECT: ${project.title || 'Untitled'}\n`
  context += `Status: ${project.status}\n`
  context += `Type: ${project.work_item_type || 'unknown'}\n`
  if (project.shopify_order_number) context += `Order #${project.shopify_order_number}\n`
  if (project.estimated_value) context += `Estimated Value: $${project.estimated_value}\n`
  if (project.actual_value) context += `Actual Value: $${project.actual_value}\n`
  if (project.event_date) context += `Event Date: ${project.event_date}\n`
  if (project.created_at) context += `Created: ${project.created_at}\n`
  if (project.closed_at) context += `Closed: ${project.closed_at}\n`

  if (project.customer) {
    const c = project.customer
    context += `\nCUSTOMER: ${c.display_name || c.email}\n`
    if (c.phone) context += `Phone: ${c.phone}\n`
    if (c.total_spent) context += `Lifetime Spend: $${c.total_spent}\n`
    if (c.total_orders) context += `Total Orders: ${c.total_orders}\n`
  }

  // Get ALL communications (full body, not truncated)
  const { data: comms } = await supabase
    .from('communications')
    .select('subject, body_text, body_preview, direction, received_at, sent_at, from_email, from_name')
    .eq('work_item_id', workItemId)
    .order('received_at', { ascending: true })
    .limit(30)

  if (comms && comms.length > 0) {
    context += `\nEMAIL THREAD (${comms.length} emails):\n`
    for (const comm of comms) {
      const date = comm.received_at || comm.sent_at || 'unknown date'
      const dir = comm.direction === 'inbound' ? 'FROM' : 'TO'
      const sender = comm.from_name || comm.from_email || 'unknown'
      context += `\n[${dir} ${sender} — ${date}]\n`
      context += `Subject: ${comm.subject || '(no subject)'}\n`
      // Use full body text, fall back to preview
      const body = comm.body_text || comm.body_preview || ''
      context += `${body.substring(0, 1000)}\n`
    }
  }

  // Get internal notes
  const { data: notes } = await supabase
    .from('work_item_notes')
    .select('content, created_at, created_by_email')
    .eq('work_item_id', workItemId)
    .order('created_at', { ascending: true })
    .limit(20)

  if (notes && notes.length > 0) {
    context += `\nINTERNAL NOTES (${notes.length}):\n`
    for (const note of notes) {
      context += `[${note.created_at} by ${note.created_by_email || 'staff'}]: ${note.content}\n`
    }
  }

  // Get status history
  const { data: statusEvents } = await supabase
    .from('work_item_status_events')
    .select('from_status, to_status, created_at, note')
    .eq('work_item_id', workItemId)
    .order('created_at', { ascending: true })
    .limit(20)

  if (statusEvents && statusEvents.length > 0) {
    context += `\nSTATUS HISTORY:\n`
    for (const evt of statusEvents) {
      context += `${evt.created_at}: ${evt.from_status || 'start'} → ${evt.to_status}`
      if (evt.note) context += ` (${evt.note})`
      context += '\n'
    }
  }

  return context
}

async function gatherCustomerContext(supabase: any, customerId: string): Promise<string> {
  let context = ''

  // Get customer
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single()

  if (!customer) return 'Customer not found.'

  context += `CUSTOMER: ${customer.display_name || customer.email}\n`
  if (customer.phone) context += `Phone: ${customer.phone}\n`
  if (customer.total_spent) context += `Lifetime Spend: $${customer.total_spent}\n`
  if (customer.total_orders) context += `Total Orders: ${customer.total_orders}\n`
  if (customer.created_at) context += `Customer Since: ${customer.created_at}\n`

  // Get all their projects
  const { data: projects } = await supabase
    .from('work_items')
    .select('id, title, status, work_item_type, shopify_order_number, estimated_value, actual_value, event_date, created_at, closed_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (projects && projects.length > 0) {
    context += `\nPROJECTS (${projects.length}):\n`
    for (const p of projects) {
      context += `- ${p.title || 'Untitled'} [${p.status}]`
      if (p.shopify_order_number) context += ` #${p.shopify_order_number}`
      if (p.estimated_value) context += ` $${p.estimated_value}`
      if (p.event_date) context += ` event: ${p.event_date}`
      context += '\n'
    }
  }

  // Get recent communications across all their projects
  const { data: comms } = await supabase
    .from('communications')
    .select('subject, body_text, body_preview, direction, received_at, sent_at, from_email, from_name')
    .eq('customer_id', customerId)
    .order('received_at', { ascending: false })
    .limit(20)

  if (comms && comms.length > 0) {
    context += `\nRECENT EMAILS (${comms.length}):\n`
    for (const comm of comms) {
      const date = comm.received_at || comm.sent_at || 'unknown date'
      const dir = comm.direction === 'inbound' ? 'FROM' : 'TO'
      context += `[${dir} — ${date}] ${comm.subject || '(no subject)'}\n`
      const body = comm.body_text || comm.body_preview || ''
      context += `${body.substring(0, 500)}\n\n`
    }
  }

  // Get customer notes
  const { data: notes } = await supabase
    .from('customer_notes')
    .select('content, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true })
    .limit(10)

  if (notes && notes.length > 0) {
    context += `\nCUSTOMER NOTES (${notes.length}):\n`
    for (const note of notes) {
      context += `[${note.created_at}]: ${note.content}\n`
    }
  }

  return context
}

export async function POST(request: NextRequest) {
  try {
    const bodyResult = validateBody(await request.json(), summarizeBody)
    if (bodyResult.error) return bodyResult.error
    const { workItemId, customerId } = bodyResult.data

    const supabase = await createClient()

    // Gather context based on what was requested
    let context: string
    if (workItemId) {
      context = await gatherProjectContext(supabase, workItemId)
    } else {
      context = await gatherCustomerContext(supabase, customerId!)
    }

    const openai = getOpenAIClient()

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      max_tokens: 1024,
      temperature: 0.3,
      messages: [
        { role: 'system', content: SUMMARY_PROMPT },
        { role: 'user', content: `Summarize the current state of this ${workItemId ? 'project' : 'customer relationship'}:\n\n${context}` },
      ],
    })

    const summary = completion.choices[0]?.message?.content || 'Unable to generate summary.'

    return NextResponse.json({ success: true, summary })
  } catch (error) {
    log.error('AI summarize error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to generate summary')
  }
}
