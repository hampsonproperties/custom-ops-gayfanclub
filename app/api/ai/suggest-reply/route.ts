import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { validateBody } from '@/lib/api/validate'
import { suggestReplyBody } from '@/lib/api/schemas'
import { logger } from '@/lib/logger'
import { serverError } from '@/lib/api/errors'

const log = logger('ai-suggest-reply')

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const SUGGEST_REPLY_PROMPT = `You are an email assistant for Gay Fan Club, a custom merchandise company specializing in hand fans, banners, and promotional items for Pride events, drag shows, and celebrations.

YOUR JOB: Draft a reply to the customer's most recent email. Use the conversation history and reference documents to give accurate, specific answers.

BRAND VOICE:
- Playful. Powerful. Pride-forward.
- Confident chaos, handled professionally.
- Bold, inclusive, fast and friendly — like a cool founder texting you, not a help desk.
- Short paragraphs. Occasional emoji. Zero corporate fluff.
- Never snarky or mean. Always warm and enthusiastic.
- Use "we" and "us" naturally.

RULES:
1. Return ONLY the email body text — no subject line, no commentary
2. Answer the customer's actual question using info from the reference documents
3. Quote specific prices, timelines, or policies from the reference docs when relevant
4. If the reference docs don't cover what the customer is asking, say you'll check and get back to them — don't make up answers
5. Keep it concise — match the length of what's needed
6. Don't use "Dear" or formal openings
7. End with a warm sign-off but not overly formal
8. Include next steps when appropriate`

async function gatherContext(supabase: any, workItemId?: string, customerId?: string): Promise<string> {
  let context = ''

  if (workItemId) {
    const { data: project } = await supabase
      .from('work_items')
      .select('*, customer:customers(*)')
      .eq('id', workItemId)
      .single()

    if (project) {
      context += `PROJECT: ${project.title || 'Untitled'}\n`
      context += `Status: ${project.status}\n`
      if (project.shopify_order_number) context += `Order #${project.shopify_order_number}\n`
      if (project.estimated_value) context += `Estimated Value: $${project.estimated_value}\n`
      if (project.actual_value) context += `Actual Value: $${project.actual_value}\n`
      if (project.event_date) context += `Event Date: ${project.event_date}\n`

      if (project.customer) {
        const c = project.customer
        context += `\nCUSTOMER: ${c.display_name || c.email}\n`
        if (c.phone) context += `Phone: ${c.phone}\n`
        if (c.total_spent) context += `Lifetime Spend: $${c.total_spent}\n`
      }
    }

    // Get email thread
    const { data: comms } = await supabase
      .from('communications')
      .select('subject, body_text, body_preview, direction, received_at, sent_at, from_email, from_name')
      .eq('work_item_id', workItemId)
      .order('received_at', { ascending: true })
      .limit(20)

    if (comms && comms.length > 0) {
      context += `\nEMAIL THREAD (${comms.length} emails):\n`
      for (const comm of comms) {
        const date = comm.received_at || comm.sent_at || 'unknown date'
        const dir = comm.direction === 'inbound' ? 'FROM' : 'TO'
        const sender = comm.from_name || comm.from_email || 'unknown'
        context += `\n[${dir} ${sender} — ${date}]\n`
        context += `Subject: ${comm.subject || '(no subject)'}\n`
        const body = comm.body_text || comm.body_preview || ''
        context += `${body.substring(0, 1000)}\n`
      }
    }

    // Get internal notes
    const { data: notes } = await supabase
      .from('work_item_notes')
      .select('content, created_at')
      .eq('work_item_id', workItemId)
      .order('created_at', { ascending: true })
      .limit(10)

    if (notes && notes.length > 0) {
      context += `\nINTERNAL NOTES:\n`
      for (const note of notes) {
        context += `[${note.created_at}]: ${note.content}\n`
      }
    }
  } else if (customerId) {
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()

    if (customer) {
      context += `CUSTOMER: ${customer.display_name || customer.email}\n`
      if (customer.total_spent) context += `Lifetime Spend: $${customer.total_spent}\n`
      if (customer.total_orders) context += `Total Orders: ${customer.total_orders}\n`
    }

    // Get recent emails
    const { data: comms } = await supabase
      .from('communications')
      .select('subject, body_text, body_preview, direction, received_at, sent_at, from_email, from_name')
      .eq('customer_id', customerId)
      .order('received_at', { ascending: false })
      .limit(15)

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
  }

  return context
}

async function getReferenceDocs(supabase: any): Promise<string> {
  const { data: docs } = await supabase
    .from('reference_docs')
    .select('name, category, content_text')
    .eq('is_active', true)
    .order('category')

  if (!docs || docs.length === 0) return ''

  let refText = '\n\nREFERENCE DOCUMENTS:\n'
  for (const doc of docs) {
    if (!doc.content_text) continue
    refText += `\n--- ${doc.name} (${doc.category}) ---\n`
    // Limit each doc to 3000 chars to stay within token budget
    refText += doc.content_text.substring(0, 3000)
    refText += '\n'
  }

  return refText
}

export async function POST(request: NextRequest) {
  try {
    const bodyResult = validateBody(await request.json(), suggestReplyBody)
    if (bodyResult.error) return bodyResult.error
    const { workItemId, customerId } = bodyResult.data

    const supabase = await createClient()

    // Gather conversation context and reference docs in parallel
    const [context, refDocs] = await Promise.all([
      gatherContext(supabase, workItemId, customerId),
      getReferenceDocs(supabase),
    ])

    const fullContext = context + refDocs

    const openai = getOpenAIClient()

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      max_tokens: 1024,
      temperature: 0.7,
      messages: [
        { role: 'system', content: SUGGEST_REPLY_PROMPT },
        { role: 'user', content: `Draft a reply to the customer's most recent email based on this context:\n\n${fullContext}` },
      ],
    })

    const reply = completion.choices[0]?.message?.content || ''

    // Generate a subject line
    const subjectCompletion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      max_tokens: 50,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: `Based on this email reply, generate a concise subject line (no quotes, just the text). If it's a reply to an existing thread, prefix with "Re: ":\n\n${reply}`,
        },
      ],
    })

    const subject = subjectCompletion.choices[0]?.message?.content?.replace(/^["']|["']$/g, '').trim() || ''

    return NextResponse.json({ success: true, reply, subject })
  } catch (error) {
    log.error('AI suggest-reply error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to generate suggested reply')
  }
}
